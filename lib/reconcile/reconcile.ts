// Reconciler for one dispatched issue subtree (docs/issues/reconcile-the-execution-tree-with-lazy-exception-handlers.md).
//
// Each tick recomputes what every node needs from observed state (the global tracker and private landing ledger, the
// workers' bb turn reports and current thread/live observations) and takes the next step. Specs get to tickets through the refine
// role (manager), which promotes them or commits children; an implementer who finds its ticket
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
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dispatch, findWorker, integrate, retire, stop, tell, topic, type Handle } from "../dispatch.ts";
import { agent as stance, byRole } from "../agents.ts";
import { parse, statusRepairMessage } from "../report.ts";
import { commitIds } from "../commit-handoff.ts";
import { roleThread } from "../desk.ts";
import { readTurn, type TurnRead, type TurnReport } from "../thread/turn.ts";
import { decide } from "../decide.ts";
import { pidAlive } from "../wm.ts";
import { readLive } from "../session-meta/live";
import { bbThreads, bbWorkerRoute, bbWorking, logBb, tellBbFolded, type BbThread } from "../thread/bb";
import type { WorkerRoute } from "../thread/types";
import { refreshWorker } from "./refresh.ts";
import { checkpoint } from "./checkpoint.ts";
import { advanceLaunchBase, commitRef, conflictKey, landedRequirements, type LaunchConflict } from "./launch-base.ts";
import { clip, heldByRed, mainRed, evidenceShapeError, git, isAncestor, storyShapeError, testCommands, setupError } from "./checks.ts";
import { getTracker } from "../tracker.ts";
import { GithubRateLimited, rateLimitMark } from "../tracker-github-snapshot.ts";
import { untilReset } from "./rate-limit.ts";
import { excludeTracker } from "../thread/tracker-worktree.ts";
import { alignIndex } from "../thread/lifecycle.ts";
import { worktrees } from "../thread/lifecycle-git.ts";
import { schedulingView, type ScheduledIssue as Issue } from "./scheduling.ts";
import { beginEvidenceScope, EVIDENCE_MISSING } from "./evidence.ts";
import { closeAtTarget, finishLandingCleanup, landReviewed, recoverLandings, reviewedResult } from "./completion.ts";
import { outstandingChecks, POST_LANDING, selectPostLanding, type PostLandingVerdict } from "./post-landing.ts";
import { acceptRefinement, beginRefinement, discardRefinement, recoverRefinements, releaseRefinementClaims, replaceRefinement } from "./refinement.ts";
import type { GlobalRunState, RefinementAttempt } from "./tracker-state.ts";
import type { LandingMode, PullRequestHost, PrRepairRequest } from "./pr-types.ts";
import { prepareStaging, resolveLanding } from "./pr-config.ts";
import { createPullRequestHost } from "./pr-host.ts";
import { advancePullRequest } from "./pull-request.ts";
import { writeStatus } from "./status.ts";
import { CodeMonitor, loadedCode, type CodeVersion } from "./code-version";
import { spawnRun } from "./process";
import { ownershipLock, OwnershipLockBusy } from "./ownership";
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
/** A worker whose bb log has failed every read this long is raised to the owner: its reports can't arrive. */
const UNREADABLE_MS = Number(process.env.PI_RECONCILE_UNREADABLE_MS ?? 10 * 60_000);
const WAITING_MS = 3 * 60 * 60_000;
const TOOL_CALL_MS = 45 * 60_000;
/** A waiting worker is asked to check its process this long after its latest `waiting` report or nudge. */
const WAITING_NUDGE_MS = 30 * 60_000;
/** A waiting worker whose session runs no managed process this long after its report is told so (its notice raced, or nothing started). */
const WAITING_VOID_MS = 2 * 60_000;
/** Mechanical retries per chain before a failure becomes an exception. */
const BUDGET = { repair: 2, relaunch: 2, checkpoint: 3, integrate: 3, cleanup: 3 } as const;
/** The exception reason of a landing whose cleanup keeps failing. */
const CLEANUP_FAILED = "landing cleanup failed";
const DELIVERED_ACTIVE = "active chain after recorded landing";
const CLOSED_ACTIVE = "closed outside the run while its chain runs";
const FOREIGN_COMMIT = "foreign implementation not installed";
const LAUNCH_CONFLICT = "launch base conflicts with required work";


type Phase = "refine" | "implement" | "drive" | "review" | "integrate";
interface PhaseLaunch {
	phase: Phase;
	extra: string;
	adopt: boolean;
	resumeAttempt?: string;
	finished: boolean;
	/** Collector base for a join or promoted refinement, rather than the previous worker's head. */
	from?: string;
	base?: string;
	waived?: string[];
	after?: WorkerRoute;
}
interface Chain {
	/** Exact provisional attempt, independent of the report cursor. */
	refinement?: string;
	/** Branch this chain lands in: the parent's collector, or the owner's checkout for the root. */
	into: string;
	/** The node has children that landed in its collector; this chain is its own residual work and joins. */
	self: boolean;
	phase: Phase;
	handle?: Handle;
	/** Intended worker title, saved before spawn so restart can adopt an unreceipted thread. */
	launching?: string;
	/** Phase the saved launch starts; c.phase stays the running worker's until its successor's handle is saved. */
	launchPhase?: Phase;
	/** Continue the intended transition after a prelaunch hold, including if the run restarts. */
	pendingLaunch?: PhaseLaunch;
	launchedAt?: number;
	/** ts of the last report acted on. */
	handledTs?: string;
	/** Original diff boundary for review; the launch base may also carry resumed work. */
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
	/** The owner's `accept`: why this node's review may report stories `unobservable` (by design) and still land. */
	acceptUnobservable?: string;
	/** Exact red report this landing waits on, and the one the owner designated it to repair. */
	redHeld?: string;
	redRepair?: string;
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
	postLandingOwnerNotified?: string;
	/** ts of the report that raised it: an answer consumes only up to here, so a report that arrived while held still counts. */
	reportTs?: string;
	baseConflict?: LaunchConflict;
}
export interface State extends GlobalRunState {
	backend: "threads";
	/** Native tracker identity survives convention/remote edits and restart. */
	githubRepository?: string;
	root: string; cwd: string; owner: string; ownerSession?: string; budget: number; pid?: number;
	codeVersion?: CodeVersion;
	/** Running code supports owner changes without replacing workers or exceptions. */
	ownerHandover?: true;
	collectors: Record<string, { path: string; branch: string; parentBranch: string }>;
	chains: Record<string, Chain>;
	/** Implementation admission survives chain replacement and restart; replaying a saved handle costs no new attempt. */
	implementationLaunches?: Record<string, { base: string; prerequisites: string; handles: string[] }[]>;
	/** Closing a blocker removes the global issue edge. Keep the edges this run saw. */
	launchBlockers?: Record<string, string[]>;
	/** Named checkpoint commits and their source refs, surviving supersession and stop. */
	launchCheckpoints?: Record<string, Record<string, string>>;
	launchWaivers?: Record<string, string[]>;
	exceptions: Record<string, Exception>;
	/** Test files each branch's integrations must keep passing. */
	tests: Record<string, string[]>;
	resolved: Record<string, string[]>;
	moved: Record<string, string>;
	counter: number;
	log: string[];
	finished?: string;
	/** Wall-clock milliseconds when the run reached done or got stuck. */
	finishedAt?: number;
	/** Explicit stop owns cleanup until it succeeds; session startup must not resume this run. */
	stopping?: boolean;
	/** Work of the chains a stop retired, by node; a restart starts each node from it (see Resume). */
	resume?: Record<string, Resume>;
	/** This run's workers' pi sessions (session id → bb thread), seen while they ran. A `session:<id>` claim one of them
	 * wrote is this run's own, and is released once its thread is retired: 2026-10-28 (arkhai-payments), the
	 * scheduled-stops implementer claimed its ticket, landed and was retired, and its claim stopped the run. */
	workerSessions?: Record<string, string>;
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
export function resumeRecords(s: State, fallback = s.cwd): Record<string, Resume> {
	const out: Record<string, Resume> = { ...s.resume };
	for (const [slug, c] of Object.entries(s.chains)) {
		if (!c.handle || c.phase === "refine") continue;
		const into = c.into === s.cwd ? s.cwd : s.collectors[c.into]?.path ?? c.into;
		// A destination checkout that is gone can't say what it lacks: the kept branch is recorded, and a restart's
		// own ancestry check decides (2026-10-30, concept: the owner's worktree went with its archived thread).
		const there = existsSync(into);
		let head = "";
		try { head = git(there ? into : fallback, "rev-parse", "--verify", "-q", "refs/heads/" + c.handle.handle); } catch { continue; }
		try { if (!head || there && isAncestor(into, head)) continue; } catch { continue; }
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
		if (prior) { s.owner = prior.owner; s.ownerSession = prior.ownerSession; }
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
	/** Started by pickup (lib/reconcile/pickup.ts) or resumed with its owner's session: no "started" mail; the owner hears
	 * exceptions and the finish. */
	quiet?: boolean;
	/** Scratch observation uses the same lifecycle, with no live GitHub calls. */
	prHost?: PullRequestHost;
}

/** A run that finished `done` whose root has since been reopened starts over, rather than resuming a state that records
 * its landing and reports done at once (2026-11-16, tag-chunk-refresh-can-exhaust-occ-retries-against-collector). The
 * old state, log and resolutions move to <state dir>/superseded-<stamp>/. Identity and the handle counter carry over, so
 * the new run's worker branches are numbered past the old run's. PR-mode runs keep their staging and resume as before. */
function supersede(cwd: string, prior: State, o: StartOptions): State {
	const root = reconcilerTracker(cwd, o.root).snapshot().get(o.root);
	if (prior.finished !== "done" || prior.pr || !root || root.done || root.archived) return prior;
	return updateState(cwd, o.root, current => {
		if (current !== undefined && current.finished !== "done") return current;
		const dir = join(stateDir(cwd), "superseded-" + new Date().toISOString().replace(/[:.]/g, "-"));
		mkdirSync(dir, { recursive: true });
		for (const name of [o.root + ".json", o.root + ".log", o.root + ".resolutions"])
			if (existsSync(join(stateDir(cwd), name))) renameSync(join(stateDir(cwd), name), join(dir, name));
		const old = current ?? prior;
		return { backend: "threads", root: o.root, cwd: old.cwd, owner: old.owner, ownerSession: old.ownerSession, budget: o.budget,
			land: old.land, githubRepository: old.githubRepository, landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {},
			chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: old.counter,
			log: [new Date().toISOString().slice(0, 19) + " restarted fresh: the root was reopened after finishing; old state in " + dir] };
	});
}

/** Called before spawning/publication as well as by foreground run. */
export function prepareStart(o: StartOptions): State {
	let prior = load(resolve(o.cwd), o.root);
	assertThreadState(prior);
	const cwd = prior?.cwd ?? resolve(o.cwd);
	if (prior && !existsSync(cwd)) throw new Error(o.root + "'s reconciler lands in " + cwd + ", which is gone; its state (" + stateFile(resolve(o.cwd), o.root) + ") names that checkout as cwd");
	if (prior?.stopping) throw new Error("cleanup in progress for " + o.root + ": retry stop to finish it");
	if (prior) prior = supersede(cwd, prior, o);
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
	// A spawned run already has its owner published; a foreground invocation chooses it here.
	if (s.pid !== process.pid) updateState(controlCwd, s.root, current => ({ ...current!, owner: o.owner,
		ownerSession: o.ownerSession ?? (current!.owner === o.owner ? current!.ownerSession : undefined) }));
	Object.assign(s, { budget: o.budget, pid: process.pid, codeVersion: loadedCode, ownerHandover: true, finished: undefined, finishedAt: undefined });
	const save = () => saveState(s);
	const refreshOwner = () => {
		const current = load(controlCwd, s.root);
		if (current) { s.owner = current.owner; s.ownerSession = current.ownerSession; }
		process.env.BB_THREAD_ID = s.owner;
	};
	const note = (line: string) => { s.log.push(new Date().toISOString().slice(0, 19) + " " + line); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); console.log(line); };
	// To a worker as a queued bb message: it follows the turn in progress, or starts one on an idle thread.
	const sendChild = (h: Handle, body: string) => tell(h, body.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""), { cwd: controlCwd });
	// The owner is a bb thread. One that has closed hands over to whichever thread holds the supervisor role on the desk.
	// Told in order, off the tick; the run waits for the last before it ends. Notices that pile up while the owner is
	// busy fold into one queued message, so they cost it one turn rather than one each: every reconciler's, so runs
	// started together (each saying "started") are one turn too.
	let told: Promise<void> = Promise.resolve();
	const tellOwner = (body: string) => {
		told = told.then(() => ownershipLock(controlCwd, async () => {
			refreshOwner();
			const live = new Set([...await bbThreads()].filter(([, t]) => !t.archivedAt).map(([id]) => id));
			const supervisor = roleThread("supervisor", controlCwd);
			const to = live.has(s.owner) ? s.owner : supervisor && live.has(supervisor) ? supervisor : s.owner;
			const prefix = "[reconcile " + s.root + "] ";
			await tellBbFolded(to, "[reconcile ", prefix + body);
		})).catch(e => note("telling the owner failed: " + e));
	};
	save();
	refreshOwner();

	// --- observation -----------------------------------------------------------------------------------
	const pathOf = (into: string) => into === cwd ? cwd : s.collectors[into]?.path ?? into;
	// Send the same committed tracker CLI through each worker's BB metadata.
	const inheritedTrackerCli = process.env.TRACKER_CLI;
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
		const rows = snapshot();
		let changed = false;
		for (const row of rows.values()) {
			if (!row.blockedBy.length || (row.slug !== s.root && !under(row, rows))) continue;
			const before = s.launchBlockers?.[row.slug] ?? [];
			const after = [...new Set([...before, ...row.blockedBy])];
			if (before.length !== after.length) { (s.launchBlockers ??= {})[row.slug] = after; changed = true; }
		}
		if (changed) save();
		return schedulingView(rows, { root: s.root, into: logicalInto, landed: s.landed, inherited,
			attemptClaims: new Set([...attempts.map(a => a.claim), ...Object.keys(s.workerSessions ?? {}).map(id => "session:" + id)]),
			withheld: new Set(attempts.flatMap(a => a.owned)), explicit: true });
	};
	const completion = { state: s, tracker, save, pathOf, locked,
		holdEvidence: (slug: string, text: string) => raise(slug, EVIDENCE_MISSING, text, view(destination())),
		holdForeignCommit: (slug: string, text: string) => raise(slug, FOREIGN_COMMIT, text, view(destination())),
		holdPostLanding: (slug: string, text: string) => raise(slug, POST_LANDING, text, new Map(), "owner"),
		foreignContexts: () => Object.values(s.chains).map(c => [c.setup, c.drive, c.evidence]),
	};
	const refinement = { state: s, tracker, save, locked, stopWriter: (attempt: RefinementAttempt) => stopRefinementWriter(s, attempt) };
	// Latest turn report per worker topic, read from each worker's bb thread after the last turn seen.
	const reports = new Map<string, TurnReport>();
	const seen = new Map<string, number>();
	/** Worker topics whose log the last poll couldn't read: since when, and why. */
	const unreadable = new Map<string, { since: number; error: string }>();
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
			const key = s.root + "/" + handle;
			let read: TurnRead;
			try { read = await readTurn(bb, seen.get(bb) ?? 0, { onSkip: after => note("skipped an event of " + handle + "'s log after seq " + after + ": too large for bb to return alone") }); }
			catch (e) {
				// Noted once; a chain whose worker stays unreadable past UNREADABLE_MS is raised to the owner (visit).
				const error = String(e).split("\n")[0];
				if (!unreadable.has(key)) note("reading " + handle + " failed: " + error);
				unreadable.set(key, { since: unreadable.get(key)?.since ?? Date.now(), error });
				continue;
			}
			if (unreadable.delete(key)) note("reading " + handle + " recovered");
			seen.set(bb, read.seq);
			if (read.report) reports.set(key, read.report);
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
	/** Remember the pi session of each live worker of this run (State.workerSessions). */
	const noteWorkerSessions = () => {
		if (!host) return;
		let changed = false;
		for (const l of readLive()) {
			const t = l.thread ? host.get(l.thread) : undefined;
			if (!t || !t.title?.startsWith(s.root + "/") || !t.environmentPath || !inRepo(t.environmentPath) || s.workerSessions?.[l.sessionId]) continue;
			(s.workerSessions ??= {})[l.sessionId] = l.thread!; changed = true;
		}
		if (changed) save();
	};
	/** Clear the claims this run's retired workers left: an issue whose every stored claim is theirs. */
	const releaseWorkerClaims = () => {
		const own = s.workerSessions ?? {};
		if (!host || !Object.keys(own).length) return;
		const retired = (claim: string) => {
			const bb = claim.startsWith("session:") ? own[claim.slice("session:".length)] : undefined;
			if (!bb) return false;
			const t = host!.get(bb);
			return !t || !!t.archivedAt;
		};
		for (const row of snapshot().values()) {
			const stored = row.claims.filter(c => c.slug === row.slug && !c.derived);
			if (!stored.length || !stored.every(c => retired(c.claimedBy))) continue;
			try { tracker.update(row.slug, { "claimed-by": null }); }
			catch (e) { note("releasing " + row.slug + "'s claim failed: " + String(e).split("\n")[0]); continue; }
			note("released " + row.slug + "'s claim by retired worker " + stored.map(c => c.claimedBy).join(", "));
		}
	};
	const bbThread = (h: Handle) => h.bb ? host?.get(h.bb) : undefined;
	const nativeRateLimit = (h: Handle, m: TurnReport) => m.errorCategory === "rate-limit" && (bbThread(h)?.providerId ?? "pi") !== "pi";
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
			return leaders.some(pid => { try { return /^n\/dev\/null$/m.test(execFileSync("lsof", ["-w", "-a", "-p", String(pid), "-d", "0", "-Fn"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { return true; } });
		} catch { return undefined; }
	};

	/** pi-processes' versioned session receipts distinguish managed work from an active bash child.
	 * The idle-only OS probe above cannot do that: both launch process-group leaders with stdin closed. */
	const managedProcess = (sessionFile: string): boolean | undefined => {
		try {
			const registry = JSON.parse(readFileSync(join(sessionFile + ".processes", "registry.json"), "utf8"));
			if (registry.version !== 1 || !Array.isArray(registry.records)) return undefined;
			return registry.records.some((r: { info: { status: string } }) => ["running", "terminating", "terminate_timeout"].includes(r.info.status));
		} catch (e) { return (e as NodeJS.ErrnoException).code === "ENOENT" ? false : undefined; }
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
	async function launch(handle: string, role: string, prompt: string, base: string, into: string, issue?: Issue, only?: string[], prepare?: (cwd: string) => Promise<string | void>, refining?: { chain: Chain; adopt: boolean }, chain?: Chain, after?: WorkerRoute): Promise<Handle> {
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
				if (chain) {
					if (issue) beginEvidenceScope(s, tracker, issue.slug, controlCwd, base, actual);
					chain.launching = actual; save();
				}
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
						async path => claimed(await prepare?.(path) ?? prompt), after);
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
	async function launchNow(handle: string, role: string, prompt: string, base: string, into: string, issue?: Issue, only?: string[], prepare?: (cwd: string) => Promise<string | void>, after?: WorkerRoute): Promise<Handle> {
		const restrict = (text: string) => issue ? constrainedPrompt(controlCwd, s.root, issue.slug, text) : text;
		const agentName = after?.agent ?? await pick(role, issue, restrict(prompt), only);
		// Starting a reconciler on a root delegates the root: a goal root rarely names an assignee, and its own stage
		// (the joins between its children) is the last step of the tree it was handed. A non-root node is only
		// frontier when agent-assigned; an explicit human or session assignee still refuses.
		if (!tracker.githubIssue && issue && issue.slug === s.root && !issue.assignee?.trim()) issue = { ...issue, assignee: "agent" };
		const r = await dispatch([{ handle, prompt: restrict(prompt), agent: agentName, role, base, after, prepare: async path => restrict(await prepare?.(path) ?? prompt), ...((role === "implement" || role === "refine") && issue ? { issue: issue.slug, assignee: role === "refine" && pinned(issue.assignee) ? "agent" : issue.assignee ?? undefined } : {}) }],
			{ run: s.root, cwd: into, maxConcurrent: 1, active: [], protectedIssue: issue?.slug, withOwner: async create => {
				for (;;) {
					try {
						return await ownershipLock(controlCwd, async () => {
							refreshOwner();
							return create({ thread: s.owner, session: s.ownerSession });
						});
					} catch (e) {
						if (!(e instanceof OwnershipLockBusy)) throw e;
						note("launch " + handle + " pending behind a live supervisor lock, retrying: " + e.message);
					}
				}
			} });
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
	/** A blocked/waiting report supplies no new prerequisite. Count identical implementation starts across chains,
	 * not in c.retries (startPhase resets it, and redispatch deletes the chain). Persist before dispatch for crash replay. */
	function admitImplementation(slug: string, c: Chain, issue: Issue, base: string, handle: string): boolean {
		const current = view(c.into);
		const prerequisites = JSON.stringify([
			[...issue.blockedBy].sort().map(k => [k, s.landed[k]?.head ?? null, current.get(k)?.satisfied ?? false]),
			[...issue.guards].sort(),
			[...current.values()].filter(k => k.partOf === slug).map(k => [k.slug, s.landed[k.slug]?.head ?? null, k.satisfied]).sort(),
		]);
		const attempts = (s.implementationLaunches ??= {})[slug] ??= [];
		let same = attempts.find(a => a.base === base && a.prerequisites === prerequisites);
		if (same?.handles.includes(handle)) return true;
		if (same && same.handles.length >= 2) {
			raise(slug, "repeated implementation on unchanged prerequisites", "Two implementations already started from " + base
				+ " with the same prerequisites: " + same.handles.join(", ") + ". A third needs changed code or prerequisites.\n\nPrerequisites: " + prerequisites, current, "owner");
			return false;
		}
		if (!same) { same = { base, prerequisites, handles: [] }; attempts.push(same); }
		same.handles.push(handle); save();
		return true;
	}
	function keepCheckpoint(slug: string, head: string, ref: string) {
		((s.launchCheckpoints ??= {})[slug] ??= {})[head] = ref;
	}
	function keepReportedCheckpoints(slug: string, h: Handle, commit: unknown) {
		const declared = commitIds(JSON.stringify(commit ?? ""));
		if (!declared.length) return;
		const ref = "refs/heads/" + h.handle;
		const tip = commitRef(controlCwd, ref);
		if (!tip) return;
		for (const id of declared) {
			const head = commitRef(controlCwd, id);
			if (head && isAncestor(controlCwd, head, tip)) keepCheckpoint(slug, head, ref);
		}
	}
	/** finished words the retirement notice. */
	async function startPhase(slug: string, c: Chain, phase: Phase, issue: Issue, issues: Map<string, Issue>, extra = "", adopt = false, resumeAttempt?: string, finished = false, from?: string) {
		const plan = c.pendingLaunch ?? { phase, extra, adopt, resumeAttempt, finished, from };
		({ phase, extra, adopt, resumeAttempt, finished, from } = plan);
		// The attempt being replaced stops first, so nothing it commits afterwards misses the new base; it's
		// retired once its successor launched (its branch stays if it holds commits not yet integrated).
		const prev = c.handle?.handle === c.launching ? undefined : c.handle;
		if (prev && existsSync(prev.path)) { await stop(prev, { cwd: pathOf(c.into) }); saveWip(prev); }
		// A retired worker (keepBranch) leaves no worktree but its branch still holds the chain's work so far.
		const kept = (h: Handle) => { try { return git(pathOf(c.into), "rev-parse", "--verify", "-q", "refs/heads/" + h.handle); } catch { return ""; } };
		// A registered worker already launched; adopt its receipt even if prerequisites have changed since dispatch.
		const registered = c.launching ? await findWorker({ run: s.root, handle: c.launching }, controlCwd) : undefined;
		let base = plan.base ?? (from ? git(from, "rev-parse", "HEAD")
			: (c.handle && existsSync(c.handle.path) ? git(c.handle.path, "rev-parse", "HEAD") : c.handle && kept(c.handle)) || c.resumeFrom || git(pathOf(c.into), "rev-parse", "HEAD"));
		if (from && !c.pendingLaunch || !c.base && (phase === "refine" || phase === "implement"))
			c.base = git(from ?? pathOf(c.into), "rev-parse", "HEAD");
		if (!registered) {
			const requirements = landedRequirements(stateDir(controlCwd), s.root, s, s.launchBlockers?.[slug] ?? []);
			for (const [head, ref] of Object.entries(s.launchCheckpoints?.[slug] ?? {})) requirements.push({ head, ref, name: "checkpoint " + head });
			const advance = advanceLaunchBase(controlCwd, base, requirements.filter(r => !plan.waived?.includes(r.head)), s.launchWaivers?.[slug]);
			if ("requirement" in advance) {
				c.pendingLaunch = plan;
				const { requirement: r, sourceHead, files } = advance;
				const source = (r.checkout ? r.checkout + " " : "") + r.ref;
				raise(slug, LAUNCH_CONFLICT, "Required " + r.name + " (" + r.head + ") cannot merge into base " + advance.base
					+ " from " + source + " (" + sourceHead + "). Conflicting files:\n" + files.join("\n")
					+ "\n\nResolve with retry and `commit` naming a merged revision containing the base and requirement, or answer without `commit` to launch without this requirement.", issues, "owner", advance);
				return;
			}
			if (base !== advance.base) note("advanced " + slug + " " + phase + " base from " + base + " to " + advance.base);
			base = advance.base;
		}
		if (c.handle && !existsSync(c.handle.path) && phase !== "refine" && phase !== "implement" && base === git(pathOf(c.into), "rev-parse", "HEAD")) note("no worktree or branch for " + c.handle.handle + "; " + phase + " for " + slug + " starts from " + c.into + ", without the chain's earlier work");
		const phasePrompt = () => {
			const contract = ticketText(issue);
			if (phase === "refine" || phase === "implement") return [contract,
				c.self ? "Its children are all satisfied and integrated in your base. What remains is its own stage: residual work and the joins between its children. Don't redo the children." : "",
				phase === "implement" ? "Your base: " + base : "", c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
			if (phase === "drive") return [contract, "Setup handoff from the implementer:\n" + yaml(c.setup), c.self ? "Drive this node's own stories: journeys that cross its children. The children's own stories were driven already; if the node has none beyond theirs, report `stories: []`." : "", c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
			return [contract, "The change: git diff " + c.base + "..HEAD in your worktree.", "Driver's handoff:\n" + yaml(c.drive), c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
		};
		// A join's review is tidy's: crossing stories at their seams, then structure across the children.
		const only = phase === "review" && c.self ? ["tidy", ...((c.drive as any)?.evidence?.visual ? ["visual-reviewer"] : [])] : undefined;
		const launchedAt = Date.now();
		c.launching ??= resumeAttempt ?? nextHandle(slug, phase);
		c.launchPhase = phase;
		c.pendingLaunch = plan;
		save();
		if (!registered && phase === "implement" && !plan.after && !admitImplementation(slug, c, issue, base, c.launching)) return;
		const handle = registered ? { run: s.root, handle: c.launching, path: registered.path, bb: registered.bb } : await launch(c.launching, phase, phasePrompt(), base, pathOf(c.into), issue, only, async path => {
			if (from) return phasePrompt();
			// Handler rulings land in the collector, not the preceding worker. Merge before setup and before
			// reading the successor's ticket; a rebase here could replay patch-equivalent ancestor work.
			const refreshed = refreshWorker(path, pathOf(c.into));
			return [phasePrompt(), refreshed.conflicts.length ? "First resolve the pending merge of collector " + refreshed.head + ": " + refreshed.conflicts.join(", ") + ". Preserve the collector's code and the previous worker's results, then commit the merge before continuing this phase. The ticket above is the current global contract. Do not abort the merge or rebase away either history. Setup was skipped because it can't run over conflict markers: after committing the merge, run the project's setup (mise run setup, where it declares one) before anything that needs it." : ""].filter(Boolean).join("\n\n");
		}, phase === "refine" ? { chain: c, adopt } : undefined, c, plan.after);
		if (phase === "refine" && c.refinement && registered) s.refinements[c.refinement].worker = handle;
		if (prev && !await retireHandle(prev, pathOf(c.into), finished)) c.workers.push(prev);
		Object.assign(c, { phase, handle, launching: undefined, launchPhase: undefined, pendingLaunch: undefined, launchedAt, handledTs: undefined, resumeFrom: undefined });
		c.retries = { integrate: c.retries.integrate ?? 0, provider: c.retries.provider ?? 0 };
		save();
	}

	// --- exceptions ------------------------------------------------------------------------------------
	/** Provider errors no handler can fix (credentials, quota) go to the owner, grouped by class. */
	const errorClass = (body: string) => /invalid_grant|oauth|refresh token|unauthori[sz]ed|\b401\b|\b403\b|api key|authentication/i.test(body) ? "authentication"
		: /\b429\b|rate.?limit|quota|usage limit|overloaded|\b529\b/i.test(body) ? "rate limit or quota" : body.replace(/^error:\s*/, "").split("\n")[0].slice(0, 80);
	function raise(slug: string, reason: string, text: string, issues: Map<string, Issue>, at?: "owner", baseConflict?: LaunchConflict) {
		const c = s.chains[slug];
		if (c) c.held = true;
		if (s.exceptions[slug]) return;
		dropResolution(slug);
		const parent = issues.get(slug)?.partOf;
		const level = at ?? (slug === s.root || !parent ? "owner" : parent);
		s.exceptions[slug] = { id: slug + "-" + Date.now().toString(36), node: slug, reason, text: reason === EVIDENCE_MISSING || reason === POST_LANDING || baseConflict ? text : text.slice(-6000), at: new Date().toISOString(), level, reportTs: c?.handledTs, baseConflict };
		note("exception " + slug + ": " + reason + " → " + level + (reason === "reconciler error" ? "\n" + text.slice(0, 2000) : ""));
		save();
	}
	/** A queued resolution answers the exception pending when it was queued, never a later one. */
	const dropResolution = (node: string) => rmSync(join(resolutionsDir(controlCwd, s.root), node + ".json"), { force: true });
	type Resolution = { action: "answer" | "retry" | "redispatch" | "move-out" | "escalate" | "skip-drive" | "reopen" | "accept" | "red-repair" | "post-landing"; check?: string; outcome?: PostLandingVerdict["outcome"]; evidence?: string; reportedBy?: string; target?: string; message?: string; note?: string; summary?: string; adopt?: boolean; commit?: string; refinement?: string; checkout?: string };
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
		if (ex.reason === POST_LANDING || r.action === "post-landing") {
			const result = s.results[ex.node];
			const check = result?.postLanding?.find(gate => gate.id === r.check);
			refreshOwner();
			if (ex.reason !== POST_LANDING || r.action !== "post-landing" || r.reportedBy !== s.owner || !check
				|| (r.outcome !== "passed" && r.outcome !== "failed") || typeof r.evidence !== "string" || !r.evidence.trim()) {
				tellOwner("Verdict not applied for " + ex.node + ": only the run owner can report an outstanding post-landing check, with its check ID, passed or failed, and evidence.");
				return;
			}
			const last = check.verdicts?.at(-1), evidence = r.evidence.trim();
			if (last?.outcome !== r.outcome || last.evidence !== evidence || last.by !== r.reportedBy) {
				if (last?.outcome === "passed") {
					tellOwner("Verdict not applied for " + ex.node + ": " + check.id + " already passed.");
					return;
				}
				(check.verdicts ??= []).push({ outcome: r.outcome, evidence, by: r.reportedBy, at: new Date().toISOString() });
				note("post-landing check " + check.id + " for " + ex.node + ": " + r.outcome);
			}
			// Completion closes on all green, or raises a fresh owner exception with the remaining work.
			delete s.exceptions[ex.node];
			return save();
		}
		if (r.action === "red-repair") {
			const c = s.chains[ex.node];
			if (!c?.redHeld || c.phase !== "integrate" || ex.level !== "owner") {
				tellOwner("red-repair for " + ex.node + " ignored: it must be an owner resolution for a landing held by red main.");
				if (ex.reason === "owner red-repair") delete s.exceptions[ex.node];
				return save();
			} else {
				c.redRepair = c.redHeld;
				c.held = false;
				(s.resolved[ex.node] ??= []).push("main is red → red-repair");
				note("owner designated " + ex.node + " as repair for the current red main");
			}
			delete s.exceptions[ex.node];
			return save();
		}
		if (ex.reason === CLEANUP_FAILED) {
			(s.resolved[ex.node] ??= []).push(ex.reason + " → " + r.action + (r.message || r.note || r.summary ? ": " + (r.message ?? r.note ?? r.summary) : ""));
			delete s.exceptions[ex.node];
			if (r.action !== "retry") { finishLandingCleanup(completion, ex.node); note("landing cleanup " + ex.node + " finished by the owner (" + r.action + "), leaving what was left"); }
			else note("landing cleanup " + ex.node + " retried by the owner");
			return save();
		}
		if ((ex.reason === EVIDENCE_MISSING || ex.reason === FOREIGN_COMMIT) && r.action !== "escalate") {
			if (ex.reason === FOREIGN_COMMIT && r.checkout) {
				if (!isAbsolute(r.checkout)) {
					dropResolution(ex.node);
					tellOwner("Foreign commit checkout must be absolute: " + r.checkout + ". Its exception stays pending.");
					return save();
				}
				s.foreignCheckouts ??= {};
				s.foreignCheckouts[ex.node] = [...new Set([...(s.foreignCheckouts[ex.node] ?? []), r.checkout])];
			}
			// Repairs edit the global body or land the missing files; no new code
			// chain and no acceptance override can waive the target-tree check.
			(s.resolved[ex.node] ??= []).push(ex.reason + " → " + r.action);
			delete s.exceptions[ex.node];
			return save();
		}
		if (s.pr && s.landed[s.root] && ex.node === s.root && ex.reason !== EVIDENCE_MISSING) return resolvePr(ex, r);
		if (ex.baseConflict && r.target && r.target !== ex.node) {
			tellOwner("The launch conflict belongs to " + ex.node + "; resolve it on that node. The exception stays pending.");
			return;
		}
		const target = r.target && s.chains[r.target] ? r.target : ex.node;
		const c = s.chains[target];
		if (!ex.baseConflict && r.action === "retry" && r.refinement && s.refinements[r.refinement]?.successor) {
			delete s.exceptions[ex.node];
			if (c) c.held = false;
			// The saved replacement (including partial adoption) is recovered by
			// tick before resolutions; do not replace its successor a second time.
			return save();
		}
		const adopted = typeof r.commit === "string" && /^[0-9a-f]{7,64}$/i.test(r.commit) ? commitRef(controlCwd, r.commit) : undefined;
		if (r.commit !== undefined && (!adopted || !c || !["answer", "retry", "redispatch"].includes(r.action))) {
			tellOwner("Adoption requires an existing commit ID and an answer, retry or redispatch for a running chain. The exception stays pending.");
			return;
		}
		if (ex.baseConflict && c?.pendingLaunch && (r.action === "answer" || r.action === "retry")) {
			const { base, requirement } = ex.baseConflict;
			if (adopted ? !isAncestor(controlCwd, base, adopted) || !isAncestor(controlCwd, requirement.head, adopted) : r.action !== "answer") {
				tellOwner("To release " + ex.node + ", provide a merged commit containing " + base + " and " + requirement.head + ", or answer without a commit. The exception stays pending.");
				return;
			}
			if (adopted) {
				keepCheckpoint(target, adopted, adopted);
				c.pendingLaunch.base = adopted;
			} else {
				((s.launchWaivers ??= {})[target] ??= []).push(conflictKey(base, requirement.head));
				(c.pendingLaunch.waived ??= []).push(requirement.head);
				c.pendingLaunch.base = base;
			}
			c.note = r.message ?? r.note ?? c.note;
			c.held = false;
			delete s.exceptions[ex.node];
			(s.resolved[ex.node] ??= []).push(ex.reason + " → " + (adopted ? "adopt " + adopted : "launch without " + requirement.head));
			note("resolved " + ex.node + ": " + r.action);
			return save();
		}
		if (ex.baseConflict && r.action !== "move-out") {
			tellOwner("Resolve the launch conflict on " + ex.node + " with retry and a merged commit, or answer to launch without the requirement.");
			return;
		}
		if (adopted) keepCheckpoint(target, adopted, adopted);
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
		if (r.action === "accept" && (!c || c.phase !== "review")) {
			// The exception stays for another resolution: a throw here would fail every tick on the same file.
			dropResolution(ex.node);
			note("accept for " + target + " ignored: it has " + (c ? "a " + c.phase + " chain" : "no chain") + ", not a review");
			tellOwner("accept for " + target + " was not applied: accept lands a review whose stories are unobservable by design, and " + target + " has " + (c ? "a " + c.phase + " chain" : "no chain") + ". Its exception stays pending; resolve it another way.");
			return save();
		}
		delete s.exceptions[ex.node];
		if (ex.node !== target && s.chains[ex.node]) s.chains[ex.node].held = false;
		// A repair budget the owner answered starts again: else the worker's next report re-raises it at once (2026-10-30, concept).
		const spent = /^(.+) \(after \d+ repairs\)$/.exec(ex.reason)?.[1];
		if (c && spent) delete c.retries[spent];
		// A resolution restarts any wait: else a `waiting stalled` exception re-raises on the next tick.
		if (c) { c.waitingSince = undefined; c.waitingCheckedAt = undefined; c.waitingVoidNudged = undefined; }
		if (r.action === "answer" && !adopted && c?.handle && alive(c.handle) !== false) { await sendChild(c.handle, r.message ?? r.note ?? ""); c.held = false; c.handledTs = ex.reportTs ?? c.handledTs; }
		else if (r.action === "answer" || r.action === "retry") { if (c) { c.held = false; c.note = r.message ?? r.note; if (!issue) throw new Error("resolution target " + target + " is not in the global tracker"); await startPhase(target, c, c.phase === "integrate" ? "review" : c.phase, issue, issues, "", r.action === "retry" && r.adopt === true); } }
		else if (r.action === "redispatch") {
			// A redispatch starts over from the parent's head; the superseded chain's commits stay on its kept branch,
			// which the new implementer is told about rather than silently missing (2026-10-12: it had to ask for them).
			const kept = !adopted && c?.handle ? keptWork(c) : undefined;
			if (c) { await retireChain(c); delete s.chains[target]; }
			s.resolved[target] ??= [];
			pendingNotes.set(target, [r.note ?? r.message, kept].filter(Boolean).join("\n\n") || undefined);
		}
		else if (r.action === "accept") {
			// A review that reported done is handled again, now with its unobservable stories accepted; one that asked
			// (needs-input, blocked) is told, and its next done lands with them.
			const why = c!.acceptUnobservable = r.note ?? r.message ?? r.summary ?? "accepted by the owner";
			c!.held = false;
			const last = c!.handle && fresh(c!.handle, undefined, c!.launchedAt);
			if (last && parse(last.body).status === "done") c!.handledTs = undefined;
			else if (c!.handle && alive(c!.handle) !== false) { await sendChild(c!.handle, "The owner accepts stories that can't be observed by design as `unobservable`: " + why + "\n\nReport `done` with them as `unobservable`; every other story still needs `held`."); c!.handledTs = ex.reportTs ?? c!.handledTs; }
			else await startPhase(target, c!, "review", issue!, issues, "The owner accepts stories that can't be observed by design as `unobservable`: " + why);
		}
		else if (r.action === "skip-drive") {
			if (c) {
				c.held = false; c.skipDrive = r.note ?? r.message ?? "skipped by the supervisor";
				if (c.phase === "drive") await startPhase(target, c, "review", issue!, issues, skippedDrive(c.skipDrive));
			}
		}
		else if (r.action === "move-out") {
			const closed = issue?.done || issue?.archived;
			if (c) { await retireChain(c, { preserveTracker: closed }); delete s.chains[target]; }
			if (closed) {
				delete s.moved[target];
				tellOwner("retired workers for " + target + "; the closed issue is unchanged");
			} else {
				const reason = r.summary ?? r.note ?? ex.reason;
				tracker.moveOut?.(target, reason);
				releaseRefinementClaims(refinement, target);
				s.moved[target] = reason;
				tellOwner("moved out " + target + ": " + reason);
			}
			dropResolution(target);
		}
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
		if (ex.reason === DELIVERED_ACTIVE || ex.baseConflict) return undefined;
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
			if ((ex.reason === EVIDENCE_MISSING || ex.reason === FOREIGN_COMMIT) && s.results[ex.node]?.closedAt) {
				if (ex.handler) await retireHandle(ex.handler, controlCwd);
				delete s.exceptions[ex.node]; dropResolution(ex.node); save();
				continue;
			}
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
				if (ex.reason === POST_LANDING) refreshOwner();
				if (!ex.mailed || (ex.reason === POST_LANDING && ex.postLandingOwnerNotified !== s.owner)) {
					if (ex.reason === POST_LANDING) {
						ex.postLandingOwnerNotified = s.owner;
						const checks = outstandingChecks(s.results[ex.node]);
						const next = checks.find(gate => gate.verdicts?.at(-1)?.outcome === "failed") ?? checks[0];
						if (next) tellOwner("Post-landing gate assigned to you as run owner: " + ex.node + "\n\n" + clip(ex.text, 6000)
							+ (next.verdicts?.at(-1)?.outcome === "failed" ? "\n\nRepair the failed gate's cause and rerun it. The ticket remains open." : "\n\nRun the pending checks against the landed target.")
							+ " Record each result separately: tools.reconcile_resolve({issue: " + JSON.stringify(s.root) + ", node: " + JSON.stringify(ex.node)
							+ ', action: "post-landing", check: ' + JSON.stringify(next.id) + ', outcome: "passed" | "failed", evidence: "run URL or concrete observation"}).');
					} else tellOwner("needs you: " + ex.node + " — " + ex.reason + "\n\n" + (ex.baseConflict ? clip(ex.text, 6000) : ex.text.slice(-3000)) + "\n\nResolve with tools.reconcile_resolve({issue: \"" + s.root + "\", node: \"" + ex.node + "\", action: answer|retry|redispatch|move-out|reopen|accept, commit?, checkout?, message?, note?, summary?}). Move-out retires the workers. For an open issue, record the honest stage and problem in the tracker, keeping part-of; the resolution assigns it to human and parks this tree until it returns to an agent. accept lands a review whose stories are unobservable by design, with `note` saying why. reopen ends a join whose children reopened: its commits land in its collector as the reopened children's base, and the walk runs them.");
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
	/** done only words the owner's notice. */
	async function retireHandle(h: Handle, into: string, done = false): Promise<boolean> {
		try { await retireTelling(h, into, done); return true; }
		catch (e) { note("retire " + h.handle + ": " + e); return false; }
	}
	/** retireHandle that throws, and returns what retirement did. */
	async function retireTelling(h: Handle, into: string, done = false) {
			const r = await retire(h, { cwd: into });
			if (r.gone) {
				note("retire " + h.handle + ": its bb thread is gone, so it was already stopped" + (r.gone.worktree ? "; its worktree " + r.gone.worktree + " is left as it is, ignored state and all" : ""));
				if (r.gone.worktree) tellOwner(h.handle + "'s bb thread is gone; its worktree " + r.gone.worktree + " (branch " + h.handle + ") is left as it is, with its ignored state. Remove it (git worktree remove) once nothing there is needed.");
			}
			const wip = ((r.removed as { branchesKept?: { branch: string; reason: string }[] } | undefined)?.branchesKept ?? []).find(b => b.reason.startsWith("uncommitted work saved"));
			if (wip) { note("retired " + h.handle + " with uncommitted work: branch " + wip.branch + ", " + wip.reason); tellOwner("retired " + h.handle + " with uncommitted work in its worktree; it is kept on branch " + wip.branch + " (" + wip.reason + ")."); }
			return r;
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
	async function retireChain(c: Chain, { finished = false, preserveTracker = false } = {}) {
		const attempt = c.refinement ? s.refinements[c.refinement] : undefined;
		const active = attempt && !["accepted", "removed"].includes(attempt.phase);
		if (active && !preserveTracker) await discardRefinement(refinement, attempt.handle);
		for (const h of [...c.workers, ...(c.handle ? [c.handle] : [])]) {
			if (preserveTracker) await retireTelling(h, pathOf(c.into), finished);
			else await retireHandle(h, pathOf(c.into), finished);
		}
		// The issue was closed outside this run: end the attempt without pruning its tracker drafts.
		if (active && preserveTracker) attempt.phase = "removed";
	}
	/** A landed node's workers join its landing receipt, which outlives the chain: the receipt alone may predate them, when
	 * the landing was recorded from an earlier integration attempt's receipt (2026-10-25, Concept: a receipt naming
	 * review-3 and review-4 while review-5 reviewed last). */
	function receiptWorkers(slug: string, c: Chain) {
		const operation = s.landingOps[slug];
		if (!operation) return;
		const workers = [...operation.workers, ...c.workers, ...(c.handle ? [c.handle] : [])]
			.filter((w, i, all) => all.findIndex(o => o.run === w.run && o.handle === w.handle) === i);
		if (workers.length !== operation.workers.length) { s.landingOps[slug] = { ...operation, workers }; save(); }
	}
	/** Consecutive failed cleanups per landing, this process; the limit raises one owner exception. */
	const cleanupFailures = new Map<string, number>();
	/** Receipts outlive chains. A partial retirement/deletion is retried next tick, and raised to the owner once it keeps
	 * failing. A worker whose worktree or bb thread is gone is already retired. Settled collectors discard untracked
	 * and ignored state, as worker retirement does; tracked changes and unlanded commits still need the owner. */
	async function cleanupLandings() {
		for (const operation of Object.values(s.landingOps)) {
			if (!s.landed[operation.slug] || !operation.landedHead || operation.cleanupDone) continue;
			if ([CLEANUP_FAILED, DELIVERED_ACTIVE].includes(s.exceptions[operation.slug]?.reason ?? "")) continue;
			try {
				const threads = await bbThreads();
				for (const worker of operation.workers) {
					// Do not ask retirement to discover a repository through a stale worker directory.
					if (!existsSync(worker.path) || !(await worktrees(controlCwd)).some(t => t.path === resolve(worker.path))) {
						git(controlCwd, "worktree", "prune", "--expire", "now");
						continue;
					}
					const found = await findWorker(worker, controlCwd);
					const thread = found && threads.get(found.bb);
					if (!thread || thread.archivedAt) continue;
					const result = await retireTelling(worker, controlCwd, true);
					if (git(controlCwd, "branch", "--list", worker.handle) && result.branchKept)
						throw new Error(result.branchKept);
				}
				const col = operation.collector;
				if (col) {
					if (git(controlCwd, "branch", "--list", col.branch)
						&& git(controlCwd, "cherry", git(operation.destination, "rev-parse", "HEAD"), col.branch).split("\n").some(l => l.startsWith("+")))
						throw new Error("Collector has unlanded commits: " + col.branch);
					if (existsSync(col.path)) {
						if (git(col.path, "status", "--porcelain", "--untracked-files=no"))
							throw new Error("Collector has tracked modifications: " + col.path);
						git(controlCwd, "worktree", "remove", "--force", col.path);
					}
					if (git(controlCwd, "branch", "--list", col.branch)) git(controlCwd, "branch", "-D", col.branch);
					if (s.collectors[operation.slug]?.path === col.path) delete s.collectors[operation.slug];
				}
				finishLandingCleanup(completion, operation.slug);
				cleanupFailures.delete(operation.slug);
			} catch (e) {
				const failures = (cleanupFailures.get(operation.slug) ?? 0) + 1;
				cleanupFailures.set(operation.slug, failures);
				if (failures === 1) note("landing cleanup " + operation.slug + " deferred: " + e);
				if (failures < BUDGET.cleanup) continue;
				cleanupFailures.delete(operation.slug);
				raise(operation.slug, CLEANUP_FAILED, operation.slug + " landed at " + operation.landedHead + ", but cleaning up after it failed "
					+ failures + " times in a row:\n\n" + String((e as Error)?.message ?? e).slice(0, 3000) + "\n\nWorkers it retires: "
					+ operation.workers.map(w => w.handle).join(", ") + (operation.collector ? "; collector " + operation.collector.path : "")
					+ ".\n\nretry tries again (fix the cause first); answer finishes the cleanup, leaving what's left as it is.", new Map(), "owner");
			}
		}
	}
	async function land(slug: string, c: Chain, issue: Issue): Promise<string | undefined> {
		const into = pathOf(c.into), h = c.handle!;
		if ((s.land ?? "local") === "local" && c.into === cwd) {
			const red = mainRed(cwd);
			const text = tracker.text(issue.slug) + "\n" + JSON.stringify(s.results[slug]?.handoff ?? {});
			if (red && heldByRed(red, git(h.path, "diff", "--name-only", git(into, "rev-parse", "HEAD") + "...HEAD").split("\n").filter(Boolean), { text, ownerRed: c.redRepair })) {
				if (c.redHeld !== red) {
					note("landing " + slug + " waits for a green main");
					tellOwner("landing " + slug + " waits: main is red.\n\n" + red + "\n\nIf this landing repairs it, use reconcile_resolve with action: red-repair on " + slug + ".");
				}
				c.redHeld = red; save();
				// Let the next tick read owner resolutions and refreshed issue text.
				return;
			}
			c.redHeld = undefined;
		}
		const before = git(into, "rev-parse", "HEAD");
		const result = s.results[slug];
		if (!result) throw new Error("No saved reviewed result for " + slug);
		const outcome = await landReviewed(completion, { slug, into: c.into, worker: h,
			workers: c.workers, collector: s.collectors[slug], result,
			tests: [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])] });
		if (!outcome.ok) {
			if (!outcome.log) return outcome.failure;
			// The whole output stays on this host for the worker, whose message shows its tail.
			const file = join(stateDir(controlCwd), s.root + ".integrate", slug + "-" + new Date().toISOString().replace(/[:.]/g, "-") + ".log");
			try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, outcome.log); }
			catch (e) { return outcome.failure + "\n\n(saving the full output failed: " + e + ")"; }
			return outcome.failure + "\n\nFull output: " + file;
		}
		s.tests[c.into] = [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])];
		const landed = git(into, "diff", "--name-only", before, outcome.head).split("\n").filter(Boolean);
		note("landed " + slug + " in " + (c.into === cwd ? "the owner's checkout" : c.into));
		const hook = outcome.output && hookFailure(outcome.output);
		if (hook) { note("landing " + slug + ": a merge hook failed: " + hook.split("\n")[0]); tellOwner("landed " + slug + " at " + git(into, "rev-parse", "--short", "HEAD") + ", but a merge hook failed; what it does after landing (a push, a verify) did not happen:\n\n" + hook); }
		if (slug === s.root && s.pr) { s.pr.preparedHead = outcome.head; s.pr.phase = "opening"; }
		receiptWorkers(slug, c);
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
		const h = c.handle!, r = parse(m.body, h.path), text = m.body;
		if (c.phase === "integrate") { c.phase = "review"; }
		if (m.tags.includes("error")) {
			const kind = m.errorCategory === "rate-limit" ? "rate limit or quota" : errorClass(text);
			if (nativeRateLimit(h, m) && h.bb) {
				const after = await bbWorkerRoute(h.bb);
				if (after) {
					c.retries.provider = (c.retries.provider ?? 0) + 1;
					c.pendingLaunch = { phase: c.phase, extra: "", adopt: c.phase === "refine", finished: false, after };
					note("provider rate limit on " + slug + "; replacing " + after.model + " in " + after.agent + "'s model list");
					save();
					return startPhase(slug, c, c.phase, issue, issues);
				}
			}
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
		if (r.status === null) return repair(slug, c, "status", statusRepairMessage(text, r.handoffError), issues, text);
		if (r.handoffError) return repair(slug, c, "handoff", "Your handoff block did not parse (" + r.handoffError + "). Repost your report with valid fenced yaml.", issues, text);
		if (r.handoff?.respec || r.status === "blocked" || r.status === "needs-input" || r.status === "checkpoint")
			keepReportedCheckpoints(slug, h, r.handoff?.commit);
		if (c.phase === "implement" && !c.self && r.handoff?.respec) {
			c.retries.respec = (c.retries.respec ?? 0) + 1;
			if (c.retries.respec > 1) return raise(slug, "respec after refinement", text, issues);
			note("respec " + slug + ": back to refinement");
			c.base = undefined;
			c.pendingLaunch = { phase: "refine", extra: "An implementer found this bigger than one session:\n\n" + text,
				adopt: false, finished: false, base: git(pathOf(c.into), "rev-parse", "HEAD") };
			save();
			const kept = c.retries.respec;
			await startPhase(slug, c, "refine", issue, issues);
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
		const reviewShape = c.phase === "review"
			? storyShapeError(r.handoff, c.self) ?? (c.self && r.handoff?.evidence === undefined ? null : evidenceShapeError(r.handoff))
			: null;
		const blocked = r.status === "blocked" || r.status === "needs-input";
		const postLanding = blocked && c.phase === "review" && !reviewShape && r.handoff?.postLanding !== undefined
			? selectPostLanding(r.handoff, issue.ownStage === "ticket" ? tracker.fields(slug)["post-landing"] : undefined) : [];
		if (typeof postLanding === "string") return repair(slug, c, "post-landing", postLanding + " Repost your review.", issues, text);
		if (blocked && !postLanding.length) {
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
			const filed = c.self && s.collectors[slug] ? [...view(slug).values()].filter(i => i.partOf === slug && !finished(i)).map(i => i.slug) : [];
			if (filed.length) return joinFiledChildren(slug, c, filed, issues, text);
			c.setup = r.handoff?.setup ?? null;
			c.note = undefined;
			c.skipDrive ??= driveNone(issue);
			if (c.skipDrive) { note("drive skipped for " + slug + ": " + c.skipDrive); return startPhase(slug, c, "review", issue, issues, skippedDrive(c.skipDrive), false, undefined, true); }
			const setupProblem = setupError(c.setup);
			if (setupProblem) return repair(slug, c, "setup", "Your " + setupProblem + ". Supply a runnable public CLI/browser/tool entry point with isolated setup, readiness and cleanup for the story persona. A unit-test command alone is not setup. Commit any needed setup recipe and report done again with the repaired setup handoff.", issues, text);
			return startPhase(slug, c, "drive", issue, issues, "", false, undefined, true);
		}
		if (c.phase === "drive") {
			const shape = storyShapeError(r.handoff, c.self) ?? (r.handoff?.evidence !== undefined ? evidenceShapeError(r.handoff) : null);
			if (shape) return repair(slug, c, "drive-shape", "Your handoff is malformed: " + shape + ". Repost it.", issues, text);
			c.drive = r.handoff!;
			c.note = undefined;
			return startPhase(slug, c, "review", issue, issues, "Driver's final message:\n\n" + text.slice(-4000) + "\n\nThe driver's worktree is retired as you start, discarding its ignored state (local deployment, .wm/ output): review from its branch and the evidence it committed.", false, undefined, true);
		}
		// review
		if (reviewShape) return repair(slug, c, "review-shape", "Your handoff is malformed: " + reviewShape + ". Repost it.", issues, text);
		const stories = (r.handoff!.stories as { outcome: string }[]);
		const notHeld = stories.findIndex(x => x.outcome !== "held" && !((c.acceptUnobservable || postLanding.length) && x.outcome === "unobservable"));
		if (notHeld >= 0) return repair(slug, c, "unheld", "You reported done, but stories[" + notHeld + "] is not held. `done` needs every story held on your final head: repair it, or report `blocked`/`needs-input`. If the ticket declares gates for all remaining checks, report `blocked` with the full handoff and their gate IDs in `postLanding`. For other stories unobservable by design, report `needs-input` naming them and why.", issues, text);
		const accepted = c.acceptUnobservable && stories.some(x => x.outcome === "unobservable") ? { accepted: "unobservable stories accepted by the owner: " + c.acceptUnobservable } : {};
		if (accepted.accepted) note(slug + " lands with unobservable stories the owner accepted");
		c.evidence = { ...r.handoff!, ...accepted, tests: [...new Set([...testCommands(c.drive), ...testCommands(r.handoff)])] };
		s.results[slug] = reviewedResult(issue.partOf, c.evidence, text, postLanding);
		for (const check of postLanding) note("post-landing check for " + slug + ": " + check.id + " (run owner after target landing)");
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
		await retireChain(c, { finished: true });
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
		const open = [...view(s.collectors[slug].path).values()].filter(i => i.partOf === slug && !finished(i)).map(i => i.slug);
		note("reopened " + slug + (open.length ? " for " + open.join(", ") : "") + "; its commits landed in " + s.collectors[slug].branch + ", and it starts again from there once they land");
		delete s.chains[slug]; save();
		await retireChain(c, { finished: true });
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
			await sendChild(h, "Integration into " + (c.into === cwd ? "the owner's checkout" : "the parent branch") + " failed:\n\n" + clip(failure, 9000) + "\n\nRebase onto " + git(pathOf(c.into), "rev-parse", "HEAD") + " (git rebase <that sha>), resolve, make the gate and tests pass, commit, and report done again with your full handoff.");
			note("integration of " + slug + " failed (" + c.retries.integrate + "), sent back: " + failure.split("\n")[0]);
			save();
		}
	}
	/** The destinations above a collector: its enclosing collectors, found by parent branch, up to the owner's checkout. */
	function enclosing(slug: string): Set<string> {
		const up = new Set<string>();
		for (let branch = s.collectors[slug]?.parentBranch; branch;) {
			const parent = Object.entries(s.collectors).find(([key, col]) => col.branch === branch && !up.has(key));
			if (!parent) { up.add(cwd); if (s.pr) up.add(s.pr.path); break; }
			up.add(parent[0]); branch = parent[1].parentBranch;
		}
		return up;
	}
	/** A collector is cut from its parent once. A blocker or descendant that lands in an enclosing collector afterwards
	 * satisfies nothing here until this branch contains its head (view's inherited set).
	 * When the parent contains that delivery, merge it in before scheduling the node or its children;
	 * a conflict goes to the owner. 2026-11-07 (concept, release-the-open-local-product): five dependents in two sub-collectors
	 * waited on landings in the root collector until it was merged into them by hand. */
	async function catchUp(slug: string, into: string, own: Map<string, Issue>): Promise<boolean> {
		const col = s.collectors[slug], up = enclosing(slug), parent = pathOf(into), landed = new Set<string>();
		for (const k of own.values()) {
			if (finished(k) || (k.slug !== slug && !descends(k, slug, own))) continue;
			// A reviewed descendant can have landed in an enclosing collector after it was reparented here.
			// It is frontier in this stale branch, but needs its delivered code, not another implementation.
			for (const b of [k.slug, ...k.blockers]) {
				const entry = s.landed[b];
				if (entry && up.has(entry.into) && isAncestor(parent, entry.head) && !isAncestor(col.path, entry.head)) landed.add(b);
			}
		}
		if (!landed.size) return false;
		const head = git(parent, "rev-parse", "HEAD"), what = [...landed].join(", ");
		return locked(async () => {
			// Someone (the owner resolving a conflict) is mid-merge here: leave it alone, and never abort their merge.
			if (existsSync(join(git(col.path, "rev-parse", "--absolute-git-dir"), "MERGE_HEAD"))) { note("collector " + slug + " is mid-merge; catch-up waits"); return false; }
			// Projects' diff-shape hooks refuse large commits without a `[big: <why>]` trailer; a catch-up merge is large by nature.
			try { git(col.path, "merge", "--no-edit", "-m", "Merge " + col.parentBranch + " into " + col.branch + ": " + what + " landed there\n\n[big: merge of " + col.parentBranch + " into the tree branch]", head); }
			catch (e: any) {
				const files = (() => { try { return git(col.path, "diff", "--name-only", "--diff-filter=U"); } catch { return ""; } })();
				try { git(col.path, "merge", "--abort"); } catch {}
				raise(slug, "collector cannot take its parent's landing of " + what, what + " landed in " + col.parentBranch + " after " + col.branch + " was cut, and open work under " + slug + " is blocked by it. Merging " + col.parentBranch + " (" + head.slice(0, 10) + ") into " + col.branch + " failed" + (files ? " with conflicts in:\n" + files : ": " + String(e?.stderr ?? e?.message ?? e).slice(0, 2000)) + "\n\nMerge it by hand in " + col.path + ", commit, then resolve with retry.", own, "owner");
				return false;
			}
			note("merged " + col.parentBranch + " into " + col.branch + ": " + what + " landed there");
			return true;
		});
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
		const ideas = [...current.values()].filter(i => i.ownStage === "idea" && !s.moved[i.slug] && !s.exceptions[i.slug] && !s.chains[i.slug] && !finished(i) && !i.provisional && descends(i, slug, current));
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
			await retireChain(c, { finished: true });
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
		// Closed at its destination by someone else while its chain runs (superseded by the maintainer, 2026-11-21 Concept):
		// returning done left the chain unvisited for good, its worker's `done` never read. Hold it for the owner instead.
		const closedUnder = s.chains[slug] && !s.landed[slug] ? s.chains[slug] : undefined;
		if (issue && finished(issue) && closedUnder) {
			if (!s.exceptions[slug]) raise(slug, CLOSED_ACTIVE, slug + " is " + issue.effectiveStage + " in " + into + ", but this run never landed it: it was closed while its " + closedUnder.phase
				+ " worker " + (closedUnder.handle?.handle ?? "(unreceipted)") + " still runs. Reopen it (stage back to ticket) to carry on: this exception withdraws itself and the worker's latest report is handled as usual. Or resolve move-out to retire its workers; their branches are kept.\n\n"
				+ (fresh(closedUnder.handle, undefined, closedUnder.launchedAt)?.body ?? ""), new Map(), "owner");
			return "active";
		}
		if (s.exceptions[slug]?.reason === CLOSED_ACTIVE && closedUnder && issue) await withdraw(s.exceptions[slug], closedUnder, "it was reopened.");
		if (!issue || finished(issue)) return "done";
		if (isMoved(issue)) { holds.set(slug, "moved out for human work: " + s.moved[slug]); return "stuck"; }
		// A restart with fresh state adopts the collector left on disk before reading its children:
		// a kid can be frontier only there (its blockers landed in the collector, not the owner).
		if (!s.collectors[slug] && existsSync(collectorPath(slug))) ensureCollector(slug, into);
		let own = view(s.collectors[slug] ? slug : into);
		if (s.collectors[slug] && !s.exceptions[slug] && await catchUp(slug, into, own)) own = view(slug);
		if ((s.collectors[slug] || slug === s.root) && await setAsideIdeas(slug, own)) {
			own = view(s.collectors[slug] ? slug : into);
			issue = view(into).get(slug)!;
		}
		const refining = s.chains[slug]?.phase === "refine";
		// Visit the writer before its newly published children. Withholding is
		// also enforced by schedulingView for every destination.
		const kids = [...own.values()].filter(i => i.partOf === slug && !finished(i));
		if (kids.length && !s.chains[slug] && !refining) {
			if (s.exceptions[slug]) return "active";
			ensureCollector(slug, into);
			const below = await Promise.all(kids.map(k => {
				const current = view(slug), child = current.get(k.slug)!;
				if (isMoved(child)) { holds.set(k.slug, "moved out for human work: " + s.moved[k.slug]); return "stuck"; }
				return child.frontier || s.chains[k.slug] || s.collectors[k.slug] ? visit(k.slug, slug, current)
					: (holds.set(k.slug, why(child, current)), Promise.resolve("stuck" as const));
			}));
			return below.includes("active") ? "active" : "stuck";
		}
		// A node that gained an open blocker (e.g. a reopened sibling) is parked: its chain is retired, and it starts
		// fresh from the collector once the blocker has landed there.
		const parkingBlockers = refining ? [...issue.blockedBy.filter(blocker => !issues.get(blocker)?.satisfied), ...issue.guards] : issue.blockers;
		if (s.chains[slug] && slug !== s.root && parkingBlockers.length && !s.exceptions[slug]?.baseConflict) {
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
		const recovers = !!ex && /^provider error: | errored in bb$| log unreadable$/.test(ex.reason);
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
			if (s.landed[slug]) {
				const entry = s.landed[slug];
				raise(slug, "recorded landing missing from destination", "Reviewed code " + entry.head + " landed in " + entry.into
					+ ", but is absent from " + into + ". Bring the existing delivery into this destination before continuing.", issues, "owner");
				return "active";
			}
			if (s.collectors[slug]) issue = own.get(slug)!;
			// Satisfied in its own collector but not landed: only the join remains, whatever its derived stage (a refinement
			// that omitted the parent's stage, its last open child moved out). 2026-10-28 (arkhai-payments, mediation-cases):
			// held as "effective stage done" with 12 commits unlanded in its collector. Blockers and claims are read where it lands.
			const outer = view(into).get(slug);
			const joinOnly = !!s.collectors[slug] && issue.satisfied && !s.landed[slug] && !!outer && !outer.blockers.length && !outer.claims.length;
			if (!issue.frontier && slug !== s.root && !joinOnly) { holds.set(slug, why(issue, issues)); return "stuck"; }
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
					keepCheckpoint(slug, resumed.head, "refs/heads/" + resumed.branch);
					note("resume for " + slug + " returns to implementation: new children landed since " + resumed.branch + "; advancing from the collector");
				}
				else if (usable) {
					keepCheckpoint(slug, resumed.head, "refs/heads/" + resumed.branch);
					Object.assign(chain, { phase: resumed.phase, base: resumed.base ?? chain.base, setup: resumed.setup, drive: resumed.drive, skipDrive: resumed.skipDrive, note: chain.note ?? resumed.note, resumeFrom: resumed.head });
				}
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
		if (c.pendingLaunch) {
			await startPhase(slug, c, c.pendingLaunch.phase, issue, issues);
			return "active";
		}
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
		if (!c.handle || c.launching) {
			await startPhase(slug, c, c.launchPhase ?? c.phase, issue, issues);
			return "active";
		}
		const m = fresh(c.handle, c.handledTs, c.launchedAt);
		if (m && m.tags.includes("error") && c.handle && (observedWorking(c.handle) || (!nativeRateLimit(c.handle, m) && Date.now() - Date.parse(m.ts) < ERROR_SETTLE_MS))) return "active";
		if (!m && c.handle && bbErrored(c.handle)) { raise(slug, c.phase + " worker errored in bb", await bbError(c.handle), issues, "owner"); return "active"; }
		// A log that can't be read hides the worker's reports: the chain would wait on it silently (14h, 2026-11-06, concept).
		const unread = !m && c.handle ? unreadable.get(topic(c.handle)) : undefined;
		if (unread && Date.now() - unread.since > UNREADABLE_MS) {
			raise(slug, c.phase + " worker log unreadable", "Reading " + c.handle!.handle + "'s bb thread log" + (c.handle!.bb ? " (" + c.handle!.bb + ")" : "") + " has failed since " + new Date(unread.since).toISOString() + ", so its reports can't reach the reconciler:\n\n" + unread.error + "\n\nThe exception withdraws itself once the log reads again and the worker has reported.", issues, "owner");
			return "active";
		}
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
		const active = observedWorking(c.handle) ? readLive().find(l => l.thread === c.handle!.bb && l.state === "working") : undefined;
		// Prefer a nested call to its enclosing codemode script, so the notice names the actual command.
		const stalled = active?.tools?.filter(t => Date.now() - Date.parse(t.since) > TOOL_CALL_MS)
			.findLast(t => !active.tools!.some(child => child.parent === t.id));
		if (stalled && active?.sessionFile && managedProcess(active.sessionFile) === false) {
			raise(slug, c.phase + " tool call stalled", "Tool " + stalled.name + " has been running since " + stalled.since + " (over 45m) with no running managed process.\n\nCommand: " + (stalled.command ?? "(no command argument)") + "\n\nWorker: " + c.handle.handle + " (" + c.handle.bb + ")", issues, "owner");
			return "active";
		}
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
		await startPhase(slug, c, "implement", issue, issues, "", false, undefined, !!c.handle, from);
	}
	const visited = new Set<string>();
	// Move-out retains the parent. Keep the park until the reassigned node is ready to run here.
	function isMoved(i: Issue): boolean {
		if (!s.moved[i.slug]) return false;
		if (!/^(agent|model:)/.test(i.assignee?.trim() ?? "") || !i.frontier) return true;
		note("moved back in: " + i.slug); delete s.moved[i.slug]; dropResolution(i.slug); save();
		return false;
	}

	// --- main loop -------------------------------------------------------------------------------------
	if (!o.quiet) tellOwner("started (budget " + s.budget + ")");
	else note("started quietly (budget " + s.budget + ")");
	// A tick that throws is told to the owner once per distinct error and retried, never a silent exit.
	let tickError = "";
	const code = new CodeMonitor();
	for (;;) {
		if (o.signal?.aborted) return;
		try {
			if (await untilReset(tick, { note, signal: o.signal })) return await told;
			tickError = "";
			// Integrate/rebase are awaited by tick, so none runs here. A landed node whose cleanup is still
			// being retried waits. Other receipts stay in the ledger: a failed landing's (its exception may be what the new
			// code fixes), a finished one's, or a cleanup already raised to the owner must not prevent refresh; a merge that
			// reached its target is recovered on start.
			if (code.changed() && !Object.values(s.landingOps).some(op => s.landed[op.slug] && !op.cleanupDone && s.exceptions[op.slug]?.reason !== CLEANUP_FAILED)) {
				await told;
				note("code changed on disk; restarting");
				save();
				updateState(controlCwd, s.root, prior => {
					if (prior!.stopping || prior!.pid !== process.pid) return prior!;
					const child = spawnRun({ cwd: controlCwd, root: s.root, owner: prior!.owner, ownerSession: prior!.ownerSession,
						budget: s.budget, land: s.land, quiet: true }, stateDir(controlCwd), process.pid,
						{ ...process.env, TRACKER_CLI: inheritedTrackerCli });
					return { ...prior!, pid: child.pid };
				});
				return;
			}
		}
		catch (e) {
			const msg = String((e as Error)?.stack ?? e);
			if (msg.split("\n")[0] !== tickError) { tickError = msg.split("\n")[0]; note("tick failed: " + msg.slice(0, 2000)); tellOwner("tick failed, retrying every " + TICK_MS / 1000 + "s:\n\n" + msg.slice(0, 3000)); }
		}
		await Bun.sleep(TICK_MS);
	}
	/** One reconciliation pass; true when the run is over. */
	async function tick(): Promise<boolean> {
		await observeHost();
		noteWorkerSessions();
		await pollTurns();
		releaseWorkerClaims();
		for (const [slug, col] of Object.entries(s.collectors)) if (!sparseCollectors.has(slug)) ensureCollector(slug, col.parentBranch);
		if (Object.values(s.landingOps).some(op => !s.landed[op.slug]))
			await locked(async () => recoverLandings(completion));
		closeAtTarget(completion);
		await recoverRefinements(refinement);
		// A bb spawn can precede the receipt save. Adopt only exact run/handle.
		for (const [slug, c] of Object.entries(s.chains)) {
			if (s.landed[slug] && c.phase !== "integrate") {
				// An old landing is no completion receipt for a newly started worker. Keep its worktree/processes
				// for the owner instead of deleting the chain every tick (Concept snapshot, 2026-11-09).
				raise(slug, DELIVERED_ACTIVE, "Recorded delivery " + s.landed[slug].head + " in " + s.landed[slug].into
					+ " coexists with " + c.phase + " worker " + (c.handle?.handle ?? c.launching ?? "(unreceipted)")
					+ ". Its work is retained; reconcile the existing delivery and worker before continuing.\n\n"
					+ (fresh(c.handle, undefined, c.launchedAt)?.body ?? ""), view(c.into), "owner");
				continue;
			}
			if (s.landed[slug]) {
				s.tests[c.into] = [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])];
				receiptWorkers(slug, c);
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
		let top = view(destination());
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
				if (s.exceptions[s.root] && ![EVIDENCE_MISSING, FOREIGN_COMMIT, POST_LANDING].includes(s.exceptions[s.root].reason)) { delete s.exceptions[s.root]; save(); }
				closeAtTarget(completion);
				if (!s.target || Object.values(s.results).some(result => !result.closedAt)) return false;
				if (Object.values(s.landingOps).some(op => s.landed[op.slug] && !op.cleanupDone)) return false;
				s.finished = "done"; s.finishedAt = Date.now(); save();
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
		let result: Awaited<ReturnType<typeof visit>>, pending: number;
		for (;;) {
			const before = s.landed;
			visited.clear();
			result = await visit(s.root, destination(), top);
			if (s.pr && s.landed[s.root]) return false;
			pending = Object.keys(s.exceptions).length;
			await handleExceptions(top);
			// A child can have been checked before a sibling landed or an exception resolution integrated it.
			// Completion replaces the ledger on every landing; rewalk with those receipts before stopping.
			if (s.landed === before || (result !== "stuck" && !holds.size)) break;
			holds.clear();
			top = view(destination());
		}
		// A resolution applied after a walk that found work held (a retry after a hand merge into a collector) may release
		// it: walk again before stopping.
		const resolvedNow = result === "stuck" && Object.keys(s.exceptions).length < pending;
		// Chains whose nodes left the tree (moved out, or edited out of it by anyone) are retired.
		for (const [slug, c] of Object.entries(s.chains)) if (!visited.has(slug) && s.exceptions[slug]?.reason !== DELIVERED_ACTIVE) { note(slug + " left the tree; retiring its workers"); await retireChain(c); releaseRefinementClaims(refinement, slug); delete s.chains[slug]; save(); }
		for (const [slug, ex] of Object.entries(s.exceptions)) if (!visited.has(slug) && ex.reason !== CLEANUP_FAILED && ex.reason !== EVIDENCE_MISSING && ex.reason !== FOREIGN_COMMIT && ex.reason !== POST_LANDING && ex.reason !== DELIVERED_ACTIVE) { if (ex.handler) await retireHandle(ex.handler, cwd); delete s.exceptions[slug]; dropResolution(slug); save(); }
		// Human work remains part of this scope. Keep polling so reassignment resumes here, without pickup.
		if (Object.keys(s.moved).some(slug => { const row = top.get(slug); return row && !finished(row) && (slug === s.root || under(row, top)); })) return false;
		if (result !== "active" && !resolvedNow && !Object.keys(s.exceptions).length && !Object.values(s.chains).length) {
			closeAtTarget(completion);
			if (Object.entries(s.results).some(([slug, result]) => s.landed[slug]?.into === s.cwd && !result.closedAt)) return false;
			if (Object.values(s.landingOps).some(op => s.landed[op.slug] && !op.cleanupDone)) return false;
			const all = view(destination());
			for (const attempt of Object.values(s.refinements)) {
				if (attempt.phase !== "accepted" && attempt.phase !== "removed") await discardRefinement(refinement, attempt.handle);
			}
			const open = [...all.values()].filter(i => !finished(i) && (i.slug === s.root || under(i, all)));
			s.finished = result === "done" ? "done" : "stuck";
			s.finishedAt = Date.now();
			save();
			tellOwner((result === "done" ? "done: " + s.root + " landed in the owner's checkout at " + git(cwd, "rev-parse", "--short", "HEAD") : "stopped with open work: " + (holds.size ? [...holds].map(([k, v]) => "\n- " + k + ": " + v).join("") : open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", ")))
				+ (Object.keys(s.moved).length ? "\nMoved out: " + Object.entries(s.moved).map(([k, v]) => k + ": " + v).join("; ") : ""));
			return true;
		}
		return false;
	}
	function under(i: { partOf: string | null }, all: ReadonlyMap<string, { partOf: string | null }>): boolean { for (let p = i.partOf; p; p = all.get(p)?.partOf ?? null) if (p === s.root) return true; return false; }
}
