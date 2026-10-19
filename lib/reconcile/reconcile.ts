// Reconciler for one dispatched issue subtree (docs/issues/reconcile-the-execution-tree-with-lazy-exception-handlers.md).
//
// Each tick recomputes what every node needs from observed state (the global tracker and private landing ledger, the
// workers' bb turn reports and current thread/live observations) and takes the next step. Specs get to tickets through the refine
// role (compile or manager), which promotes them or commits children; an implementer who finds its ticket
// bigger than one session sends it back there (respec). Tickets run implement → drive → review → integrate, a leaf into its parent's branch, a node with children once they
// have all landed in its own branch ("collector"), which its own chain then carries up. Mechanical failures
// are retried here within budgets; anything else is an exception for a handler worker spawned for the nearest
// ancestor with children, which resolves it, or escalates up to the owner session (the root supervisor).
//
// Steps are idempotent: worker handles are deterministic, a launched handle whose worktree exists is reused,
// and a ledger-landed node is never integrated again. State on disk durably records what
// was launched and decided, including owner constraints; preserve it across restarts.
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dispatch, findWorker, integrate, retire, stop, tell, topic, type Handle } from "../dispatch.ts";
import { agent as stance, byRole } from "../agents.ts";
import { parse } from "../report.ts";
import { roleThread } from "../desk.ts";
import { lastTurn, type TurnReport } from "../thread/turn.ts";
import { decide } from "../decide.ts";
import { pidAlive } from "../wm.ts";
import { readLive } from "../session-meta/live";
import { bbThreads, bbWorking, logBb, tellBbFolded, type BbThread } from "../thread/bb";
import { refreshWorker } from "./refresh.ts";
import { checkpoint } from "./checkpoint.ts";
import { heldByRed, mainRed, evidenceShapeError, git, isAncestor, storyShapeError, testCommands } from "./checks.ts";
import { getTracker } from "../tracker.ts";
import { GithubRateLimited, rateLimitMark } from "../tracker-github-snapshot.ts";
import { untilReset } from "./rate-limit.ts";
import { excludeTracker } from "../thread/tracker-worktree.ts";
import { alignIndex } from "../thread/lifecycle.ts";
import { schedulingView, type ScheduledIssue as Issue } from "./scheduling.ts";
import { closeAtTarget, finishLandingCleanup, landReviewed, recoverLandings, reviewedResult } from "./completion.ts";
import { acceptRefinement, beginRefinement, discardRefinement, recoverRefinements, releaseRefinementClaims, replaceRefinement } from "./refinement.ts";
import type { GlobalRunState, RefinementAttempt } from "./tracker-state.ts";
import type { LandingMode, PullRequestHost, PrRepairRequest } from "./pr-types.ts";
import { prepareStaging, resolveLanding } from "./pr-config.ts";
import { createPullRequestHost } from "./pr-host.ts";
import { advancePullRequest } from "./pull-request.ts";
import { writeStatus } from "./status.ts";
export type { ScheduledIssue as Issue } from "./scheduling.ts";
/** The tracker CLI beside this reconciler's own code: the one getTracker runs by default. */
const LIVE_TRACKER = fileURLToPath(new URL("../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts", import.meta.url));
/** The tracker scripts as committed at HEAD of the checkout they live in, unpacked once per commit: a run must not read
 * the live checkout, where a merge in progress left conflict markers that stopped every reconciler's snapshot (2026-10-12).
 * Fixes reach a run on its next start. */
export function pinTracker(live = LIVE_TRACKER): string {
	const scripts = realpathSync(join(live, ".."));
	const top = git(scripts, "rev-parse", "--show-toplevel");
	const head = git(top, "rev-parse", "HEAD");
	const sub = relative(top, scripts);
	const dir = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "mlegls-pi", "tracker-pin", head);
	const pinned = join(dir, sub, basename(live));
	if (existsSync(pinned)) return pinned;
	const temp = dir + "." + process.pid + ".tmp";
	rmSync(temp, { recursive: true, force: true });
	mkdirSync(temp, { recursive: true });
	// issues.ts imports ../lib (tracker-lint, decide); packages resolve from the live checkout's installs, which a merge doesn't touch.
	execFileSync("bash", ["-c", 'git -C "$1" archive "$2" -- lib "$3" package.json tsconfig.json | tar -x -C "$4"', "_", top, head, sub, temp]);
	symlinkSync(join(top, "node_modules"), join(temp, "node_modules"));
	if (existsSync(join(scripts, "node_modules"))) symlinkSync(join(scripts, "node_modules"), join(temp, sub, "node_modules"));
	try { renameSync(temp, dir); } catch { rmSync(temp, { recursive: true, force: true }); if (!existsSync(pinned)) throw new Error("tracker pin failed: " + dir); }
	return pinned;
}
/** The reconciler's tracker: the pinned scripts (see pinTracker), so a merge in progress in the live checkout can't stop its queries. */
export function reconcilerTracker(cwd: string, root?: string) {
	const tracker = getTracker(cwd, { run: root, inflight: false, cli: process.env.TRACKER_CLI ?? pinTracker() });
	const captured = root ? load(cwd, root)?.githubRepository : undefined;
	if (captured && (!tracker.githubIssue || tracker.githubIssue(root!).repository.toLowerCase() !== captured.toLowerCase()))
		throw new Error("Tracker repository changed from captured GitHub repository " + captured);
	return tracker;
}
// Offline trials can advance reports promptly; production still polls every five seconds.
const tickMs = Number(process.env.PI_RECONCILE_TICK_MS ?? 5_000);
const TICK_MS = Number.isFinite(tickMs) && tickMs >= 0 ? tickMs : 5_000;
/** An `error` turn-end is not the end of a worker: pi retries a failed request itself (an idle WebSocket, an overloaded
 * provider) and carries on. Act on one only once it has stood this long and the worker is no longer working. */
const ERROR_SETTLE_MS = Number(process.env.PI_RECONCILE_ERROR_SETTLE_MS ?? 90_000);
const START_GRACE_MS = 120_000;
const WAITING_MS = 3 * 60 * 60_000;
/** A waiting worker is asked to check its process this long after its latest `waiting` report or nudge. */
const WAITING_NUDGE_MS = 30 * 60_000;
/** A waiting worker whose session runs no managed process this long after its report is told so (its notice raced, or nothing started). */
const WAITING_VOID_MS = 2 * 60_000;
/** Mechanical retries per chain before a failure becomes an exception. */
const BUDGET = { repair: 2, relaunch: 2, checkpoint: 3, integrate: 3 } as const;


type Phase = "refine" | "implement" | "drive" | "review" | "integrate";
interface Chain {
	/** Exact provisional attempt, independent of the report cursor. */
	refinement?: string;
	/** Branch this chain lands in: the parent's collector, or the owner's checkout for the root. */
	into: string;
	/** The node has children that landed in its collector; this chain is its own residual work and joins. */
	self: boolean;
	phase: Phase;
	handle?: Handle;
	launchedAt?: number;
	/** ts of the last report acted on. */
	handledTs?: string;
	base?: string;
	setup?: unknown;
	drive?: Record<string, unknown>;
	evidence?: Record<string, unknown>;
	/** Waiting on an exception for this node. */
	held?: boolean;
	/** ts of a `waiting` report: the worker is idle on a process it started, until its notification. */
	waitingSince?: string;
	/** ts of the latest `waiting` report or nudge in this wait. */
	waitingCheckedAt?: string;
	/** This wait was nudged for having no running process; once per `waiting` report. */
	waitingVoidNudged?: boolean;
	retries: Record<string, number>;
	/** Why drive is skipped for this chain (the ticket's `drive: none`, or a supervisor's skip-drive). */
	skipDrive?: string;
	workers: Handle[];
	note?: string;
	/** A commit to start the next phase from when no earlier worker of this chain holds it: a stopped run's work. */
	resumeFrom?: string;
	/** The open children a join's drive or review was raised for, once: an answer or retry lets it carry on with them. */
	reopened?: string;
}
/** A chain's work when its run was stopped, so a restart continues it rather than starting over from its destination. */
export interface Resume {
	phase: Exclude<Phase, "refine" | "integrate">;
	branch: string; head: string;
	base?: string; setup?: unknown; drive?: Record<string, unknown>; skipDrive?: string; note?: string;
}
interface Exception {
	id: string; node: string; reason: string; text: string; at: string;
	/** The ancestor whose handler has it, or "owner". */
	level: string;
	handler?: Handle; handlerLaunchedAt?: number; handlerHandledTs?: string;
	mailed?: boolean;
	/** ts of the report that raised it: an answer consumes only up to here, so a report that arrived while held still counts. */
	reportTs?: string;
}
export interface State extends GlobalRunState {
	backend: "threads";
	/** Native tracker identity survives convention/remote edits and restart. */
	githubRepository?: string;
	root: string; cwd: string; owner: string; ownerSession?: string; budget: number; pid?: number;
	collectors: Record<string, { path: string; branch: string; parentBranch: string }>;
	chains: Record<string, Chain>;
	/** Owner restrictions survive chain replacement and reconciler restarts. */
	constraints?: Record<string, string[]>;
	exceptions: Record<string, Exception>;
	/** Test files each branch's integrations must keep passing. */
	tests: Record<string, string[]>;
	resolved: Record<string, string[]>;
	moved: Record<string, string>;
	counter: number;
	log: string[];
	finished?: string;
	/** Explicit stop owns cleanup until it succeeds; session startup must not resume this run. */
	stopping?: boolean;
	/** Work of the chains a stop retired, by node; a restart starts each node from it (see Resume). */
	resume?: Record<string, Resume>;
}

/** A merge hook's failure in what the landing merge printed (git ignores a post-merge hook's exit status), else
 * undefined. concept's post-merge stops before it pushes main or starts verify-main when its final-tree regeneration
 * refuses an index that doesn't match HEAD; landings printed that and nobody saw it (2026-10-16). */
export function hookFailure(output: string): string | undefined {
	const lines = output.split("\n");
	const at = lines.findIndex(l => /^husky - \S+ script failed|^integrate: post-merge hook exited|^error: .*\bhook\b|failed; not (publishing|verifying)/i.test(l));
	return at < 0 ? undefined : lines.slice(Math.max(0, at - 8), at + 4).join("\n").slice(-3000);
}

/** For stop, after it retired the workers: each chain whose worker's branch survived with commits its destination
 * lacks. Before this a restart launched such a node from its collector's tip, without the kept branch (2026-10-16:
 * rehearse-scene-retirement-on-legacy-fixtures implement-1e → implement-1g). A refinement is discarded by stop, so it has none. */
export function resumeRecords(s: State): Record<string, Resume> {
	const out: Record<string, Resume> = { ...s.resume };
	for (const [slug, c] of Object.entries(s.chains)) {
		if (!c.handle || c.phase === "refine") continue;
		const into = c.into === s.cwd ? s.cwd : s.collectors[c.into]?.path ?? c.into;
		let head = "";
		try { head = git(into, "rev-parse", "--verify", "-q", "refs/heads/" + c.handle.handle); } catch { continue; }
		try { if (!head || isAncestor(into, head)) continue; } catch { continue; }
		out[slug] = { phase: c.phase === "integrate" ? "review" : c.phase, branch: c.handle.handle, head,
			base: c.base, setup: c.setup, drive: c.drive, skipDrive: c.skipDrive, note: c.note };
	}
	return out;
}

const repoRoot = (cwd: string) => resolve(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "..");
export const stateDir = (cwd: string) => join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "reconcile");
export const stateFile = (cwd: string, root: string) => join(stateDir(cwd), root + ".json");
export function assertThreadState(state?: State): void {
	if (state && state.backend !== "threads") throw new Error("Pre-cutover reconciler state: resume it with its original worker implementation; this checkout does not migrate workmux runs");
	if (state && (!isAbsolute(state.cwd) || !state.landed || !state.results || !state.landingOps || !state.refinements))
		throw new Error("Pre-ledger reconciler state for " + state.root + ": manually rebuild the landing ledger, reviewed results, pending landing operations and refinement attempts from the original run before restarting; no automatic migration or issue-blob inference is supported (" + state.cwd + ")");
}
/** Recover only the exact registered run/handle; absence of a receipt is not
 * authority to guess a worktree or stop another worker. Stop failure propagates. */
export async function stopRefinementWriter(state: GlobalRunState, attempt: RefinementAttempt): Promise<void> {
	const found = await findWorker(attempt.worker ?? { run: state.root, handle: attempt.handle }, state.cwd);
	if (!found) {
		if (attempt.worker) throw new Error("Missing registered refinement writer: " + attempt.handle);
		return;
	}
	if (attempt.worker && resolve(attempt.worker.path) !== found.path) throw new Error("Refinement writer receipt mismatch: " + attempt.handle);
	const thread = (await bbThreads()).get(found.bb);
	if (thread && !thread.archivedAt) await stop({ run: state.root, handle: attempt.handle, path: found.path, bb: found.bb }, { cwd: state.cwd });
}

/** Every worker receipt a run holds. */
export function workerHandles(s: State): Handle[] {
	return [
		...Object.values(s.chains ?? {}).flatMap(c => [...(c.workers ?? []), ...(c.handle ? [c.handle] : [])]),
		...Object.values(s.exceptions ?? {}).flatMap(e => e.handler ? [e.handler] : []),
		...Object.values(s.landingOps ?? {}).flatMap(op => op.workers ?? []),
		...Object.values(s.refinements ?? {}).flatMap(a => a.worker ? [a.worker] : []),
		...(s.pr?.repair?.worker ? [s.pr.repair.worker] : []),
		...(s.pr?.repairHistory ?? []).flatMap(r => r.worker ? [r.worker] : []),
	];
}

export const resolutionsDir = (cwd: string, root: string) => join(stateDir(cwd), root + ".resolutions");
export function load(cwd: string, root: string): State | undefined {
	const f = stateFile(cwd, root);
	return existsSync(f) ? withEmptyLedger(JSON.parse(readFileSync(f, "utf8"))) : undefined;
}
/** A pre-ledger state that provably has nothing to put in a ledger gets an empty one; any other stays refused by
 * assertThreadState. Nothing landed (no `landed` log line), no refinement ever launched, no chain reached review or
 * integration, and no collector: then no landing, reviewed result, landing operation or refinement attempt can be
 * missing. Supervisor sessions loaded before the ledger write such states for fresh roots (2026-10-12). */
function withEmptyLedger(state: State): State {
	if (state.backend !== "threads" || (state.landed && state.results && state.landingOps && state.refinements)) return state;
	if (state.landed || state.results || state.landingOps || state.refinements) return state;
	const log = state.log ?? [];
	// The log keeps its last 400 lines: a full one may have dropped a landing.
	if (log.length >= 400 || log.some(l => / landed | \(refine, /.test(l))) return state;
	if (Object.keys(state.collectors ?? {}).length || Object.keys(state.tests ?? {}).length) return state;
	if (Object.values(state.chains ?? {}).some(c => c.phase !== "implement" && c.phase !== "drive" || c.refinement)) return state;
	return { ...state, landed: {}, results: {}, landingOps: {}, refinements: {} };
}

/** Serialize the loop and owner writes so neither loses constraints or an in-progress stop. */
export function updateState(cwd: string, root: string, change: (prior: State | undefined) => State): State {
	const file = stateFile(cwd, root);
	mkdirSync(stateDir(cwd), { recursive: true });
	// SQLite supplies a process-shared, crash-released write lock; the public state stays JSON.
	const lock = new Database(file + ".lock.sqlite", { create: true });
	let s: State;
	try {
		lock.exec("PRAGMA busy_timeout = 5000");
		s = lock.transaction(() => {
			const s = change(load(cwd, root));
			writeFileSync(file + ".tmp", JSON.stringify(s, null, 1));
			renameSync(file + ".tmp", file);
			return s;
		}).immediate();
	} finally { lock.close(); }
	// Every phase change, landing, failed integration and exception is saved through here.
	try { writeStatus(s.cwd); } catch (e) { console.log("STATUS.md not written: " + e); }
	return s;
}

export function saveState(s: State): void {
	updateState(s.pr && existsSync(s.pr.path) ? s.pr.path : s.cwd, s.root, prior => {
		s.constraints = prior?.constraints ?? s.constraints;
		s.stopping = prior?.stopping ?? s.stopping;
		return s;
	});
}

/** Read at launch, including after checkout preparation, rather than caching at the preceding phase. */
export function constrainedPrompt(cwd: string, root: string, node: string, prompt: string): string {
	const constraints = load(cwd, root)?.constraints?.[node] ?? [];
	return constraints.length ? prompt + "\n\nConstraints from the supervisor (apply throughout this node's work):\n\n" + constraints.join("\n\n") : prompt;
}

const finished = (i: Issue) => i.satisfied;
const descends = (i: Issue, slug: string, view: Map<string, Issue>) => { for (let p = i.partOf; p; p = view.get(p)?.partOf ?? null) if (p === slug) return true; return false; };
const yaml = (v: unknown) => "```json\n" + JSON.stringify(v ?? null, null, 1) + "\n```";

export interface StartOptions {
	cwd: string; root: string; owner: string; ownerSession?: string; budget: number;
	land?: LandingMode;
	/** Scratch observation uses the same lifecycle, with no live GitHub calls. */
	prHost?: PullRequestHost;
}

/** Called before spawning/publication as well as by foreground run. */
export function prepareStart(o: StartOptions): State {
	const prior = load(resolve(o.cwd), o.root);
	assertThreadState(prior);
	const cwd = prior?.cwd ?? resolve(o.cwd);
	if (prior?.stopping) throw new Error("cleanup in progress for " + o.root + ": retry stop to finish it");
	const land = resolveLanding(cwd, o.land, prior);
	if (prior && !prior.finished && prior.pid && prior.pid !== process.pid && pidAlive(prior.pid)) return prior;
	const s: State = prior ?? { backend: "threads", root: o.root, cwd, owner: o.owner, budget: o.budget,
		land, landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: {}, exceptions: {},
		tests: {}, resolved: {}, moved: {}, counter: 0, log: [] };
	saveState(s);
	prepareStaging(s, o.prHost ?? createPullRequestHost(), () => saveState(s), resolve(o.cwd));
	return s;
}

export async function run(o: StartOptions & { signal?: AbortSignal }) {
	const s = prepareStart(o);
	const cwd = s.cwd;
	const controlCwd = s.pr?.path ?? cwd;
	process.chdir(controlCwd);
	mkdirSync(stateDir(controlCwd), { recursive: true });
	mkdirSync(resolutionsDir(controlCwd, o.root), { recursive: true });
	// One reconciler per subtree: a second would launch and judge the same workers against the first.
	const lock = join(stateDir(controlCwd), o.root + ".lock");
	try { mkdirSync(lock); }
	catch {
		let pid = 0; try { pid = Number(readFileSync(join(lock, "pid"), "utf8")); } catch {}
		let alive = false; try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
		if (alive && pid !== process.pid) throw new Error("reconciler for " + o.root + " already running as pid " + pid);
	}
	writeFileSync(join(lock, "pid"), String(process.pid));
	process.on("exit", () => { try { if (readFileSync(join(lock, "pid"), "utf8") === String(process.pid)) rmSync(lock, { recursive: true, force: true }); } catch {} });
	for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => process.exit(0));
	Object.assign(s, { owner: o.owner, ownerSession: o.ownerSession ?? s.ownerSession, budget: o.budget, pid: process.pid, finished: undefined });
	const save = () => saveState(s);
	const note = (line: string) => { s.log.push(new Date().toISOString().slice(0, 19) + " " + line); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); console.log(line); };
	// To a worker as a queued bb message: it follows the turn in progress, or starts one on an idle thread.
	const sendChild = (h: Handle, body: string) => tell(h, body.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""), { cwd: controlCwd });
	// The owner is a bb thread. One that has closed hands over to whichever thread holds the supervisor role on the desk.
	// Told in order, off the tick; the run waits for the last before it ends. Notices that pile up while the owner is
	// busy fold into one queued message, so they cost it one turn rather than one each.
	let told: Promise<void> = Promise.resolve();
	const tellOwner = (body: string) => {
		told = told.then(async () => {
			const live = new Set([...await bbThreads()].filter(([, t]) => !t.archivedAt).map(([id]) => id));
			const supervisor = roleThread("supervisor", controlCwd);
			const to = live.has(s.owner) ? s.owner : supervisor && live.has(supervisor) ? supervisor : s.owner;
			const prefix = "[reconcile " + s.root + "] ";
			await tellBbFolded(to, prefix, prefix + body);
		}).catch(e => note("telling the owner failed: " + e));
	};
	save();

	// --- observation -----------------------------------------------------------------------------------
	const pathOf = (into: string) => into === cwd ? cwd : s.collectors[into]?.path ?? into;
	// BB starts pi from its daemon environment, not ours. Export the same committed
	// CLI into each worker's launch.env so native writes cannot fall back to an installed copy.
	process.env.TRACKER_CLI ??= pinTracker();
	const tracker = await untilReset(() => reconcilerTracker(controlCwd, s.root), { note, signal: o.signal });
	if (tracker.githubIssue) {
		s.githubRepository = (await untilReset(() => tracker.githubIssue!(s.root), { note, signal: o.signal })).repository;
		if (s.pr && s.pr.repository.toLowerCase() !== s.githubRepository.toLowerCase())
			throw new Error("Tracker repository differs from captured PR repository");
		save();
	}
	const destination = () => s.pr?.path ?? cwd;
	const snapshot = () => {
		try { return tracker.snapshot(); }
		catch (e) { throw e instanceof GithubRateLimited ? e : new Error("tracker snapshot failed in " + cwd + " (fix the tracker; the reconciler resumes by itself): " + String((e as Error)?.message ?? e).replace(/^error:\s*/, "")); }
	};
	const view = (into: string): Map<string, Issue> => {
		const attempts = Object.values(s.refinements).filter(a => a.phase !== "accepted" && a.phase !== "removed");
		// Dispatch passes a checkout path; collector progress is keyed by its logical issue.
		const logicalInto = Object.entries(s.collectors).find(([, collector]) => collector.path === into)?.[0] ?? into;
		// A landing into an enclosing collector counts here once this destination contains its head.
		const inherited = new Set(Object.entries(s.landed)
			.filter(([, entry]) => entry.into !== logicalInto && isAncestor(pathOf(logicalInto), entry.head))
			.map(([slug]) => slug));
		return schedulingView(snapshot(), { root: s.root, into: logicalInto, landed: s.landed, inherited,
			attemptClaims: new Set(attempts.map(a => a.claim)),
			withheld: new Set(attempts.flatMap(a => a.owned)), explicit: true });
	};
	const completion = { state: s, tracker, save, pathOf, locked };
	const refinement = { state: s, tracker, save, locked, stopWriter: (attempt: RefinementAttempt) => stopRefinementWriter(s, attempt) };
	// Latest turn report per worker topic, read from each worker's bb thread after the last turn seen.
	const reports = new Map<string, TurnReport>();
	const seen = new Map<string, number>();
	const repoDir = git(controlCwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), repoOf = new Map<string, boolean>();
	const inRepo = (path: string) => {
		if (!existsSync(path)) return true; // a retired worker's checkout is gone: its run-titled thread still counts
		let hit = repoOf.get(path);
		if (hit === undefined) { try { hit = git(path, "rev-parse", "--path-format=absolute", "--git-common-dir") === repoDir; } catch { return false; } repoOf.set(path, hit); }
		return hit;
	};
	const pollTurns = async () => {
		// Every live bb thread titled <run>/<handle> in this repository, receipted or not: a retired worker's late report still arrives.
		for (const [bb, thread] of host ?? []) {
			if (thread.archivedAt || !thread.environmentPath || !thread.title?.startsWith(s.root + "/") || !inRepo(thread.environmentPath)) continue;
			const handle = thread.title.slice(s.root.length + 1);
			const report = await lastTurn(bb, seen.get(bb) ?? 0).catch(e => { note("reading " + handle + " failed: " + String(e).split("\n")[0]); return undefined; });
			if (!report) continue;
			seen.set(bb, report.seq);
			reports.set(s.root + "/" + handle, report);
		}
	};
	const fresh = (h: Handle | undefined, after?: string, launchedAt?: number) => {
		if (!h) return undefined;
		const m = reports.get(topic(h));
		if (!m) return undefined;
		const ts = Date.parse(m.ts);
		if (launchedAt && ts < launchedAt) return undefined;
		if (after && m.ts <= after) return undefined;
		return m;
	};
	/** bb's threads as of the last tick; a worker is found in them by the bb thread id its receipt holds. */
	let host: Map<string, BbThread> | undefined;
	const observeHost = async () => {
		try { host = await bbThreads(); }
		catch (e) { host = undefined; note("thread observation deferred: " + e); }
	};
	const bbThread = (h: Handle) => h.bb ? host?.get(h.bb) : undefined;
	const alive = (h: Handle): boolean | undefined => {
		if (!host) return undefined; // backend failure never establishes exit
		// bb may release an idle worker's pi without ending it: only bb's state counts.
		const thread = bbThread(h);
		return !!thread && !thread.archivedAt;
	};
	/** Whether an idle worker's pi still runs a managed process. The process tool starts each as a process-group leader
	 * under pi with stdin closed (/dev/null); pi's MCP servers lead groups too but read a pipe, and an idle worker runs
	 * no bash tool. Undefined when that can't be observed: only a definite false counts. */
	const runsProcess = (h: Handle): boolean | undefined => {
		const thread = bbThread(h), pi = h.bb ? readLive().find(l => l.thread === h.bb)?.pid : undefined;
		if (!pi || !thread || thread.archivedAt || bbWorking(thread)) return undefined;
		try {
			const leaders = execFileSync("ps", ["-axo", "pid=,ppid=,pgid="], { encoding: "utf8" }).split("\n").map(l => l.trim().split(/\s+/).map(Number)).filter(([pid, ppid, pgid]) => ppid === pi && pid === pgid).map(([pid]) => pid);
			return leaders.some(pid => { try { return /^n\/dev\/null$/m.test(execFileSync("lsof", ["-a", "-p", String(pid), "-d", "0", "-Fn"], { encoding: "utf8" })); } catch { return true; } });
		} catch { return undefined; }
	};

	// --- launching -------------------------------------------------------------------------------------
	// Launches in flight count too: visit() fans siblings out with Promise.all, and each checks the budget
	// before any handle is assigned. launch() takes its slot synchronously, before its first await.
	let launching = 0;
	const live = () => launching + (s.pr?.repair?.worker ? 1 : 0) + Object.values(s.chains).filter(c => c.handle && !c.held).length + Object.values(s.exceptions).filter(e => e.handler).length;
	const pinned = (assignee: string | null | undefined) => /\bagent:([a-z0-9-]+)/.exec(assignee ?? "")?.[1];
	async function pick(role: string, issue: Issue | undefined, text: string, only?: string[]): Promise<string> {
		const pin = role === "implement" ? pinned(issue?.assignee) : undefined;
		if (pin) return pin;
		const names = only ? only.filter(name => stance(name)) : byRole(role).map(a => a.name);
		if (!names.length) throw new Error("no agent fills role " + role);
		if (names.length === 1) return names[0];
		try {
			const d = await decide({ role, issue: text.slice(0, 8000) }, { agent: { type: "choice", instructions: "Which stance should take this " + role + " assignment?",
				criteria: Object.fromEntries(names.map(n => [n, stance(n)?.description ?? n])) } });
			return d.agent.choice;
		} catch (e) { note("stance decision unavailable, using " + names[0] + ": " + e); return names[0]; }
	}
	async function launch(handle: string, role: string, prompt: string, base: string, into: string, issue?: Issue, only?: string[], prepare?: (cwd: string) => Promise<string | void>, refining?: { chain: Chain; adopt: boolean }): Promise<Handle> {
		launching++;
		try {
			if (tracker.githubIssue && issue && (role === "refine" || role === "implement")) {
				const current = view(into).get(issue.slug);
				const prior = refining?.chain.refinement && s.refinements[refining.chain.refinement];
				// A saved writer may have provisional children withheld from the frontier.
				const resuming = prior && !["accepted", "removed"].includes(prior.phase);
				const agentReady = current?.assignee === "agent" || current?.assignee?.startsWith("agent:") || current?.assignee?.startsWith("model:");
				if (!current || !agentReady || current.claims.length || (!resuming && !current.frontier))
					throw new Error("GitHub node is not ready, agent-eligible and unclaimed: " + issue.slug);
				if (tracker.fields(issue.slug)["claimed-by"] !== "reconcile:" + s.root)
					tracker.update(issue.slug, { "claimed-by": "reconcile:" + s.root });
			}
			// Concurrent launches race on .git/config's lock (ab-parent, setup's mise); a failed attempt may leave
			// its worktree behind, so a retry takes a fresh handle.
			for (let attempt = 0; ; attempt++) {
				const actual = attempt ? handle.slice(0, 86) + "-r" + attempt : handle;
				if (refining) {
					refining.chain.phase = "refine";
					const old = refining.chain.refinement;
					if (old && old !== actual && !["accepted", "removed"].includes(s.refinements[old].phase))
						await replaceRefinement(refinement, old, actual, refining.adopt && attempt === 0);
					else beginRefinement(refinement, issue!.slug, actual);
					refining.chain.refinement = actual;
					save();
				}
				const claimed = (text: string) => refining ? text + "\n\nCreate provisional children through the tracker with this exact claimed-by token, atomically with part-of: " + s.refinements[actual].claim : text;
				try {
					const worker = await launchNow(actual, role, claimed(prompt), base, into, issue, only,
						async path => claimed(await prepare?.(path) ?? prompt));
					if (refining) {
						s.refinements[actual].worker = worker;
						refining.chain.handle = worker;
						refining.chain.launchedAt = Date.now();
						save();
					}
					return worker;
				}
				catch (e) {
					if (refining) {
						await discardRefinement(refinement, actual);
						const found = await findWorker({ run: s.root, handle: actual }, controlCwd);
						if (found) await retire({ run: s.root, handle: actual, path: found.path, bb: found.bb }, { cwd: controlCwd });
					}
					const lock = /could not lock config file|config\.lock|index\.lock|File exists/i.test(String(e));
					if (!lock || attempt >= 3) throw e;
					note("launch " + handle + " hit a git lock, retrying: " + String(e).split("\n")[0]);
					await Bun.sleep(2000 + Math.random() * 3000);
				}
			}
		} finally { launching--; }
	}
	async function launchNow(handle: string, role: string, prompt: string, base: string, into: string, issue?: Issue, only?: string[], prepare?: (cwd: string) => Promise<string | void>): Promise<Handle> {
		const restrict = (text: string) => issue ? constrainedPrompt(controlCwd, s.root, issue.slug, text) : text;
		const agentName = await pick(role, issue, restrict(prompt), only);
		// Starting a reconciler on a root delegates the root: a goal root rarely names an assignee, and its own stage
		// (the joins between its children) is the last step of the tree it was handed. A non-root node is only
		// frontier when agent-assigned; an explicit human or session assignee still refuses.
		if (!tracker.githubIssue && issue && issue.slug === s.root && !issue.assignee?.trim()) issue = { ...issue, assignee: "agent" };
		const r = await dispatch([{ handle, prompt: restrict(prompt), agent: agentName, role, base, prepare: async path => restrict(await prepare?.(path) ?? prompt), ...((role === "implement" || role === "refine") && issue ? { issue: issue.slug, assignee: role === "refine" && pinned(issue.assignee) ? "agent" : issue.assignee ?? undefined } : {}) }],
			{ run: s.root, cwd: into, maxConcurrent: 1, active: [], parent: s.ownerSession || undefined });
		if (!r.submitted[0]) throw new Error("launch " + handle + ": " + (r.failed?.error ?? "not submitted"));
		note("launched " + handle + " (" + role + ", " + agentName + ")");
		return r.submitted[0];
	}
	// Saved before the launch: a crash mid-launch must not hand the same name (and its leftover worktree) out again.
	const nextHandle = (slug: string, kind: string) => { const h = (slug + "-" + kind + "-" + (++s.counter).toString(36)).slice(0, 90); save(); return h; };
	const ticketText = (i: Issue) => "Issue " + i.slug + ":\n\n" + tracker.text(i.slug);
	/** Current global metadata, not a worker branch copy. */
	const driveNone = (i: Issue): string | undefined => tracker.fields(i.slug).drive === "none" ? "the ticket declares `drive: none`" : undefined;
	const skippedDrive = (why: string) => "Drive was skipped (" + why + "): there is no driver's packet, and you are the only pass before integration. Review the change against the ticket directly, and check the implementer's own evidence (rehearsals, runs) rather than redoing it. Your handoff still needs `stories` and `evidence`; commit an index under docs/attachments/ that records what established each story. Say in `caveats` that drive was skipped, and which post-landing gate carries the acceptance and who owns it, as the ticket names them.";
	/** Commit what a replaced worker left uncommitted before its successor's base is read. Retirement saved it too, but
	 * only after the successor launched, so the WIP commit missed it (2026-10-16: quiesce-scene-source-delivery-writers,
	 * implement-s's 11081c1e not in implement-t). */
	function saveWip(h: Handle) {
		try {
			if (!git(h.path, "status", "--porcelain")) return;
			git(h.path, "add", "-A");
			git(h.path, "-c", "commit.gpgsign=false", "commit", "--no-verify", "-q", "-m", "WIP: uncommitted work of " + h.run + "/" + h.handle + " when it was replaced\n\nSaved by the reconciler so its successor starts from it; not reviewed.");
			note("saved " + h.handle + "'s uncommitted work as WIP commit " + git(h.path, "rev-parse", "--short", "HEAD") + " for its successor");
		} catch (e) { note("saving " + h.handle + "'s uncommitted work failed (retirement retries it): " + e); }
	}
	/** finished: the previous worker reported done and this phase takes its work, so its ignored files are disposable,
	 * except a driver's, which the reviewer may need. Any other replacement (relaunch, provider error, owner retry) moves
	 * ignored state aside on retirement. */
	async function startPhase(slug: string, c: Chain, phase: Phase, issue: Issue, issues: Map<string, Issue>, extra = "", adopt = false, resumeAttempt?: string, finished = false) {
		// The attempt being replaced stops first, so nothing it commits afterwards misses the new base; it's
		// retired once its successor launched (its branch stays if it holds commits not yet integrated).
		const prev = c.handle;
		if (prev && existsSync(prev.path)) { await stop(prev, { cwd: pathOf(c.into) }); saveWip(prev); }
		// A retired worker (keepBranch) leaves no worktree but its branch still holds the chain's work so far.
		const kept = (h: Handle) => { try { return git(pathOf(c.into), "rev-parse", "--verify", "-q", "refs/heads/" + h.handle); } catch { return ""; } };
		const base = (c.handle && existsSync(c.handle.path) ? git(c.handle.path, "rev-parse", "HEAD") : c.handle && kept(c.handle)) || c.resumeFrom || git(pathOf(c.into), "rev-parse", "HEAD");
		if (c.handle && !existsSync(c.handle.path) && phase !== "refine" && phase !== "implement" && base === git(pathOf(c.into), "rev-parse", "HEAD")) note("no worktree or branch for " + c.handle.handle + "; " + phase + " for " + slug + " starts from " + c.into + ", without the chain's earlier work");
		if ((phase === "refine" || phase === "implement") && !c.base) c.base = git(pathOf(c.into), "rev-parse", "HEAD");
		const phasePrompt = () => {
			const contract = ticketText(issue);
			if (phase === "refine" || phase === "implement") return [contract,
				c.self ? "Its children are all satisfied and integrated in your base. What remains is its own stage: residual work and the joins between its children. Don't redo the children." : "",
				phase === "implement" ? "Your base: " + c.base : "", c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
			if (phase === "drive") return [contract, "Setup handoff from the implementer:\n" + yaml(c.setup), c.self ? "Drive this node's own stories: journeys that cross its children. The children's own stories were driven already; if the node has none beyond theirs, report `stories: []`." : "", c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
			return [contract, "The change: git diff " + c.base + "..HEAD in your worktree.", "Driver's handoff:\n" + yaml(c.drive), c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
		};
		// A join's review is tidy's: crossing stories at their seams, then structure across the children.
		const only = phase === "review" && c.self ? ["tidy", ...((c.drive as any)?.evidence?.visual ? ["visual-reviewer"] : [])] : undefined;
		const launchedAt = Date.now();
		const handle = await launch(resumeAttempt ?? nextHandle(slug, phase), phase, phasePrompt(), base, pathOf(c.into), issue, only, async path => {
			// Handler rulings land in the collector, not the preceding worker. Merge before setup and before
			// reading the successor's ticket; a rebase here could replay patch-equivalent ancestor work.
			const refreshed = refreshWorker(path, pathOf(c.into));
			return [phasePrompt(), refreshed.conflicts.length ? "First resolve the pending merge of collector " + refreshed.head + ": " + refreshed.conflicts.join(", ") + ". Preserve the collector's code and the previous worker's results, then commit the merge before continuing this phase. The ticket above is the current global contract. Do not abort the merge or rebase away either history. Setup was skipped because it can't run over conflict markers: after committing the merge, run the project's setup (mise run setup, where it declares one) before anything that needs it." : ""].filter(Boolean).join("\n\n");
		}, phase === "refine" ? { chain: c, adopt } : undefined);
		// A finished drive's ignored state (its scanned local database, .wm/ output) is the reviewer's evidence: kept aside.
		if (prev && !await retireHandle(prev, pathOf(c.into), finished && phase !== "review", finished)) c.workers.push(prev);
		Object.assign(c, { phase, handle, launchedAt, handledTs: undefined, resumeFrom: undefined });
		c.retries = { integrate: c.retries.integrate ?? 0, provider: c.retries.provider ?? 0 };
		save();
	}

	// --- exceptions ------------------------------------------------------------------------------------
	/** Provider errors no handler can fix (credentials, quota) go to the owner, grouped by class. */
	const errorClass = (body: string) => /invalid_grant|oauth|refresh token|unauthori[sz]ed|\b401\b|\b403\b|api key|authentication/i.test(body) ? "authentication"
		: /\b429\b|rate.?limit|quota|usage limit|overloaded|\b529\b/i.test(body) ? "rate limit or quota" : body.replace(/^error:\s*/, "").split("\n")[0].slice(0, 80);
	function raise(slug: string, reason: string, text: string, issues: Map<string, Issue>, at?: "owner") {
		const c = s.chains[slug];
		if (c) c.held = true;
		if (s.exceptions[slug]) return;
		dropResolution(slug);
		const parent = issues.get(slug)?.partOf;
		const level = at ?? (slug === s.root || !parent ? "owner" : parent);
		s.exceptions[slug] = { id: slug + "-" + Date.now().toString(36), node: slug, reason, text: text.slice(-6000), at: new Date().toISOString(), level, reportTs: c?.handledTs };
		note("exception " + slug + ": " + reason + " → " + level + (reason === "reconciler error" ? "\n" + text.slice(0, 2000) : ""));
		save();
	}
	/** A queued resolution answers the exception pending when it was queued, never a later one. */
	const dropResolution = (node: string) => rmSync(join(resolutionsDir(controlCwd, s.root), node + ".json"), { force: true });
	type Resolution = { action: "answer" | "retry" | "redispatch" | "move-out" | "escalate" | "skip-drive" | "reopen"; target?: string; message?: string; note?: string; summary?: string; adopt?: boolean; refinement?: string };
	/** Bind an owner retry to its original attempt before any replacement writes.
	 * Recovery can finish that replacement before replaying the resolution file. */
	function readResolution(file: string, node: string): Resolution {
		const r = JSON.parse(readFileSync(file, "utf8")) as Resolution;
		const target = r.target && s.chains[r.target] ? r.target : node;
		if (r.action === "retry" && !r.refinement && s.chains[target]?.phase === "refine") {
			r.refinement = s.chains[target].refinement;
			const tmp = file + ".tmp";
			writeFileSync(tmp, JSON.stringify(r)); renameSync(tmp, file);
		}
		return r;
	}
	async function applyResolution(ex: Exception, r: Resolution, issues: Map<string, Issue>) {
		if (s.pr && s.landed[s.root] && ex.node === s.root) return resolvePr(ex, r);
		const target = r.target && s.chains[r.target] ? r.target : ex.node;
		const c = s.chains[target];
		if (r.action === "retry" && r.refinement && s.refinements[r.refinement]?.successor) {
			delete s.exceptions[ex.node];
			if (c) c.held = false;
			// The saved replacement (including partial adoption) is recovered by
			// tick before resolutions; do not replace its successor a second time.
			return save();
		}
		const issue = view(c?.into ?? cwd).get(target);
		(s.resolved[ex.node] ??= []).push(ex.reason + " → " + r.action + (r.message ? ": " + r.message : r.note ? ": " + r.note : r.summary ? ": " + r.summary : ""));
		if (r.action === "escalate") {
			const up = ex.level === "owner" ? undefined : issues.get(ex.level)?.partOf;
			ex.level = ex.level === "owner" || ex.level === s.root || !up ? "owner" : up;
			ex.text += "\n\nEscalated by the handler: " + (r.summary ?? r.message ?? "(no summary)");
			Object.assign(ex, { handler: undefined, handlerLaunchedAt: undefined, handlerHandledTs: undefined, mailed: false });
			note("escalated " + ex.node + " → " + ex.level);
			return save();
		}
		if (r.action === "reopen") {
			try { await reopenJoin(target, c, r.note ?? r.message); }
			catch (e) {
				// The exception stays for another resolution: a throw here would fail every tick on the same file.
				dropResolution(ex.node);
				note("reopen of " + target + " failed: " + String((e as Error)?.message ?? e).split("\n")[0]);
				tellOwner("reopen of " + target + " failed; its exception stays pending, resolve it another way or fix and reopen again:\n\n" + String((e as Error)?.message ?? e).slice(0, 3000));
				return save();
			}
		}
		delete s.exceptions[ex.node];
		if (ex.node !== target && s.chains[ex.node]) s.chains[ex.node].held = false;
		// A resolution restarts any wait: else a `waiting stalled` exception re-raises on the next tick.
		if (c) { c.waitingSince = undefined; c.waitingCheckedAt = undefined; c.waitingVoidNudged = undefined; }
		if (r.action === "answer" && c?.handle && alive(c.handle) !== false) { await sendChild(c.handle, r.message ?? r.note ?? ""); c.held = false; c.handledTs = ex.reportTs ?? c.handledTs; }
		else if (r.action === "answer" || r.action === "retry") { if (c) { c.held = false; c.note = r.message ?? r.note; if (!issue) throw new Error("resolution target " + target + " is not in the global tracker"); await startPhase(target, c, c.phase === "integrate" ? "review" : c.phase, issue, issues, "", r.action === "retry" && r.adopt === true); } }
		else if (r.action === "redispatch") {
			// A redispatch starts over from the parent's head; the superseded chain's commits stay on its kept branch,
			// which the new implementer is told about rather than silently missing (2026-10-12: it had to ask for them).
			const kept = c?.handle ? keptWork(c) : undefined;
			if (c) { await retireChain(c); delete s.chains[target]; }
			s.resolved[target] ??= [];
			pendingNotes.set(target, [r.note ?? r.message, kept].filter(Boolean).join("\n\n") || undefined);
		}
		else if (r.action === "skip-drive") {
			if (c) {
				c.held = false; c.skipDrive = r.note ?? r.message ?? "skipped by the supervisor";
				if (c.phase === "drive") await startPhase(target, c, "review", issue!, issues, skippedDrive(c.skipDrive));
			}
		}
		else if (r.action === "move-out") { if (c) { await retireChain(c); delete s.chains[target]; } tracker.moveOut?.(target, r.summary ?? r.note ?? ex.reason); releaseRefinementClaims(refinement, target); dropResolution(target); s.moved[target] = r.summary ?? r.note ?? ex.reason; tellOwner("moved out " + target + ": " + s.moved[target]); }
		note("resolved " + ex.node + ": " + r.action + (target !== ex.node ? " on " + target : ""));
		save();
	}
	/** PR exceptions operate on the receipt, never redispatch the satisfied tree. */
	async function resolvePr(ex: Exception, r: Resolution): Promise<void> {
		const pr = s.pr!;
		if (!["answer", "retry", "redispatch"].includes(r.action))
			throw new Error("PR landing accepts answer/retry/redispatch; stop preserves the published PR");
		(s.resolved[ex.node] ??= []).push(ex.reason + " → " + r.action + ": " + (r.note ?? r.message ?? ""));
		const worker = pr.repair?.worker;
		if (r.action === "answer" && worker && alive(worker) !== false)
			await sendChild(worker, r.message ?? r.note ?? "");
		else if (pr.repair) {
			if (worker && !await retireHandle(worker, pr.path)) throw new Error("PR repair retirement failed");
			pr.repair.worker = undefined;
			pr.repair.launchedAt = undefined;
			pr.repair.handledTs = undefined;
			pr.repair.launchHandle = undefined;
			pr.integrationFailures = 0;
			pr.repair.handoff = undefined;
			pr.repair.preparedHead = undefined;
			pr.repair.integratedHead = undefined;
			pr.repair.pushedHead = undefined;
			pr.repair.retiredAt = undefined;
			pr.repair.request.message += "\n\nOwner resolution: " + (r.note ?? r.message ?? "retry");
			pr.phase = "repairing";
		} else {
			pr.phase = pr.number ? "waiting" : "opening";
		}
		pr.lastPolledAt = undefined;
		delete s.exceptions[ex.node];
		save();
	}

	async function launchRepair(request: PrRepairRequest): Promise<Handle> {
		if (live() >= s.budget) throw new Error("PR repair exceeds run worker budget");
		const pr = s.pr!, issue = view(pr.path).get(s.root);
		const prompt = [issue ? ticketText(issue) : tracker.text(s.root),
			"Repair this run's PR from staging HEAD. Preserve published history; do not rebase or force-push.",
			"Repair request:\n" + yaml(request), "Saved reviewed results:\n" + yaml(s.results),
			"Retained tests:\n" + yaml(s.tests[pr.path] ?? []),
			"Run the project's existing integration gates. Commit the repair and report the full reviewed handoff.",
			"If this needs a product choice or scope expansion, report needs-input; do not choose for the owner.",
			"For review requests, include threadReplies: {<thread id>: <what changed>} for EVERY requested thread. Do not resolve threads.",
		].join("\n\n");
		const receipt = pr.repair!;
		if (!receipt.launchHandle) { receipt.launchHandle = nextHandle(s.root, "pr-repair"); save(); }
		const registered = await findWorker({ run: s.root, handle: receipt.launchHandle }, controlCwd);
		if (registered) return { run: s.root, handle: receipt.launchHandle, path: registered.path, bb: registered.bb };
		// Unlike tree dispatch, a PR launch never substitutes a fresh identity after
		// a partial failure. Retry adopts its exact bb thread or raises to owner.
		return launchNow(receipt.launchHandle, "review", prompt,
			git(pr.path, "rev-parse", "HEAD"), pr.path, issue, ["technical"]);
	}
	const pendingNotes = new Map<string, string | undefined>();
	/** The chain's committed work beyond its destination, as a note for a fresh start that doesn't take it as its base. */
	function keptWork(c: Chain): string | undefined {
		try {
			const h = c.handle!, into = pathOf(c.into);
			const head = existsSync(h.path) ? git(h.path, "rev-parse", "HEAD") : git(into, "rev-parse", "--verify", "-q", "refs/heads/" + h.handle);
			const ahead = Number(git(into, "rev-list", "--count", "HEAD.." + head));
			if (!ahead) return;
			return "The superseded attempt's " + ahead + " commit(s) are not in your base; they stay on branch " + h.handle + " at " + head + " (git log HEAD.." + head + "). Take what holds of them (merge or cherry-pick) or leave them, as the note above directs.";
		} catch { return; }
	}
	/** Drop an exception whose worker carries on, retiring the handler that holds it. */
	async function withdraw(ex: Exception, c: Chain, why: string) {
		const handler = ex.handler;
		if (handler) await retireHandle(handler, pathOf(s.collectors[ex.level] ? ex.level : c.into));
		if (s.exceptions[ex.node] === ex) delete s.exceptions[ex.node];
		dropResolution(ex.node); c.held = false; save();
		note("withdrew exception " + ex.node + " (" + ex.reason + "): " + why.split(".")[0] + (handler ? "; retired its handler " + handler.handle : ""));
		if (ex.mailed || ex.level === "owner" || handler) tellOwner("withdrew the exception for " + ex.node + " (" + ex.reason + "): " + why);
	}
	/** A report since the exception that shows the worker carrying on its assignment. A checkpoint doesn't: a worker held
	 * for checkpointing too often (author-and-publish-the-language-learning-template, 2026-10-12) kept posting them. */
	const resumedReport = (ex: Exception, c: Chain) => {
		const m = c.handle && fresh(c.handle, ex.reportTs ?? c.handledTs, c.launchedAt);
		return m && !m.tags.includes("error") && ["done", "blocked", "needs-input", "waiting"].includes(parse(m.body).status ?? "") ? m : undefined;
	};
	/** The exception's worker is working again, or reported since: someone (the owner, directly) set it going. */
	const carriesOn = (ex: Exception, c: Chain | undefined) => !!c?.handle && c.phase !== "refine" && alive(c.handle) !== false
		&& (observedWorking(c.handle) || !!resumedReport(ex, c));
	async function handleExceptions(issues: Map<string, Issue>) {
		// A resolution for a node with no exception is the owner steering a live chain (e.g. one stuck where no report
		// reached us): apply it to the chain, or drop it with a reason when there is none.
		for (const f of readdirSync(resolutionsDir(controlCwd, s.root)).filter(f => f.endsWith(".json"))) {
			const node = f.slice(0, -5);
			if (s.exceptions[node]) continue;
			const r = readResolution(join(resolutionsDir(controlCwd, s.root), f), node);
			if (!s.chains[node] || r.action === "escalate") { dropResolution(node); tellOwner("ignored " + r.action + " for " + node + ": it has no exception or running chain"); continue; }
			const ex: Exception = { id: node + "-owner-" + Date.now().toString(36), node, reason: "owner " + r.action, text: "", at: new Date().toISOString(), level: "owner", mailed: true, reportTs: s.chains[node].handledTs };
			s.exceptions[node] = ex;
			await applyResolution(ex, r, issues);
			dropResolution(node);
		}
		for (const ex of Object.values(s.exceptions)) {
			// The owner's resolution answers the exception wherever it is: no handler is launched for it, and one already
			// working is retired, rather than each enclosing level's handler re-reading it and escalating (2026-10-16).
			if (ex.level !== "owner" && existsSync(join(resolutionsDir(controlCwd, s.root), ex.node + ".json"))) {
				if (ex.handler) await retireHandle(ex.handler, s.collectors[ex.level]?.path ?? cwd);
				note("owner resolution for " + ex.node + " applies at " + ex.level + (ex.handler ? "; retired its handler " + ex.handler.handle : ""));
				Object.assign(ex, { level: "owner", handler: undefined, handlerLaunchedAt: undefined, handlerHandledTs: undefined, mailed: true });
				save();
			}
			if (ex.level === "owner") {
				// One mail per class: later workers stopped by the same provider error join the first's exception.
				const twin = ex.reason.startsWith("provider error: ") ? Object.values(s.exceptions).find(o => o !== ex && o.level === "owner" && o.reason === ex.reason && o.mailed) : undefined;
				if (!ex.mailed && twin) { ex.mailed = true; save(); tellOwner(ex.node + " also stopped on " + ex.reason + "; resolving " + twin.node + " resolves it too."); }
				if (!ex.mailed) {
					tellOwner("needs you: " + ex.node + " — " + ex.reason + "\n\n" + ex.text.slice(-3000) + "\n\nResolve with tools.reconcile_resolve({root: \"" + s.root + "\", node: \"" + ex.node + "\", action: answer|retry|redispatch|move-out|reopen, message?, note?, summary?}). A move-out you make in the tracker yourself; then resolve with move-out. reopen ends a join whose children reopened: its commits land in its collector as the reopened children's base, and the walk runs them.");
					ex.mailed = true; save();
				}
				const f = join(resolutionsDir(controlCwd, s.root), ex.node + ".json");
				// Removed only once applied: a crash midway replays it after restart.
				if (existsSync(f)) {
					const r = readResolution(f, ex.node);
					const same = ex.reason.startsWith("provider error: ") ? Object.values(s.exceptions).filter(o => o !== ex && o.level === "owner" && o.reason === ex.reason) : [];
					await applyResolution(ex, r, issues);
					for (const o of same) if (s.exceptions[o.node] === o) await applyResolution(o, { ...r, target: undefined }, issues);
					rmSync(f, { force: true });
				}
				continue;
			}
			const col = s.collectors[ex.level];
			if (!col) { ex.level = "owner"; save(); continue; }
			if (!ex.handler) {
				if (live() >= s.budget) continue;
				const here = view(ex.level);
				const parent = here.get(ex.level), node = here.get(ex.node);
				const prompt = () => [
					"Exception in the execution tree under " + ex.level + ", for " + ex.node + ": " + ex.reason,
					"Report and context:\n\n" + ex.text,
					parent ? "The node whose contract you hold:\n\n" + ticketText(parent) : "",
					node && node !== parent ? ticketText(node) : "",
					"State of its children:\n" + [...here.values()].filter(i => i.partOf === ex.level).map(i => "- " + i.slug + ": " + (finished(i) ? (i.done ? "done" : "satisfied here (awaiting target)") : s.exceptions[i.slug] ? "exception: " + s.exceptions[i.slug].reason : s.chains[i.slug] ? s.chains[i.slug].phase : "waiting")).join("\n"),
					s.resolved[ex.node]?.length ? "Earlier resolutions for " + ex.node + ":\n" + s.resolved[ex.node].map(l => "- " + l).join("\n") : "",
				].filter(Boolean).join("\n\n");
				try {
					ex.handlerLaunchedAt = Date.now();
					ex.handler = await launch(nextHandle(ex.level, "handler"), "handle", prompt(), git(col.path, "rev-parse", "HEAD"), col.path, undefined, undefined, async () => prompt());
					save();
				} catch (e) { note("handler launch failed: " + e); ex.level = "owner"; save(); }
				continue;
			}
			const m = fresh(ex.handler, ex.handlerHandledTs, ex.handlerLaunchedAt);
			if (!m) {
				if (bbErrored(ex.handler)) { const why = await bbError(ex.handler); await retireHandle(ex.handler, col.path); await applyResolution(ex, { action: "escalate", summary: "the handler errored in bb without resolving: " + why }, issues); }
				else if (Date.now() - (ex.handlerLaunchedAt ?? 0) > START_GRACE_MS && alive(ex.handler) === false) await applyResolution(ex, { action: "escalate", summary: "the handler died without resolving" }, issues);
				continue;
			}
			ex.handlerHandledTs = m.ts;
			const r = parse(m.body);
			const res = r.handoff?.resolution as Resolution | undefined;
			const handler = ex.handler;
			// Global rulings are already published; only permitted docs/evidence artifacts land.
			try {
				if (git(handler.path, "rev-list", "--count", git(col.path, "rev-parse", "HEAD") + "..HEAD") !== "0") {
					const outside = git(handler.path, "diff", "--name-only", git(col.path, "rev-parse", "HEAD") + "...HEAD").split("\n").filter(f => f && !f.startsWith("docs/"));
					if (outside.length) throw new Error("handler changed files outside docs/: " + outside.join(", "));
					await locked(() => integrate(handler, { cwd: col.path, keep: true }));
				}
			} catch (e) { await applyResolution(ex, { action: "escalate", summary: "handler's docs/evidence change could not land: " + e }, issues); await retireHandle(handler, col.path); continue; }
			await retireHandle(handler, col.path, r.status === "done");
			ex.handler = undefined;
			// A worker set going again while its handler deliberated (the owner told it to continue) is not retried,
			// redispatched or moved out from under that instruction: the 11:2x retry retired a drive told to continue (2026-10-16).
			const chain = s.chains[ex.node];
			if (chain && carriesOn(ex, chain)) {
				await withdraw(ex, chain, "its worker is working or reported again since, so the handler's " + (r.status === "done" && res?.action ? res.action : "escalation") + " was not applied. The handler said:\n\n" + (res?.summary ?? res?.message ?? res?.note ?? r.body.slice(-1500)));
				continue;
			}
			await applyResolution(ex, r.status === "done" && res?.action ? res : { action: "escalate", summary: res?.summary ?? r.body.slice(-1500) }, issues);
		}
	}

	// --- integration -----------------------------------------------------------------------------------
	const lockDir = join(stateDir(controlCwd), "integrate.lock");
	async function locked<T>(fn: () => Promise<T>): Promise<T> {
		for (;;) {
			try { mkdirSync(lockDir); writeFileSync(join(lockDir, "pid"), String(process.pid)); break; }
			catch (e) {
				if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
				// Another process may have made the lock and not yet written its pid: wait, unless that lock is stale.
				let pid = 0, made = Date.now();
				try { made = statSync(lockDir).mtimeMs; pid = Number(readFileSync(join(lockDir, "pid"), "utf8").trim() || 0); } catch { if (!existsSync(lockDir)) continue; }
				let dead = !pid && Date.now() - made > 10_000; try { if (pid) process.kill(pid, 0); } catch { dead = true; }
				if (dead) rmSync(lockDir, { recursive: true, force: true }); else await Bun.sleep(1000);
			}
		}
		try { return await fn(); } finally { rmSync(lockDir, { recursive: true, force: true }); }
	}
	/** finished: the worker reported done and its work was taken, so its ignored state is discarded; otherwise ignored state
	 * it alone holds is moved aside. done words the owner's notice for a finished worker whose state is kept anyway. */
	async function retireHandle(h: Handle, into: string, finished = false, done = finished): Promise<boolean> {
		try {
			const r = await retire(h, { cwd: into, discardIgnored: finished });
			for (const k of (r.removed as { kept?: { path: string; entries: string[] }[] } | undefined)?.kept ?? []) {
				note("retired " + h.handle + " keeping its ignored state at " + k.path + ": " + k.entries.join(", "));
				tellOwner("retired " + h.handle + (done ? " after it finished" : " before it finished") + "; its worktree held ignored state setup can't regenerate, moved to " + k.path + " (" + k.entries.join(", ") + "). See RETIRED.md there; delete it once nothing needs it. Declare regenerable paths with `git config --add wm.disposable <path>`.");
			}
			const wip = ((r.removed as { branchesKept?: { branch: string; reason: string }[] } | undefined)?.branchesKept ?? []).find(b => b.reason.startsWith("uncommitted work saved"));
			if (wip) { note("retired " + h.handle + " with uncommitted work: branch " + wip.branch + ", " + wip.reason); tellOwner("retired " + h.handle + " with uncommitted work in its worktree; it is kept on branch " + wip.branch + " (" + wip.reason + ")."); }
			return true;
		} catch (e) { note("retire " + h.handle + ": " + e); return false; }
	}
	/** Working by an observation of its pi (bb's status, or a live pi's own state), not inferred from admission. */
	const observedWorking = (h: Handle) => bbWorking(bbThread(h));
	/** bb's own failure for a worker (a thread.start or turn.submit that failed): pi never runs or reports, so nothing else notices. */
	const bbErrored = (h: Handle) => bbThread(h)?.status === "error";
	const bbError = async (h: Handle) => {
		let detail = "";
		try { detail = (await logBb(h.bb!)).split("── Error").slice(1).at(-1)?.replace(/^[─\s]+/, "").trim() ?? ""; } catch (e) { detail = "(bb thread log failed: " + e + ")"; }
		return "bb thread " + h.bb + " for " + h.handle + " is in error and its pi will not report:\n" + (detail || "(no error block in its log)");
	};
	async function retireChain(c: Chain, finished = false) {
		if (c.refinement && !["accepted", "removed"].includes(s.refinements[c.refinement].phase))
			await discardRefinement(refinement, c.refinement);
		for (const h of [...c.workers, ...(c.handle ? [c.handle] : [])]) await retireHandle(h, pathOf(c.into), finished);
	}
	/** Receipts outlive chains. A partial retirement/deletion is retried next tick. */
	async function cleanupLandings() {
		for (const operation of Object.values(s.landingOps)) {
			if (!s.landed[operation.slug] || !operation.landedHead || operation.cleanupDone) continue;
			try {
				for (const worker of operation.workers) {
					const result = await retire(worker, { cwd: controlCwd, discardIgnored: true });
					if (git(controlCwd, "branch", "--list", worker.handle) && result.branchKept)
						throw new Error(result.branchKept);
				}
				const col = operation.collector;
				if (col) {
					if (existsSync(col.path)) git(controlCwd, "worktree", "remove", col.path);
					if (git(controlCwd, "branch", "--list", col.branch)) git(controlCwd, "branch", "-D", col.branch);
					if (s.collectors[operation.slug]?.path === col.path) delete s.collectors[operation.slug];
				}
				finishLandingCleanup(completion, operation.slug);
			} catch (e) { note("landing cleanup " + operation.slug + " deferred: " + e); }
		}
	}
	async function land(slug: string, c: Chain, issue: Issue): Promise<string | undefined> {
		const into = pathOf(c.into), h = c.handle!;
		for (let told = false; (s.land ?? "local") === "local" && c.into === cwd; told = true) {
			const red = mainRed(cwd);
			if (!red || !heldByRed(red, git(h.path, "diff", "--name-only", git(into, "rev-parse", "HEAD") + "...HEAD").split("\n").filter(Boolean))) break;
			if (!told) { note("landing " + slug + " waits for a green main"); tellOwner("landing " + slug + " waits: main is red.\n\n" + red); }
			await Bun.sleep(60_000);
		}
		const before = git(into, "rev-parse", "HEAD");
		const result = s.results[slug];
		if (!result) throw new Error("No saved reviewed result for " + slug);
		const outcome = await landReviewed(completion, { slug, into: c.into, worker: h,
			workers: c.workers, collector: s.collectors[slug], result,
			tests: [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])] });
		if (!outcome.ok) return outcome.failure;
		s.tests[c.into] = [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])];
		const landed = git(into, "diff", "--name-only", before, outcome.head).split("\n").filter(Boolean);
		note("landed " + slug + " in " + (c.into === cwd ? "the owner's checkout" : c.into));
		const hook = outcome.output && hookFailure(outcome.output);
		if (hook) { note("landing " + slug + ": a merge hook failed: " + hook.split("\n")[0]); tellOwner("landed " + slug + " at " + git(into, "rev-parse", "--short", "HEAD") + ", but a merge hook failed; what it does after landing (a push, a verify) did not happen:\n\n" + hook); }
		if (slug === s.root && s.pr) { s.pr.preparedHead = outcome.head; s.pr.phase = "opening"; }
		delete s.chains[slug];
		save();
		await cleanupLandings();
		// Early overlap notices: siblings still implementing over the files that just landed rebase now.
		for (const [other, oc] of Object.entries(s.chains)) {
			if (oc.into !== c.into || oc.phase !== "implement" || !oc.handle || !existsSync(oc.handle.path) || !oc.base) continue;
			try {
				const touched = new Set([...git(oc.handle.path, "diff", "--name-only", oc.base).split("\n").filter(Boolean)]);
				const overlap = landed.filter(f => touched.has(f));
				if (overlap.length) await sendChild(oc.handle, "Sibling " + slug + " just landed touching files you changed: " + overlap.join(", ") + ". Commit, then rebase onto " + git(into, "rev-parse", "--short", "HEAD") + " (git rebase " + git(into, "rev-parse", "HEAD") + ") now and continue.");
			} catch (e) { note("overlap check " + other + ": " + e); }
		}
		return undefined;
	}

	// --- per-report steps ------------------------------------------------------------------------------
	async function repair(slug: string, c: Chain, key: string, message: string, issues: Map<string, Issue>, text: string) {
		c.retries[key] = (c.retries[key] ?? 0) + 1;
		if (c.retries[key] > BUDGET.repair) return raise(slug, key + " (after " + BUDGET.repair + " repairs)", text, issues);
		await sendChild(c.handle!, message);
		save();
	}
	async function onReport(slug: string, c: Chain, m: TurnReport, issues: Map<string, Issue>) {
		const issue = issues.get(slug)!;
		// Consecutive `waiting` reports are one wait: its stall clock runs from the first.
		const waitedSince = c.waitingSince, previousCursor = c.handledTs;
		// Save the successful refinement/review transition before consuming its report.
		c.handledTs = m.ts; c.waitingSince = undefined; c.waitingCheckedAt = undefined; c.waitingVoidNudged = undefined;
		const r = parse(m.body), text = m.body, h = c.handle!;
		if (c.phase === "integrate") { c.phase = "review"; }
		if (m.tags.includes("error")) {
			const kind = errorClass(text);
			// An error turn-end is not the worker's end: the first one continues the same session and worktree (a fresh
			// worker would retire them and what only they hold); a repeat, or a worker that is gone, gets a fresh worker once.
			const tries = c.retries.provider ?? 0;
			if (kind !== "authentication" && kind !== "rate limit or quota" && tries < 2) {
				c.retries.provider = tries + 1; save();
				if (!tries && alive(h) !== false) {
					note("provider error on " + slug + "; continuing the same " + c.phase + " worker: " + kind);
					await sendChild(h, "Your last turn ended on a provider error (" + kind + "), after pi's own retries. Continue the assignment where you left off.");
					return save();
				}
				note("provider error on " + slug + "; retrying " + c.phase + " with a fresh worker: " + kind);
				return startPhase(slug, c, c.phase, issue, issues);
			}
			if (c.phase === "refine" && c.refinement) await discardRefinement(refinement, c.refinement);
			return raise(slug, "provider error: " + kind, text, issues, "owner");
		}
		if (r.handoffError) return repair(slug, c, "handoff", "Your handoff block did not parse (" + r.handoffError + "). Repost your report with valid fenced yaml.", issues, text);
		if (r.status === null) return repair(slug, c, "status", "Your turn ended without a status. Continue the assignment; end with `done`, `blocked`, `needs-input`, `waiting` or `checkpoint` as the first line, then the handoff.", issues, text);
		if (c.phase === "implement" && !c.self && r.handoff?.respec) {
			c.retries.respec = (c.retries.respec ?? 0) + 1;
			if (c.retries.respec > 1) return raise(slug, "respec after refinement", text, issues);
			note("respec " + slug + ": back to refinement");
			await retireHandle(h, pathOf(c.into));
			c.handle = undefined; c.base = undefined;
			const kept = c.retries.respec;
			await startPhase(slug, c, "refine", issue, issues, "An implementer found this bigger than one session:\n\n" + String(r.handoff.respec));
			c.retries.respec = kept; return save();
		}
		// Idle until a process it started notifies it: nothing to do, and only a later report counts.
		if (r.status === "waiting") { c.waitingSince = waitedSince ?? m.ts; c.waitingCheckedAt = m.ts; note(c.phase + " " + slug + " waiting: " + text.split("\n").find(l => l.trim())?.slice(0, 200)); return save(); }
		// The worker's tracker CLI failed fast on the rate-limit hold and it gave up on it. That is no blocker for the owner
		// (and must not discard a refinement): send it back to rerun the command. Each hold is paced by its reset, so the
		// repair budget (two) is too small; the cap only ends a worker that keeps quoting the limit.
		if ((r.status === "blocked" || r.status === "needs-input") && text.includes(rateLimitMark)) {
			c.retries["tracker-rate-limit"] = (c.retries["tracker-rate-limit"] ?? 0) + 1;
			if (c.retries["tracker-rate-limit"] > 10) return raise(slug, "tracker rate limit (after 10 retries)", text, issues);
			note(c.phase + " " + slug + " reported the tracker rate limit as " + r.status + "; sending it back to retry");
			await sendChild(h, "The GitHub API rate limit is a hold, not a blocker. Rerun the same tracker command now; if it still names a reset time, wait until then and rerun it. Continue the assignment and report on its real outcome.");
			return save();
		}
		if (r.status === "blocked" || r.status === "needs-input") {
			if (c.phase === "refine" && c.refinement) await discardRefinement(refinement, c.refinement);
			return raise(slug, c.phase + " " + r.status, text, issues);
		}
		if (r.status === "checkpoint") return checkpoint(c, alive(h), BUDGET.checkpoint, {
			resume: async () => {
				note(c.phase + " " + slug + " checkpointed; continuing the same worker");
				await sendChild(h, "Continue from your checkpoint. This is the same session and worktree: everything you kept there (services' data, exports, local databases, ignored files) is as you left it. Re-read what remains in the ticket and carry on with the assignment.");
			},
			raise: reason => raise(slug, reason, text, issues),
			restart: () => startPhase(slug, c, c.phase, issue, issues, "Continue from the previous worker's checkpoint. Its worker is gone; its commits are in your base. Ignored state its worktree held (local databases, exports) is not in your worktree: retirement moved any such state aside and told the owner where:\n\n" + text.slice(-6000), true),
			save,
		});
		if (git(h.path, "status", "--porcelain")) return repair(slug, c, "dirty", "You reported done with uncommitted changes. Commit everything that belongs to the change, then report done again.", issues, text);
		if (c.phase === "refine") {
			if (!c.refinement) throw new Error("Refine chain has no saved attempt: " + slug);
			const children = r.handoff?.children;
			if (!Array.isArray(children) || children.some(child => typeof child !== "string"))
				return repair(slug, c, "refine", "Refinement handoff needs children: [slug, ...], or children: [] for promotion. Repost your report.", issues, text);
			// Collector creation saves state too; keep the report replayable until
			// acceptRefinement has persisted its independent report/transition.
			c.handledTs = previousCursor;
			const col = ensureCollector(slug, c.into);
			try {
				await acceptRefinement(refinement, c.refinement, { worker: h, children: children as string[],
					reportTs: m.ts, report: text, into: slug, destination: col.path });
			} catch (e) {
				c.handledTs = e instanceof GithubRateLimited ? previousCursor : m.ts;
				if (e instanceof GithubRateLimited) throw e;
				return repair(slug, c, "refine", "Refinement could not be accepted: " + e + ". Repair the global contract/stubs and repost your report.", issues, text);
			}
			return finishRefinement(slug, c);
		}
		if (c.phase === "implement") {
			if (!c.self && [...view(c.into).values()].some(i => i.partOf === slug && !finished(i)))
				return repair(slug, c, "decompose", "Implementers don't decompose: drop the children you committed, and either implement the ticket whole or end `blocked` with `respec` in the handoff.", issues, text);
			// Children landed earlier are satisfied in the collector, not at c.into: count only open ones there.
			const filed = c.self && s.collectors[slug] ? [...view(slug).values()].filter(i => i.partOf === slug && !finished(i) && !isMoved(i)).map(i => i.slug) : [];
			if (filed.length) return joinFiledChildren(slug, c, filed, issues, text);
			c.setup = r.handoff?.setup ?? null;
			c.note = undefined;
			c.skipDrive ??= driveNone(issue);
			if (c.skipDrive) { note("drive skipped for " + slug + ": " + c.skipDrive); return startPhase(slug, c, "review", issue, issues, skippedDrive(c.skipDrive), false, undefined, true); }
			return startPhase(slug, c, "drive", issue, issues, "", false, undefined, true);
		}
		if (c.phase === "drive") {
			const shape = storyShapeError(r.handoff, c.self) ?? (r.handoff?.evidence !== undefined ? evidenceShapeError(r.handoff) : null);
			if (shape) return repair(slug, c, "drive-shape", "Your handoff is malformed: " + shape + ". Repost it.", issues, text);
			c.drive = r.handoff!;
			c.note = undefined;
			return startPhase(slug, c, "review", issue, issues, "Driver's final message:\n\n" + text.slice(-4000) + "\n\nThe driver's worktree is retired as you start. Ignored state it held (local databases it scanned, its .wm/ output and process logs) is moved to " + resolve(repoRoot(controlCwd) + "__retired", basename(h.path)) + "/ (a timestamped sibling if that exists); RETIRED.md there lists it.", false, undefined, true);
		}
		// review
		const shape = storyShapeError(r.handoff, c.self) ?? (c.self && r.handoff?.evidence === undefined ? null : evidenceShapeError(r.handoff));
		if (shape) return repair(slug, c, "review-shape", "Your handoff is malformed: " + shape + ". Repost it.", issues, text);
		const stories = (r.handoff!.stories as { outcome: string }[]);
		const notHeld = stories.findIndex(x => x.outcome !== "held");
		if (notHeld >= 0) return repair(slug, c, "unheld", "You reported done, but stories[" + notHeld + "] is not held. `done` needs every story held on your final head: repair it, or report `blocked`/`needs-input`.", issues, text);
		c.evidence = { ...r.handoff!, tests: [...new Set([...testCommands(c.drive), ...testCommands(r.handoff)])] };
		s.results[slug] = reviewedResult(issue.partOf, c.evidence, text);
		c.phase = "integrate"; save();
		return integrateReview(slug, c, issue, issues);
	}
	/** A join's implementer filed children for residual work its own stage can't hold (as an owner's answer may direct):
	 * its commits land in the collector and its chain ends, so the walk runs the children, and the join starts again from
	 * the collector once they have landed. 2026-10-17 (bring-the-application-to-the-main-pages-design-implement-16): such a
	 * report went on to drive, the five children waited for a restart, and its commit 496d9830 never reached the collector. */
	async function joinFiledChildren(slug: string, c: Chain, children: string[], issues: Map<string, Issue>, text: string) {
		const col = s.collectors[slug];
		try { await landJoinWork(slug, c); }
		catch (e) { return raise(slug, "landing the join's commits in its collector failed", String(e) + "\n\n" + text, issues); }
		note("join " + slug + " filed " + children.join(", ") + "; its commits landed in " + col.branch + ", and it starts again from there once they land");
		delete s.chains[slug]; save();
		await retireChain(c, true);
	}
	/** Land a join's commits in its own collector. Open descendants' collectors that those commits already contain move
	 * up to it too, so their children start from the join's work: 2026-10-18 (concept, bring-the-application-to-the-main-pages-design),
	 * the join merged its reopened child's collector and that child's retired attempt; its seven repair children needed that as their base. */
	async function landJoinWork(slug: string, c: Chain): Promise<void> {
		const h = c.handle, col = s.collectors[slug];
		if (!h || !col) throw new Error(slug + "'s chain has no worker or no collector to land in");
		await locked(async () => {
			if (!isAncestor(col.path, git(h.path, "rev-parse", "HEAD"))) {
				git(h.path, "config", "branch." + git(h.path, "branch", "--show-current") + ".ab-parent", col.branch);
				await integrate(h, { cwd: controlCwd, keep: true });
				if (!isAncestor(col.path, git(h.path, "rev-parse", "HEAD"))) throw new Error("integration did not reach " + col.branch);
			}
			const head = git(col.path, "rev-parse", "HEAD"), all = view(col.path);
			for (const [kid, kc] of Object.entries(s.collectors)) {
				const row = all.get(kid);
				if (kid === slug || s.landed[kid] || !row || finished(row) || !descends(row, slug, all)) continue;
				const before = git(kc.path, "rev-parse", "HEAD");
				if (before === head || !isAncestor(kc.path, before, head)) continue;
				git(kc.path, "-c", "core.hooksPath=/dev/null", "merge", "--ff-only", "-q", head);
				await alignIndex(kc.path, before);
				note(kc.branch + " moved up to " + col.branch + " at " + head.slice(0, 8) + ": " + slug + "'s commits contain it");
			}
		});
	}
	/** The reopen resolution: a join whose children reopened (filed again, or moved back in) under its running chain ends
	 * as if it had filed them. Its commits land in its collector, and the walk runs the children and then a fresh join. */
	async function reopenJoin(slug: string, c: Chain | undefined, why?: string) {
		if (!c || !c.self || c.phase === "refine") throw new Error("reopen applies to a join's running chain (a node whose children land in its collector); " + slug + " has " + (c ? "a " + c.phase + " chain that is not a join" : "no chain"));
		await landJoinWork(slug, c);
		const open = [...view(s.collectors[slug].path).values()].filter(i => i.partOf === slug && !finished(i) && !isMoved(i)).map(i => i.slug);
		note("reopened " + slug + (open.length ? " for " + open.join(", ") : "") + "; its commits landed in " + s.collectors[slug].branch + ", and it starts again from there once they land");
		delete s.chains[slug]; save();
		await retireChain(c, true);
		if (why) pendingNotes.set(slug, why);
		tellOwner("reopened " + slug + ": its " + c.phase + " commits are in " + s.collectors[slug].branch + (open.length ? "; the walk runs " + open.join(", ") + " next" : "; it has no open children, so the join starts again"));
	}
	async function integrateReview(slug: string, c: Chain, issue: Issue, issues: Map<string, Issue>) {
		const h = c.handle!;
		const failure = await land(slug, c, issue);
		if (failure) {
			c.phase = "review";
			c.retries.integrate = (c.retries.integrate ?? 0) + 1;
			if (c.retries.integrate > BUDGET.integrate) return raise(slug, "integration failed " + BUDGET.integrate + " times", failure, issues);
			await sendChild(h, "Integration into " + (c.into === cwd ? "the owner's checkout" : "the parent branch") + " failed:\n\n" + failure.slice(0, 5000) + "\n\nRebase onto " + git(pathOf(c.into), "rev-parse", "HEAD") + " (git rebase <that sha>), resolve, make the gate and tests pass, commit, and report done again with your full handoff.");
			note("integration of " + slug + " failed (" + c.retries.integrate + "), sent back: " + failure.split("\n")[0]);
			save();
		}
	}
	const sparseCollectors = new Set<string>();
	const collectorPath = (slug: string) => resolve(repoRoot(controlCwd) + "__worktrees", slug + "--tree");
	function ensureCollector(slug: string, into: string) {
		if (s.collectors[slug]) {
			if (!sparseCollectors.has(slug)) { excludeTracker(s.collectors[slug].path); sparseCollectors.add(slug); }
			return s.collectors[slug];
		}
		const path = collectorPath(slug), branch = "tree/" + slug;
		const parentBranch = git(pathOf(into), "branch", "--show-current");
		if (!parentBranch) throw new Error("Collector destination needs a branch: " + pathOf(into));
		if (!existsSync(path)) git(controlCwd, "worktree", "add", "--no-checkout", "-q", "-b", branch, path, git(pathOf(into), "rev-parse", "HEAD"));
		excludeTracker(path);
		sparseCollectors.add(slug);
		git(path, "config", "branch." + branch + ".ab-parent", parentBranch);
		s.collectors[slug] = { path, branch, parentBranch };
		save();
		return s.collectors[slug];
	}

	// --- the walk --------------------------------------------------------------------------------------
	/** What keeps each open node from starting, recorded by the walk for the stop message: the owner shouldn't have to read a collector's tracker to find out. */
	const holds = new Map<string, string>();
	const why = (i: Issue, view: Map<string, Issue>): string => {
		const r: string[] = [];
		if (!i.ready) {
			const low = [...view.values()].filter(d => !finished(d) && !!d.ownStage && !["spec", "ticket", "done"].includes(d.ownStage) && descends(d, i.slug, view));
			r.push("effective stage " + i.effectiveStage + (low.length ? " through " + low.map(d => d.slug + " (" + d.ownStage + ")").join(", ") : ""));
		}
		for (const b of i.blockers ?? []) {
			const here = view.get(b);
			r.push("blocked by " + b + (here ? " (not satisfied at this destination)" : " (guard or external identity)"));
		}
		for (const c of i.claims ?? []) r.push(c.slug + " claimed by " + c.claimedBy);
		if (i.ready && !i.eligible) r.push("not all agent-assigned: " + (i.selectors ?? []).filter(x => !/^(agent|model:)/.test(x.assignee ?? "")).map(x => x.slug + " (" + (x.assignee ?? "unassigned") + ")").join(", "));
		if (i.deferred) r.push("deferred (priority 4)");
		return r.join("; ") || "not frontier";
	};
	/** Accidental ideas are global observations, not executable descendants. */
	async function setAsideIdeas(slug: string, current: Map<string, Issue>): Promise<boolean> {
		const ideas = [...current.values()].filter(i => i.ownStage === "idea" && !finished(i) && !i.provisional && descends(i, slug, current));
		if (!ideas.length) return false;
		for (const i of ideas) {
			const body = tracker.text(i.slug).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimEnd();
			tracker.update(i.slug, { "part-of": null }, body + "\n\nFiled under [[" + i.partOf + "]] while the " + s.root + " reconciler ran it; set aside from that tree, since an idea under it holds every ancestor at stage idea.\n");
			note("set aside idea " + i.slug + " from " + i.partOf);
			tellOwner("set aside global idea " + i.slug + " (filed under " + i.partOf + "): it no longer holds the tree; triage it through the tracker");
		}
		return true;
	}
	/** Deliver a saved accepted transition, even when the report cursor consumed it. */
	async function finishRefinement(slug: string, c: Chain) {
		const attempt = s.refinements[c.refinement!];
		if (attempt.phase !== "accepted" || !attempt.acceptance) throw new Error("Refinement not accepted: " + slug);
		const intent = attempt.acceptance;
		c.handledTs = intent.reportTs;
		if (intent.children.length) {
			note("decomposed " + slug + " into " + intent.children.join(", "));
			delete s.chains[slug]; save();
			await retireChain(c, true);
		} else {
			note("promoted " + slug);
			c.note = undefined; c.self = false;
			const issue = view(c.into).get(slug)!;
			await startPhaseFrom(slug, c, issue, view(c.into), intent.destination);
		}
	}
	/** Visit a node; returns whether anything under it is unsettled and progressing or launchable. */
	async function visit(slug: string, into: string, issues: Map<string, Issue>): Promise<"done" | "active" | "stuck"> {
		visited.add(slug);
		let issue = view(into).get(slug);
		if (!issue || finished(issue) || isMoved(issue)) return "done";
		// A restart with fresh state adopts the collector left on disk before reading its children:
		// a kid can be frontier only there (its blockers landed in the collector, not the owner).
		if (!s.collectors[slug] && existsSync(collectorPath(slug))) ensureCollector(slug, into);
		let own = view(s.collectors[slug] ? slug : into);
		if ((s.collectors[slug] || slug === s.root) && await setAsideIdeas(slug, own)) {
			own = view(s.collectors[slug] ? slug : into);
			issue = view(into).get(slug)!;
		}
		const refining = s.chains[slug]?.phase === "refine";
		// Visit the writer before its newly published children. Withholding is
		// also enforced by schedulingView for every destination.
		const kids = [...own.values()].filter(i => i.partOf === slug && !finished(i) && !isMoved(i));
		if (kids.length && !s.chains[slug] && !refining) {
			ensureCollector(slug, into);
			const below = await Promise.all(kids.map(k => {
				const current = view(slug), child = current.get(k.slug)!;
				return child.frontier || s.chains[k.slug] || s.collectors[k.slug] ? visit(k.slug, slug, current)
					: (holds.set(k.slug, why(child, current)), Promise.resolve("stuck" as const));
			}));
			return below.includes("active") ? "active" : "stuck";
		}
		// A node that gained an open blocker (e.g. a reopened sibling) is parked: its chain is retired, and it starts
		// fresh from the collector once the blocker has landed there.
		const parkingBlockers = refining ? [...issue.blockedBy.filter(blocker => !issues.get(blocker)?.satisfied), ...issue.guards] : issue.blockers;
		if (s.chains[slug] && slug !== s.root && parkingBlockers.length) {
			const parked = s.chains[slug];
			note("parked " + slug + " behind " + parkingBlockers.join(", "));
			tellOwner("parked " + slug + " behind " + parkingBlockers.join(", ") + ": its workers are retired and it restarts once they land" + (s.exceptions[slug] ? "; its pending exception (" + s.exceptions[slug].reason + ") is dropped" : ""));
			if (s.exceptions[slug]?.handler) await retireHandle(s.exceptions[slug].handler!, pathOf(parked.into));
			delete s.exceptions[slug]; dropResolution(slug);
			// Its restart starts from the collector; tell it where the parked attempt's commits are, as redispatch does.
			const parkedWork = parked.handle ? keptWork(parked) : undefined;
			await retireChain(parked); delete s.chains[slug];
			if (parkedWork) pendingNotes.set(slug, [pendingNotes.get(slug), parkedWork].filter(Boolean).join("\n\n"));
			save();
			holds.set(slug, "parked behind " + parkingBlockers.join(", "));
			return "stuck";
		}
		// A worker that carries on by itself withdraws its exception with its next report, and that report is handled as
		// usual. A worker stopped by a provider or bb error recovers on its own (pi retried, bb recovered): a drive held
		// behind one finished its work and was replaced anyway (2026-10-12). Any other worker carries on because someone
		// told it to (the owner, directly): its handlers are retired, not left to escalate an answered question level by
		// level (2026-10-16). A queued owner resolution is applied instead; a refinement's attempt was already discarded.
		const ex = s.exceptions[slug], hc = s.chains[slug];
		const recovers = !!ex && /^provider error: | errored in bb$/.test(ex.reason);
		if (ex && hc?.handle && (recovers ? !ex.handler : hc.phase !== "refine") && !existsSync(join(resolutionsDir(controlCwd, s.root), slug + ".json"))) {
			const later = recovers ? fresh(hc.handle, ex.reportTs ?? hc.handledTs, hc.launchedAt) : resumedReport(ex, hc);
			if (later && !later.tags.includes("error") && !bbErrored(hc.handle)) await withdraw(ex, hc, recovers
				? "its worker recovered and reported again. Don't resolve it; others grouped with it still need their own resolution."
				: "its worker reported again (" + (parse(later.body).status ?? "no status") + "), so it carries on; its report is handled as usual. Don't resolve it.");
		}
		if (s.exceptions[slug]) return "active";
		const c = s.chains[slug];
		// Children that reopen under a join past implement would land with it unrun: hold it once for the owner (reopen).
		// An implementer reports instead: done lands its commits and runs them, blocked raises.
		if (c?.self && kids.length && (c.phase === "drive" || c.phase === "review" || c.phase === "integrate") && !c.held) {
			const open = kids.map(k => k.slug).sort().join(", ");
			if (c.reopened !== open) {
				c.reopened = open;
				raise(slug, "children reopened under its " + c.phase, "Open children: " + open + ". Resolve with reopen to land this join's commits in its collector and run them, or answer/retry to carry on without them.", issues);
				return "active";
			}
		}
		if (!c) {
			if (s.collectors[slug]) issue = own.get(slug)!;
			if (!issue.frontier && slug !== s.root) { holds.set(slug, why(issue, issues)); return "stuck"; }
			if (live() >= s.budget) return "active";
			const chain: Chain = { into, self: !!s.collectors[slug], phase: "implement", retries: {}, workers: [], note: pendingNotes.get(slug) };
			pendingNotes.delete(slug);
			if (chain.self) chain.base = git(s.collectors[slug].path, "rev-parse", "HEAD");
			// A stopped run's work for this node: continue its phase from its kept branch.
			const resumed = s.resume?.[slug];
			if (resumed) {
				delete s.resume![slug];
				let usable = false;
				// A node's children landed in its collector after the stop: a branch that lacks the collector's head would
				// drop them (2026-10-17: the join resumed drive from drive-17, a base without every child landed since).
				let stale = false;
				try {
					usable = !isAncestor(pathOf(into), resumed.head);
					stale = usable && !!s.collectors[slug] && !isAncestor(s.collectors[slug].path, git(s.collectors[slug].path, "rev-parse", "HEAD"), resumed.head);
				} catch { usable = false; }
				if (stale) {
					usable = false;
					chain.note = [chain.note, "This node's stopped run left " + resumed.phase + " work on branch " + resumed.branch + " at " + resumed.head + ", from before children landed in your base. Take what still holds of it (git log HEAD.." + resumed.head + ") or leave it."].filter(Boolean).join("\n\n");
					note("resume record for " + slug + " dropped: " + resumed.branch + " lacks " + s.collectors[slug].branch + "'s head; starting from the collector");
				}
				else if (usable) Object.assign(chain, { phase: resumed.phase, base: resumed.base ?? chain.base, setup: resumed.setup, drive: resumed.drive, skipDrive: resumed.skipDrive, note: chain.note ?? resumed.note, resumeFrom: resumed.head });
				else note("resume record for " + slug + " dropped: " + resumed.head + " is gone or already in " + into);
			}
			s.chains[slug] = chain;
			try {
				if (chain.resumeFrom) {
					note(slug + " resumes " + chain.phase + " from the stopped run's branch " + resumed!.branch + " at " + chain.resumeFrom);
					await startPhase(slug, chain, chain.phase, issue, issues, "This node's previous run was stopped. Your base is its last " + chain.phase + " worker's branch " + resumed!.branch + " (" + chain.resumeFrom + "): its commits, including any WIP commit of uncommitted work, are yours to continue. Ignored state its worktree held was moved aside at retirement and the owner was told where.");
				}
				else if (chain.self) { chain.handle = undefined; await startPhaseFrom(slug, chain, issue, issues, s.collectors[slug].path); }
				else await startPhase(slug, chain, issue.effectiveStage === "spec" ? "refine" : "implement", issue, issues);
			} catch (e) {
				// Nothing launched: forget the chain so the post-reset tick starts it afresh.
				if (e instanceof GithubRateLimited) { delete s.chains[slug]; if (resumed && chain.resumeFrom) (s.resume ??= {})[slug] = resumed; save(); throw e; }
				raise(slug, "launch failed", String(e), issues);
			}
			return "active";
		}
		if (c.held) return "active";
		if (c.phase === "refine" && c.refinement && s.refinements[c.refinement].phase === "writing" && !s.refinements[c.refinement].worker) {
			await startPhase(slug, c, "refine", issue, issues, "Resume the saved refinement attempt after an interrupted launch.", false, c.refinement);
			return "active";
		}
		if (c.phase === "refine" && c.refinement && s.refinements[c.refinement].phase === "accepted") {
			await finishRefinement(slug, c); return "active";
		}
		if (c.phase === "integrate") {
			await integrateReview(slug, c, issue, issues); return "active";
		}
		if (!c.handle) {
			await startPhase(slug, c, c.phase, issue, issues);
			return "active";
		}
		const m = fresh(c.handle, c.handledTs, c.launchedAt);
		if (m && m.tags.includes("error") && c.handle && (Date.now() - Date.parse(m.ts) < ERROR_SETTLE_MS || observedWorking(c.handle))) return "active";
		if (!m && c.handle && bbErrored(c.handle)) { raise(slug, c.phase + " worker errored in bb", await bbError(c.handle), issues, "owner"); return "active"; }
		if (m) {
			const prior = c.handledTs;
			try { await onReport(slug, c, m, issues); }
			catch (e) {
				// A hold, not a reconciler error: the report stays unconsumed and is handled again after the reset.
				if (e instanceof GithubRateLimited) { c.handledTs = prior; throw e; }
				raise(slug, "reconciler error", String((e as Error)?.stack ?? e), issues);
			}
			return "active";
		}
		if (c.waitingSince && Date.now() - Date.parse(c.waitingSince) > WAITING_MS) { raise(slug, c.phase + " waiting stalled", "No report other than `waiting` in " + WAITING_MS / 3_600_000 + "h after the worker first reported waiting at " + c.waitingSince + ".", issues); return "active"; }
		// A worker idle on a wait whose process has already gone (it never started, or ended without waking it) would idle until the nudge below.
		if (c.waitingSince && c.handle && !c.waitingVoidNudged && Date.now() - Date.parse(c.waitingCheckedAt ?? c.waitingSince) > WAITING_VOID_MS && runsProcess(c.handle) === false) {
			c.waitingVoidNudged = true; c.waitingCheckedAt = new Date().toISOString(); save();
			note(c.phase + " " + slug + " nudged: waiting with no running process");
			await sendChild(c.handle, "You reported `waiting`, but your session runs no managed process: the one you are waiting on has ended without its notice reaching you, or never started. Check it (process list, process output): take its result if it finished, start it again if it didn't run, and continue.");
			return "active";
		}
		// The completion notice never comes while a descendant the process left behind (an orphaned server or executor) holds its process group.
		if (c.waitingSince && c.handle && Date.now() - Date.parse(c.waitingCheckedAt ?? c.waitingSince) > WAITING_NUDGE_MS && alive(c.handle) !== false) {
			c.waitingCheckedAt = new Date().toISOString(); save();
			note(c.phase + " " + slug + " nudged: waiting since " + c.waitingSince);
			await sendChild(c.handle, "You reported `waiting` and no completion notice has reached you in " + WAITING_NUDGE_MS / 60_000 + "m. Check the process you are waiting on (process list, process output). If its output shows the command finished but it still shows as running, a descendant it left behind (an orphaned server or executor) is holding its process group, so its notice will not come: take the result from its output, kill it with the process tool (and anything it left behind), and continue. If it is genuinely still running, end your turn `waiting` again.");
			return "active";
		}
		if (c.handle && Date.now() - (c.launchedAt ?? 0) > START_GRACE_MS && alive(c.handle) === false) {
			c.retries.relaunch = (c.retries.relaunch ?? 0) + 1;
			if (c.retries.relaunch > BUDGET.relaunch) {
				if (c.phase === "refine" && c.refinement) await discardRefinement(refinement, c.refinement);
				raise(slug, c.phase + " worker died " + BUDGET.relaunch + " times", "worktree " + c.handle.path, issues);
			}
			else {
				note(c.phase + " worker for " + slug + " is gone; relaunching");
				const kept = c.retries.relaunch;
				// Stop leaked services before adding a replacement; retain the worktree as its base.
				try { await stop(c.handle, { cwd: pathOf(c.into) }); }
				catch (e) { raise(slug, "dead worker cleanup failed", String(e), issues); return "active"; }
				await startPhase(slug, c, c.phase, issue, issues, "A previous worker on this phase died; its worktree may hold partial commits in your base.");
				c.retries.relaunch = kept; save();
			}
		}
		return "active";
	}
	// A node's own chain after its children: the implementer starts from the collector, so its branch carries them up.
	async function startPhaseFrom(slug: string, c: Chain, issue: Issue, issues: Map<string, Issue>, from: string) {
		const saved = c.into, previous = c.handle;
		if (previous) await stop(previous, { cwd });
		c.base = git(from, "rev-parse", "HEAD");
		const prompt = [ticketText(issue), c.self ? "Its children are all satisfied and integrated in your base. What remains is its own stage: residual work and the joins between its children. Don't redo the children." : "", c.note ? "Note from the supervisor: " + c.note : ""].filter(Boolean).join("\n\n");
		const launchedAt = Date.now();
		c.handle = await launch(nextHandle(slug, "implement"), "implement", prompt, c.base, pathOf(c.into), issue, undefined, async () => [ticketText(issue), c.self ? "Its children are all satisfied in your base; implement its residual work and joins." : "", c.note ?? ""].filter(Boolean).join("\n\n"));
		// Its only caller with a previous worker is a promoted refinement: the writer finished.
		if (previous && !await retireHandle(previous, cwd, true)) c.workers.push(previous);
		Object.assign(c, { into: saved, phase: "implement", launchedAt, handledTs: undefined });
		save();
	}
	const visited = new Set<string>();
	// A moved-out node is assigned to a person; reassigned to an agent (and back under its parent), it's moved back in.
	function isMoved(i: Issue): boolean {
		if (!s.moved[i.slug]) return false;
		if (!/^(agent|model:)/.test(i.assignee?.trim() ?? "")) return true;
		note("moved back in: " + i.slug); delete s.moved[i.slug]; dropResolution(i.slug); save();
		return false;
	}

	// --- main loop -------------------------------------------------------------------------------------
	tellOwner("started (budget " + s.budget + ")");
	// A tick that throws is told to the owner once per distinct error and retried, never a silent exit.
	let tickError = "";
	for (;;) {
		if (o.signal?.aborted) return;
		try { if (await untilReset(tick, { note, signal: o.signal })) return await told; tickError = ""; }
		catch (e) {
			const msg = String((e as Error)?.stack ?? e);
			if (msg.split("\n")[0] !== tickError) { tickError = msg.split("\n")[0]; note("tick failed: " + msg.slice(0, 2000)); tellOwner("tick failed, retrying every " + TICK_MS / 1000 + "s:\n\n" + msg.slice(0, 3000)); }
		}
		await Bun.sleep(TICK_MS);
	}
	/** One reconciliation pass; true when the run is over. */
	async function tick(): Promise<boolean> {
		await observeHost();
		await pollTurns();
		for (const [slug, col] of Object.entries(s.collectors)) if (!sparseCollectors.has(slug)) ensureCollector(slug, col.parentBranch);
		await locked(async () => recoverLandings(completion));
		closeAtTarget(completion);
		await recoverRefinements(refinement);
		// A bb spawn can precede the receipt save. Adopt only exact run/handle.
		for (const [slug, c] of Object.entries(s.chains)) {
			if (s.landed[slug]) {
				s.tests[c.into] = [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])];
				delete s.chains[slug]; save(); continue;
			}
			if (!c.refinement || c.phase !== "refine") continue;
			let attempt = s.refinements[c.refinement];
			if (attempt.successor) { c.refinement = attempt.successor; attempt = s.refinements[c.refinement]; }
			if (attempt.phase === "writing" && !attempt.worker) {
				const found = await findWorker({ run: s.root, handle: attempt.handle }, controlCwd);
				if (found) { attempt.worker = { run: s.root, handle: attempt.handle, path: found.path, bb: found.bb }; save(); }
			}
			if (attempt.worker && c.handle?.handle !== attempt.handle) { c.handle = attempt.worker; c.launchedAt = Date.now(); c.handledTs = undefined; save(); }
		}
		await cleanupLandings();
		// Acceptance/discard receipts also outlive the chain. Retire the exact
		// recorded writer after delivery/replacement, retrying a failed retirement.
		for (const attempt of Object.values(s.refinements)) {
			if (!["accepted", "removed"].includes(attempt.phase) || !attempt.worker) continue;
			const c = s.chains[attempt.node];
			if (c?.phase === "refine" && c.handle?.handle === attempt.handle) continue;
			const found = await findWorker(attempt.worker, controlCwd);
			const thread = found && (await bbThreads()).get(found.bb);
			if (thread && !thread.archivedAt) await retireHandle(attempt.worker, controlCwd, attempt.phase === "accepted");
		}
		const top = view(destination());
		if (s.pr && (s.landed[s.root] || s.pr.phase !== "preparing")) {
			// Staging satisfies the tree, not the global target. PR waiting never
			// revisits completed descendants, including on an opening restart.
			if (s.pr.phase === "preparing") { s.pr.phase = "opening"; s.pr.preparedHead = s.landed[s.root].head; save(); }
			await handleExceptions(top);
			if (s.pr.phase !== "merged" || (s.pr.repair?.worker && !s.pr.repair.retiredAt)) await advancePullRequest({
				state: s, tracker, host: o.prHost, save, locked, tests: s.tests[s.pr.path] ?? [],
				ownerHeld: Object.keys(s.exceptions).length > 0,
				launchRepair, report: fresh,
				sendRepair: (worker, message) => sendChild(worker, message),
				repairAlive: worker => alive(worker),
				retireRepair: async worker => {
					if (!await retireHandle(worker, s.pr!.path)) throw new Error("PR repair retirement failed: " + worker.handle);
				},
				raiseOwner: (reason, message) => raise(s.root, reason, message, top, "owner"),
			});
			if (s.pr.phase === "merged") {
				if (s.pr.repair?.worker && !s.pr.repair.retiredAt) return false;
				// Terminal remote landing supersedes a held owner exception without
				// requiring the owner's session to be present.
				if (s.exceptions[s.root]) { delete s.exceptions[s.root]; save(); }
				closeAtTarget(completion);
				if (!s.target || Object.values(s.results).some(result => !result.closedAt)) return false;
				if (Object.values(s.landingOps).some(op => s.landed[op.slug] && !op.cleanupDone)) return false;
				s.finished = "done"; save();
				tellOwner("done: " + s.root + " landed in " + s.target + (s.pr.url ? "\n" + s.pr.url : ""));
				return true;
			}
			return false;
		}
		holds.clear();
		if (!top.get(s.root)) { s.finished = "root issue not found"; save(); tellOwner("stopped: no issue " + s.root); return true; }
		if (tracker.githubIssue) {
			const root = top.get(s.root)!;
			if (!root.satisfied && !isMoved(root) && tracker.fields(s.root)["claimed-by"] !== "reconcile:" + s.root) {
				if (!root.frontier) {
					if (!s.exceptions[s.root]) raise(s.root, "GitHub root is not ready for this run", "The root must be ready, agent-eligible and free of foreign native claims before reserving its tree.", top, "owner");
					await handleExceptions(top);
					return false;
				}
				tracker.update(s.root, { "claimed-by": "reconcile:" + s.root });
			}
		}
		visited.clear();
		const result = await visit(s.root, destination(), top);
		if (s.pr && s.landed[s.root]) return false;
		await handleExceptions(top);
		// Chains whose nodes left the tree (moved out, or edited out of it by anyone) are retired.
		for (const [slug, c] of Object.entries(s.chains)) if (!visited.has(slug)) { note(slug + " left the tree; retiring its workers"); await retireChain(c); releaseRefinementClaims(refinement, slug); delete s.chains[slug]; save(); }
		for (const [slug, ex] of Object.entries(s.exceptions)) if (!visited.has(slug)) { if (ex.handler) await retireHandle(ex.handler, cwd); delete s.exceptions[slug]; dropResolution(slug); save(); }
		if (result !== "active" && !Object.keys(s.exceptions).length && !Object.values(s.chains).length) {
			closeAtTarget(completion);
			if (Object.values(s.landingOps).some(op => s.landed[op.slug] && !op.cleanupDone)) return false;
			const all = view(destination());
			for (const attempt of Object.values(s.refinements)) {
				if (attempt.phase !== "accepted" && attempt.phase !== "removed") await discardRefinement(refinement, attempt.handle);
			}
			const open = [...all.values()].filter(i => !finished(i) && (i.slug === s.root || under(i, all)));
			s.finished = result === "done" ? "done" : "stuck";
			save();
			tellOwner((result === "done" ? "done: " + s.root + " landed in the owner's checkout at " + git(cwd, "rev-parse", "--short", "HEAD") : "stopped with open work: " + (holds.size ? [...holds].map(([k, v]) => "\n- " + k + ": " + v).join("") : open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", ")))
				+ (Object.keys(s.moved).length ? "\nMoved out: " + Object.entries(s.moved).map(([k, v]) => k + ": " + v).join("; ") : ""));
			return true;
		}
		return false;
	}
	function under(i: Issue, all: Map<string, Issue>): boolean { for (let p = i.partOf; p; p = all.get(p)?.partOf ?? null) if (p === s.root) return true; return false; }
}
