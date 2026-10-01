// Reconciler for one dispatched issue subtree (docs/issues/reconcile-the-execution-tree-with-lazy-exception-handlers.md).
//
// Each tick recomputes what every node needs from observed state (the tracker in each node's branch, the
// workers' board reports, workmux panes) and takes the next step. Specs get to tickets through the refine
// role (compile or manager), which promotes them or commits children; an implementer who finds its ticket
// bigger than one session sends it back there (respec). Tickets run implement → drive → review → integrate, a leaf into its parent's branch, a node with children once they
// have all landed in its own branch ("collector"), which its own chain then carries up. Mechanical failures
// are retried here within budgets; anything else is an exception for a handler worker spawned for the nearest
// ancestor with children, which resolves it, or escalates up to the owner session (the root supervisor).
//
// Steps are idempotent: worker handles are deterministic, a launched handle whose worktree exists is reused,
// and a node already done in its parent's branch is never integrated again. State on disk is a cache of what
// was launched and decided; deleting it loses budgets and history, not correctness.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { dispatch, integrate, retire, topic, MergeConflict, type Handle } from "../dispatch.ts";
import { agent as stance, byRole } from "../agents.ts";
import { parse } from "../report.ts";
import { send as sendChild } from "../children.ts";
import { mail } from "../board/mailbox.ts";
import { readFrom, type Message } from "../board/store.ts";
import { decide } from "../decide.ts";
import { workmuxStatus } from "../wm.ts";
import { close, declaredGate, evidenceShapeError, evidencePacket, git, storyShapeError, testCommands, testRun } from "./checks.ts";

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const TICK_MS = 5_000;
const START_GRACE_MS = 120_000;
/** Mechanical retries per chain before a failure becomes an exception. */
const BUDGET = { repair: 2, relaunch: 2, checkpoint: 3, integrate: 3 } as const;

export interface Issue { slug: string; file: string; partOf: string | null; assignee?: string | null; frontier: boolean; done: boolean; archived?: boolean; effectiveStage: string; stage?: string }
type Phase = "refine" | "implement" | "drive" | "review" | "integrate";
interface Chain {
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
	retries: Record<string, number>;
	workers: Handle[];
	note?: string;
}
interface Exception {
	id: string; node: string; reason: string; text: string; at: string;
	/** The ancestor whose handler has it, or "owner". */
	level: string;
	handler?: Handle; handlerLaunchedAt?: number; handlerHandledTs?: string;
	mailed?: boolean;
}
export interface State {
	root: string; cwd: string; owner: string; ownerSession?: string; budget: number; pid?: number;
	collectors: Record<string, { path: string; branch: string }>;
	chains: Record<string, Chain>;
	exceptions: Record<string, Exception>;
	/** Test files each branch's integrations must keep passing. */
	tests: Record<string, string[]>;
	resolved: Record<string, string[]>;
	moved: Record<string, string>;
	counter: number;
	log: string[];
	finished?: string;
}

const repoRoot = (cwd: string) => resolve(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "..");
export const stateDir = (cwd: string) => join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "reconcile");
export const stateFile = (cwd: string, root: string) => join(stateDir(cwd), root + ".json");
export const resolutionsDir = (cwd: string, root: string) => join(stateDir(cwd), root + ".resolutions");
export function load(cwd: string, root: string): State | undefined {
	const f = stateFile(cwd, root);
	return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : undefined;
}

const finished = (i: Issue) => i.done || !!i.archived;
const yaml = (v: unknown) => "```json\n" + JSON.stringify(v ?? null, null, 1) + "\n```";

export async function run(o: { cwd: string; root: string; owner: string; ownerSession?: string; budget: number; signal?: AbortSignal }) {
	const cwd = repoRoot(o.cwd);
	mkdirSync(stateDir(cwd), { recursive: true });
	mkdirSync(resolutionsDir(cwd, o.root), { recursive: true });
	// One reconciler per subtree: a second would launch and judge the same workers against the first.
	const lock = join(stateDir(cwd), o.root + ".lock");
	try { mkdirSync(lock); }
	catch {
		let pid = 0; try { pid = Number(readFileSync(join(lock, "pid"), "utf8")); } catch {}
		let alive = false; try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
		if (alive && pid !== process.pid) throw new Error("reconciler for " + o.root + " already running as pid " + pid);
	}
	writeFileSync(join(lock, "pid"), String(process.pid));
	process.on("exit", () => { try { if (readFileSync(join(lock, "pid"), "utf8") === String(process.pid)) rmSync(lock, { recursive: true, force: true }); } catch {} });
	for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => process.exit(0));
	const s: State = load(cwd, o.root) ?? { root: o.root, cwd, owner: o.owner, budget: o.budget, collectors: {}, chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] };
	Object.assign(s, { owner: o.owner, ownerSession: o.ownerSession ?? s.ownerSession, budget: o.budget, pid: process.pid, finished: undefined });
	const save = () => { const f = stateFile(cwd, o.root); writeFileSync(f + ".tmp", JSON.stringify(s, null, 1)); renameSync(f + ".tmp", f); };
	const note = (line: string) => { s.log.push(new Date().toISOString().slice(0, 19) + " " + line); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); console.log(line); };
	const tellOwner = (body: string) => { try { mail(s.owner, "[reconcile " + s.root + "] " + body, { name: "reconcile/" + s.root }); } catch (e) { note("mail owner failed: " + e); } };
	save();

	// --- observation -----------------------------------------------------------------------------------
	const pathOf = (into: string) => into === cwd ? cwd : s.collectors[into]?.path ?? into;
	const snapCache = new Map<string, { head: string; issues: Map<string, Issue> }>();
	const snapshot = (path: string): Map<string, Issue> => {
		const head = git(path, "rev-parse", "HEAD");
		const hit = snapCache.get(path);
		if (hit && hit.head === head && path !== cwd) return hit.issues;
		const out = execFileSync("bun", [TRACKER, "snapshot", "--json"], { cwd: path, encoding: "utf8", maxBuffer: 64 << 20, env: { ...process.env, TRACKER_NO_INFLIGHT: "1" } });
		const issues = new Map((JSON.parse(out).issues as Issue[]).map(i => [i.slug, i]));
		snapCache.set(path, { head, issues });
		return issues;
	};
	// Latest terminal report per topic, read incrementally from the board log.
	const reports = new Map<string, Message>();
	let offset = 0;
	const TERMINAL = ["done", "blocked", "needs-input", "checkpoint", "turn-end"];
	const pollBoard = () => {
		const { messages, offset: next } = readFrom(offset);
		offset = next;
		for (const m of messages) if (m.topic.startsWith(s.root + "/") && TERMINAL.some(t => m.tags.includes(t))) reports.set(m.topic, m);
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
	let panes = new Map<string, string>(), status: { worktree: string; pane_id: string }[] = [];
	const observeHost = async () => {
		try { status = await workmuxStatus(cwd); } catch (e) { note("workmux status: " + e); }
		try {
			const out = execFileSync("tmux", ["list-panes", "-a", "-F", "#{pane_id} #{pane_current_command}"], { encoding: "utf8" });
			panes = new Map(out.split("\n").filter(Boolean).map(l => l.split(" ") as [string, string]));
		} catch { panes = new Map(); }
	};
	const alive = (h: Handle) => {
		if (!existsSync(h.path)) return false;
		const e = status.find(x => x.worktree === h.handle);
		const cmd = e && panes.get(e.pane_id);
		return !!cmd && !/^-?(zsh|bash|sh|fish)$/.test(cmd);
	};

	// --- launching -------------------------------------------------------------------------------------
	// Launches in flight count too: visit() fans siblings out with Promise.all, and each checks the budget
	// before any handle is assigned. launch() takes its slot synchronously, before its first await.
	let launching = 0;
	const live = () => launching + Object.values(s.chains).filter(c => c.handle && !c.held).length + Object.values(s.exceptions).filter(e => e.handler).length;
	const rel = (file: string) => relative(cwd, file).replace(/^.*?docs\/issues\//, "docs/issues/");
	const pinned = (assignee: string | null | undefined) => /\bagent:([a-z0-9-]+)/.exec(assignee ?? "")?.[1];
	async function pick(role: string, issue: Issue | undefined, text: string, only?: string[]): Promise<string> {
		const pin = role === "implement" ? pinned(issue?.assignee) : undefined;
		if (pin) return pin;
		let names = byRole(role).map(a => a.name);
		if (only) names = names.filter(n => only.includes(n));
		if (!names.length) throw new Error("no agent fills role " + role);
		if (names.length === 1) return names[0];
		try {
			const d = await decide({ role, issue: text.slice(0, 8000) }, { agent: { type: "choice", instructions: "Which stance should take this " + role + " assignment?",
				criteria: Object.fromEntries(names.map(n => [n, stance(n)?.description ?? n])) } });
			return d.agent.choice;
		} catch (e) { note("stance decision unavailable, using " + names[0] + ": " + e); return names[0]; }
	}
	async function launch(handle: string, role: string, prompt: string, base: string, issue?: Issue, only?: string[]): Promise<Handle> {
		launching++;
		try { return await launchNow(handle, role, prompt, base, issue, only); } finally { launching--; }
	}
	async function launchNow(handle: string, role: string, prompt: string, base: string, issue?: Issue, only?: string[]): Promise<Handle> {
		const agentName = await pick(role, issue, prompt, only);
		const r = await dispatch([{ handle, prompt, agent: agentName, role, base, ...((role === "implement" || role === "refine") && issue ? { issue: issue.slug, assignee: issue.assignee ?? undefined } : {}) }],
			{ run: s.root, cwd, maxConcurrent: 1, active: [], session: s.root, follow: s.root, parent: s.ownerSession || undefined });
		if (!r.submitted[0]) throw new Error("launch " + handle + ": " + (r.failed?.error ?? "not submitted"));
		note("launched " + handle + " (" + role + ", " + agentName + ")");
		return r.submitted[0];
	}
	const nextHandle = (slug: string, kind: string) => (slug + "-" + kind + "-" + (++s.counter).toString(36)).slice(0, 90);
	const ticketText = (i: Issue, from?: string) => {
		const f = from && existsSync(join(from, rel(i.file))) ? join(from, rel(i.file)) : i.file;
		return "Issue " + i.slug + " (" + rel(i.file) + "):\n\n" + readFileSync(f, "utf8");
	};
	const siblings = (slug: string, issues: Map<string, Issue>) => {
		const parent = issues.get(slug)?.partOf;
		const sib = [...issues.values()].filter(i => i.partOf === parent && i.slug !== slug && !finished(i));
		return sib.length ? "Sibling issues in flight beside yours (their decisions reach you on the board, tagged `decision`; post yours on your topic tagged `decision` plus `path:<file>` per file it touches):\n" + sib.map(i => "- " + i.slug + " (" + rel(i.file) + ")").join("\n") : "";
	};
	async function startPhase(slug: string, c: Chain, phase: Phase, issue: Issue, issues: Map<string, Issue>, extra = "") {
		const base = c.handle && existsSync(c.handle.path) ? git(c.handle.path, "rev-parse", "HEAD") : git(pathOf(c.into), "rev-parse", "HEAD");
		const from = c.handle && existsSync(c.handle.path) ? c.handle.path : undefined;
		let prompt: string;
		if (phase === "refine" || phase === "implement") prompt = [ticketText(issue, from),
			c.self ? "Its children are all done and integrated in your base. What remains is its own stage: residual work and the joins between its children. Don't redo the children." : "",
			siblings(slug, issues), c.note ? "Note from the supervisor: " + c.note : "", extra].filter(Boolean).join("\n\n");
		else if (phase === "drive") prompt = [ticketText(issue, from), "Setup handoff from the implementer:\n" + yaml(c.setup), c.self ? "Drive this node's own stories: journeys that cross its children. The children's own stories were driven already; if the node has none beyond theirs, report `stories: []`." : "", extra].filter(Boolean).join("\n\n");
		else prompt = [ticketText(issue, from), "The change: git diff " + c.base + "..HEAD in your worktree.", "Driver's handoff:\n" + yaml(c.drive), extra].filter(Boolean).join("\n\n");
		if ((phase === "refine" || phase === "implement") && !c.base) c.base = git(pathOf(c.into), "rev-parse", "HEAD");
		// A join's review is tidy's: crossing stories at their seams, then structure across the children.
		const only = phase === "review" && c.self ? ["tidy", ...((c.drive as any)?.evidence?.visual ? ["visual-reviewer"] : [])] : undefined;
		const handle = await launch(nextHandle(slug, phase), phase, prompt, base, issue, only);
		if (c.handle) c.workers.push(c.handle);
		Object.assign(c, { phase, handle, launchedAt: Date.now(), handledTs: undefined });
		c.retries = { integrate: c.retries.integrate ?? 0 };
		save();
	}

	// --- exceptions ------------------------------------------------------------------------------------
	function raise(slug: string, reason: string, text: string, issues: Map<string, Issue>) {
		const c = s.chains[slug];
		if (c) c.held = true;
		if (s.exceptions[slug]) return;
		const parent = issues.get(slug)?.partOf;
		const level = slug === s.root || !parent ? "owner" : parent;
		s.exceptions[slug] = { id: slug + "-" + Date.now().toString(36), node: slug, reason, text: text.slice(-6000), at: new Date().toISOString(), level };
		note("exception " + slug + ": " + reason + " → " + level + (reason === "reconciler error" ? "\n" + text.slice(0, 2000) : ""));
		save();
	}
	type Resolution = { action: "answer" | "retry" | "redispatch" | "move-out" | "escalate"; target?: string; message?: string; note?: string; summary?: string };
	async function applyResolution(ex: Exception, r: Resolution, issues: Map<string, Issue>) {
		const target = r.target && s.chains[r.target] ? r.target : ex.node;
		const c = s.chains[target];
		(s.resolved[ex.node] ??= []).push(ex.reason + " → " + r.action + (r.message ? ": " + r.message : r.note ? ": " + r.note : r.summary ? ": " + r.summary : ""));
		if (r.action === "escalate") {
			const up = ex.level === "owner" ? undefined : issues.get(ex.level)?.partOf;
			ex.level = ex.level === "owner" || ex.level === s.root || !up ? "owner" : up;
			ex.text += "\n\nEscalated by the handler: " + (r.summary ?? r.message ?? "(no summary)");
			Object.assign(ex, { handler: undefined, handlerLaunchedAt: undefined, handlerHandledTs: undefined, mailed: false });
			note("escalated " + ex.node + " → " + ex.level);
			return save();
		}
		delete s.exceptions[ex.node];
		if (ex.node !== target && s.chains[ex.node]) s.chains[ex.node].held = false;
		if (r.action === "answer" && c?.handle && alive(c.handle)) { await sendChild(topic(c.handle), r.message ?? r.note ?? ""); c.held = false; c.handledTs = new Date().toISOString(); }
		else if (r.action === "answer" || r.action === "retry") { if (c) { c.held = false; c.note = r.message ?? r.note; await startPhase(target, c, c.phase === "integrate" ? "review" : c.phase, issues.get(target)!, issues); } }
		else if (r.action === "redispatch") { if (c) { await retireChain(c); delete s.chains[target]; } s.resolved[target] ??= []; pendingNotes.set(target, r.note ?? r.message); }
		else if (r.action === "move-out") { if (c) { await retireChain(c); delete s.chains[target]; } s.moved[target] = r.summary ?? r.note ?? ex.reason; tellOwner("moved out " + target + ": " + s.moved[target]); }
		note("resolved " + ex.node + ": " + r.action + (target !== ex.node ? " on " + target : ""));
		save();
	}
	const pendingNotes = new Map<string, string | undefined>();
	async function handleExceptions(issues: Map<string, Issue>) {
		for (const ex of Object.values(s.exceptions)) {
			if (ex.level === "owner") {
				if (!ex.mailed) {
					tellOwner("needs you: " + ex.node + " — " + ex.reason + "\n\n" + ex.text.slice(-3000) + "\n\nResolve with tools.reconcile_resolve({root: \"" + s.root + "\", node: \"" + ex.node + "\", action: answer|retry|redispatch|move-out, message?, note?, summary?}). A move-out you make in the tracker yourself; then resolve with move-out.");
					ex.mailed = true; save();
				}
				const f = join(resolutionsDir(cwd, s.root), ex.node + ".json");
				if (existsSync(f)) { const r = JSON.parse(readFileSync(f, "utf8")) as Resolution; rmSync(f); await applyResolution(ex, r, issues); }
				continue;
			}
			const col = s.collectors[ex.level];
			if (!col) { ex.level = "owner"; save(); continue; }
			if (!ex.handler) {
				if (live() >= s.budget) continue;
				const parent = issues.get(ex.level), node = issues.get(ex.node);
				const prompt = [
					"Exception in the execution tree under " + ex.level + ", for " + ex.node + ": " + ex.reason,
					"Report and context:\n\n" + ex.text,
					parent ? "The node whose contract you hold:\n\n" + ticketText(parent) : "",
					node && node !== parent ? ticketText(node) : "",
					"State of its children:\n" + [...issues.values()].filter(i => i.partOf === ex.level).map(i => "- " + i.slug + ": " + (finished(i) ? "done" : s.exceptions[i.slug] ? "exception: " + s.exceptions[i.slug].reason : s.chains[i.slug] ? s.chains[i.slug].phase : "waiting")).join("\n"),
					s.resolved[ex.node]?.length ? "Earlier resolutions for " + ex.node + ":\n" + s.resolved[ex.node].map(l => "- " + l).join("\n") : "",
				].filter(Boolean).join("\n\n");
				try {
					ex.handler = await launch(nextHandle(ex.level, "handler"), "handle", prompt, git(col.path, "rev-parse", "HEAD"));
					ex.handlerLaunchedAt = Date.now(); save();
				} catch (e) { note("handler launch failed: " + e); ex.level = "owner"; save(); }
				continue;
			}
			const m = fresh(ex.handler, ex.handlerHandledTs, ex.handlerLaunchedAt);
			if (!m) {
				if (Date.now() - (ex.handlerLaunchedAt ?? 0) > START_GRACE_MS && !alive(ex.handler)) await applyResolution(ex, { action: "escalate", summary: "the handler died without resolving" }, issues);
				continue;
			}
			ex.handlerHandledTs = m.ts;
			const r = parse(m.body);
			const res = r.handoff?.resolution as Resolution | undefined;
			const handler = ex.handler;
			// Tracker edits the handler committed (answers recorded, moves out) land in the level's branch.
			try {
				if (git(handler.path, "rev-list", "--count", git(col.path, "rev-parse", "HEAD") + "..HEAD") !== "0") {
					const outside = git(handler.path, "diff", "--name-only", git(col.path, "rev-parse", "HEAD") + "...HEAD").split("\n").filter(f => f && !f.startsWith("docs/"));
					if (outside.length) throw new Error("handler changed files outside docs/: " + outside.join(", "));
					await locked(() => integrate(handler, { cwd: col.path, keep: true }));
				}
			} catch (e) { await applyResolution(ex, { action: "escalate", summary: "handler's tracker change could not land: " + e }, issues); await retireHandle(handler, col.path); continue; }
			await retireHandle(handler, col.path);
			ex.handler = undefined;
			await applyResolution(ex, r.status === "done" && res?.action ? res : { action: "escalate", summary: res?.summary ?? r.body.slice(-1500) }, issues);
		}
	}

	// --- integration -----------------------------------------------------------------------------------
	const lockDir = join(stateDir(cwd), "integrate.lock");
	async function locked<T>(fn: () => Promise<T>): Promise<T> {
		for (;;) {
			try { mkdirSync(lockDir); writeFileSync(join(lockDir, "pid"), String(process.pid)); break; }
			catch {
				const pid = Number(readFileSync(join(lockDir, "pid"), "utf8").trim() || 0);
				let dead = !pid; try { if (pid) process.kill(pid, 0); } catch { dead = true; }
				if (dead) rmSync(lockDir, { recursive: true, force: true }); else await Bun.sleep(1000);
			}
		}
		try { return await fn(); } finally { rmSync(lockDir, { recursive: true, force: true }); }
	}
	async function retireHandle(h: Handle, into: string) {
		try { await retire(h, { cwd }); } catch (e) { note("retire " + h.handle + ": " + e); }
		try { if (!git(into, "cherry", "HEAD", h.handle).split("\n").some(l => l.startsWith("+"))) git(cwd, "branch", "-D", h.handle); } catch {}
	}
	async function retireChain(c: Chain) { for (const h of [...c.workers, ...(c.handle ? [c.handle] : [])]) await retireHandle(h, pathOf(c.into)); }
	async function land(slug: string, c: Chain, issue: Issue): Promise<string | undefined> {
		const into = pathOf(c.into), h = c.handle!;
		const before = git(into, "rev-parse", "HEAD");
		try {
			await locked(() => integrate(h, { cwd: into, keep: true, prepare: async worker => {
				const run = (cmd: string[]) => execFileSync(cmd[0], cmd.slice(1), { cwd: worker.path, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20, timeout: 30 * 60_000 });
				const gate = declaredGate(worker.path);
				if (gate) run(["bash", "-lc", gate]);
				for (const file of new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])) { const cmd = testRun(worker.path, file); if (cmd) run(cmd); }
				const packet = c.self || !c.evidence ? undefined : evidencePacket(worker.path, c.evidence);
				const file = join(worker.path, relative(pathOf(c.into), issue.file));
				close(worker.path, existsSync(file) ? file : issue.file.replace(cwd, worker.path), slug, packet?.path);
			} }));
		} catch (e: any) {
			return e instanceof MergeConflict ? "merge conflict in " + (e as any).files?.join(", ") : String(e?.message ?? e) + "\n" + String(e?.stdout ?? "").slice(-3000) + String(e?.stderr ?? "").slice(-3000);
		}
		s.tests[c.into] = [...new Set([...(s.tests[c.into] ?? []), ...testCommands(c.evidence)])];
		const landed = git(into, "diff", "--name-only", before, "HEAD").split("\n").filter(Boolean);
		note("landed " + slug + " in " + (c.into === cwd ? "the owner's checkout" : c.into));
		delete s.chains[slug];
		save();
		await retireChain({ ...c, handle: h });
		const col = s.collectors[slug];
		if (col) { try { git(cwd, "worktree", "remove", "--force", col.path); git(cwd, "branch", "-D", col.branch); } catch (e) { note("collector cleanup " + slug + ": " + e); } delete s.collectors[slug]; save(); }
		// Early overlap notices: siblings still implementing over the files that just landed rebase now.
		for (const [other, oc] of Object.entries(s.chains)) {
			if (oc.into !== c.into || oc.phase !== "implement" || !oc.handle || !existsSync(oc.handle.path) || !oc.base) continue;
			try {
				const touched = new Set([...git(oc.handle.path, "diff", "--name-only", oc.base).split("\n").filter(Boolean)]);
				const overlap = landed.filter(f => touched.has(f));
				if (overlap.length) await sendChild(topic(oc.handle), "Sibling " + slug + " just landed touching files you changed: " + overlap.join(", ") + ". Commit, then rebase onto " + git(into, "rev-parse", "--short", "HEAD") + " (git rebase " + git(into, "rev-parse", "HEAD") + ") now and continue.");
			} catch (e) { note("overlap check " + other + ": " + e); }
		}
		return undefined;
	}

	// --- per-report steps ------------------------------------------------------------------------------
	async function repair(slug: string, c: Chain, key: string, message: string, issues: Map<string, Issue>, text: string) {
		c.retries[key] = (c.retries[key] ?? 0) + 1;
		if (c.retries[key] > BUDGET.repair) return raise(slug, key + " (after " + BUDGET.repair + " repairs)", text, issues);
		await sendChild(topic(c.handle!), message);
		save();
	}
	async function onReport(slug: string, c: Chain, m: Message, issues: Map<string, Issue>) {
		const issue = issues.get(slug)!;
		c.handledTs = m.ts; save();
		const r = parse(m.body), text = m.body, h = c.handle!;
		if (c.phase === "integrate") { c.phase = "review"; }
		if (r.handoffError) return repair(slug, c, "handoff", "Your handoff block did not parse (" + r.handoffError + "). Repost your report with valid fenced yaml.", issues, text);
		if (r.status === null) return repair(slug, c, "status", "Your turn ended without a status. Continue the assignment; end with `done`, `blocked`, `needs-input` or `checkpoint` as the first line, then the handoff.", issues, text);
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
		if (r.status === "blocked" || r.status === "needs-input") return raise(slug, c.phase + " " + r.status, text, issues);
		if (r.status === "checkpoint") {
			c.retries.checkpoint = (c.retries.checkpoint ?? 0) + 1;
			if (c.retries.checkpoint > BUDGET.checkpoint) return raise(slug, "checkpointed " + BUDGET.checkpoint + " times", text, issues);
			const kept = c.retries.checkpoint;
			await startPhase(slug, c, c.phase, issue, issues, "Continue from the previous worker's checkpoint:\n\n" + text.slice(-6000));
			c.retries.checkpoint = kept; return save();
		}
		if (git(h.path, "status", "--porcelain")) return repair(slug, c, "dirty", "You reported done with uncommitted changes. Commit everything that belongs to the change, then report done again.", issues, text);
		if (c.phase === "refine") {
			const after = snapshot(h.path);
			const kids = [...after.values()].filter(i => i.partOf === slug && !finished(i));
			if (!kids.length) {
				if (after.get(slug)?.effectiveStage !== "ticket") return repair(slug, c, "refine", "You reported done, but " + slug + " is neither promoted (stage: ticket) nor partitioned into children. Do one, commit, and report done again.", issues, text);
				note("promoted " + slug);
				return startPhase(slug, c, "implement", issue, issues);
			}
			{
				const col = ensureCollector(slug, c.into);
				try { await locked(() => integrate(h, { cwd: col.path, keep: true })); }
				catch (e) { return raise(slug, "decomposition did not land: " + e, text, issues); }
				note("decomposed " + slug + " into " + kids.map(k => k.slug).join(", "));
				delete s.chains[slug]; save();
				await retireChain({ ...c });
				return;
			}
		}
		if (c.phase === "implement") {
			if (!c.self && [...snapshot(h.path).values()].some(i => i.partOf === slug && !finished(i)))
				return repair(slug, c, "decompose", "Implementers don't decompose: drop the children you committed, and either implement the ticket whole or end `blocked` with `respec` in the handoff.", issues, text);
			c.setup = r.handoff?.setup ?? null;
			return startPhase(slug, c, "drive", issue, issues);
		}
		if (c.phase === "drive") {
			const shape = storyShapeError(r.handoff, c.self) ?? (r.handoff?.evidence !== undefined ? evidenceShapeError(r.handoff) : null);
			if (shape) return repair(slug, c, "drive-shape", "Your handoff is malformed: " + shape + ". Repost it.", issues, text);
			c.drive = r.handoff!;
			return startPhase(slug, c, "review", issue, issues, "Driver's final message:\n\n" + text.slice(-4000));
		}
		// review
		const shape = storyShapeError(r.handoff, c.self) ?? (c.self && r.handoff?.evidence === undefined ? null : evidenceShapeError(r.handoff));
		if (shape) return repair(slug, c, "review-shape", "Your handoff is malformed: " + shape + ". Repost it.", issues, text);
		const stories = (r.handoff!.stories as { outcome: string }[]);
		const notHeld = stories.findIndex(x => x.outcome !== "held");
		if (notHeld >= 0) return repair(slug, c, "unheld", "You reported done, but stories[" + notHeld + "] is not held. `done` needs every story held on your final head: repair it, or report `blocked`/`needs-input`.", issues, text);
		c.evidence = { ...r.handoff!, tests: [...new Set([...testCommands(c.drive), ...testCommands(r.handoff)])] };
		c.phase = "integrate"; save();
		const failure = await land(slug, c, issue);
		if (failure) {
			c.retries.integrate = (c.retries.integrate ?? 0) + 1;
			if (c.retries.integrate > BUDGET.integrate) return raise(slug, "integration failed " + BUDGET.integrate + " times", failure, issues);
			await sendChild(topic(h), "Integration into " + (c.into === cwd ? "the owner's checkout" : "the parent branch") + " failed:\n\n" + failure.slice(-5000) + "\n\nRebase onto " + git(pathOf(c.into), "rev-parse", "HEAD") + " (git rebase <that sha>), resolve, make the gate and tests pass, commit, and report done again with your full handoff.");
			note("integration of " + slug + " failed (" + c.retries.integrate + "), sent back: " + failure.split("\n")[0]);
			save();
		}
	}
	function ensureCollector(slug: string, into: string) {
		if (s.collectors[slug]) return s.collectors[slug];
		const path = resolve(cwd, "..", basename(cwd) + "__worktrees", slug + "--tree"), branch = "tree/" + slug;
		if (!existsSync(path)) git(cwd, "worktree", "add", "-q", "-b", branch, path, git(pathOf(into), "rev-parse", "HEAD"));
		s.collectors[slug] = { path, branch };
		save();
		return s.collectors[slug];
	}

	// --- the walk --------------------------------------------------------------------------------------
	/** Visit a node; returns whether anything under it is unsettled and progressing or launchable. */
	async function visit(slug: string, into: string, issues: Map<string, Issue>): Promise<"done" | "active" | "stuck"> {
		visited.add(slug);
		const issue = issues.get(slug);
		if (!issue || finished(issue) || s.moved[slug]) return "done";
		const own = s.collectors[slug] ? snapshot(s.collectors[slug].path) : issues;
		const kids = [...own.values()].filter(i => i.partOf === slug && !finished(i) && !s.moved[i.slug]);
		if (kids.length && !s.chains[slug]) {
			const col = ensureCollector(slug, into);
			const below = await Promise.all(kids.map(k => k.frontier || s.chains[k.slug] || s.collectors[k.slug] ? visit(k.slug, slug, snapshot(col.path)) : Promise.resolve("stuck" as const)));
			return below.includes("active") ? "active" : "stuck";
		}
		if (s.exceptions[slug]) return "active";
		const c = s.chains[slug];
		if (!c) {
			if (!issue.frontier && slug !== s.root) return "stuck";
			if (live() >= s.budget) return "active";
			const chain: Chain = { into, self: !!s.collectors[slug], phase: "implement", retries: {}, workers: [], note: pendingNotes.get(slug) };
			pendingNotes.delete(slug);
			if (chain.self) chain.base = git(s.collectors[slug].path, "rev-parse", "HEAD");
			s.chains[slug] = chain;
			try {
				if (chain.self) { chain.handle = undefined; await startPhaseFrom(slug, chain, issue, issues, s.collectors[slug].path); }
				else await startPhase(slug, chain, issue.effectiveStage === "spec" ? "refine" : "implement", issue, issues);
			} catch (e) { raise(slug, "launch failed", String(e), issues); }
			return "active";
		}
		if (c.held) return "active";
		const m = fresh(c.handle, c.handledTs, c.launchedAt);
		if (m) { try { await onReport(slug, c, m, issues); } catch (e) { raise(slug, "reconciler error", String((e as Error)?.stack ?? e), issues); } return "active"; }
		if (c.handle && Date.now() - (c.launchedAt ?? 0) > START_GRACE_MS && !alive(c.handle)) {
			c.retries.relaunch = (c.retries.relaunch ?? 0) + 1;
			if (c.retries.relaunch > BUDGET.relaunch) raise(slug, c.phase + " worker died " + BUDGET.relaunch + " times", "worktree " + c.handle.path, issues);
			else { note(c.phase + " worker for " + slug + " is gone; relaunching"); const kept = c.retries.relaunch; await startPhase(slug, c, c.phase === "integrate" ? "review" : c.phase, issue, issues, "A previous worker on this phase died; its worktree may hold partial commits in your base."); c.retries.relaunch = kept; save(); }
		}
		return "active";
	}
	// A node's own chain after its children: the implementer starts from the collector, so its branch carries them up.
	async function startPhaseFrom(slug: string, c: Chain, issue: Issue, issues: Map<string, Issue>, from: string) {
		const saved = c.into;
		c.base = git(from, "rev-parse", "HEAD");
		const prompt = [ticketText(issue), "Its children are all done and integrated in your base. What remains is its own stage: residual work and the joins between its children. Don't redo the children.", c.note ? "Note from the supervisor: " + c.note : ""].filter(Boolean).join("\n\n");
		c.handle = await launch(nextHandle(slug, "implement"), "implement", prompt, c.base, issue);
		Object.assign(c, { into: saved, phase: "implement", launchedAt: Date.now(), handledTs: undefined });
		save();
	}
	const visited = new Set<string>();

	// --- main loop -------------------------------------------------------------------------------------
	tellOwner("started (budget " + s.budget + ")");
	for (;;) {
		if (o.signal?.aborted) return;
		pollBoard();
		await observeHost();
		const top = snapshot(cwd);
		if (!top.get(s.root)) { s.finished = "root issue not found"; save(); tellOwner("stopped: no issue " + s.root); return; }
		visited.clear();
		const result = await visit(s.root, cwd, top);
		await handleExceptions(top);
		// Chains whose nodes left the tree (moved out, or edited out of it by anyone) are retired.
		for (const [slug, c] of Object.entries(s.chains)) if (!visited.has(slug)) { note(slug + " left the tree; retiring its workers"); await retireChain(c); delete s.chains[slug]; save(); }
		for (const [slug, ex] of Object.entries(s.exceptions)) if (!visited.has(slug)) { if (ex.handler) await retireHandle(ex.handler, cwd); delete s.exceptions[slug]; save(); }
		if (result !== "active" && !Object.keys(s.exceptions).length && !Object.values(s.chains).length) {
			const all = snapshot(cwd);
			const open = [...all.values()].filter(i => !finished(i) && (i.slug === s.root || under(i, all)));
			s.finished = result === "done" ? "done" : "stuck";
			save();
			// Workers ran as windows of a tmux session named for the root; with them all retired it is an empty shell.
			try { execFileSync("tmux", ["kill-session", "-t", "=" + s.root], { stdio: "ignore" }); } catch {}
			tellOwner((result === "done" ? "done: " + s.root + " landed in the owner's checkout at " + git(cwd, "rev-parse", "--short", "HEAD") : "stopped with open work: " + open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", "))
				+ (Object.keys(s.moved).length ? "\nMoved out: " + Object.entries(s.moved).map(([k, v]) => k + ": " + v).join("; ") : ""));
			return;
		}
		await Bun.sleep(TICK_MS);
	}
	function under(i: Issue, all: Map<string, Issue>): boolean { for (let p = i.partOf; p; p = all.get(p)?.partOf ?? null) if (p === s.root) return true; return false; }
}
