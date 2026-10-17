// Reconciler processes, one per dispatched subtree, detached from any session; state and log live under
// <git-common-dir>/reconcile/.
//   bun lib/reconcile/main.ts start <issue> --owner mail/xxxxxxxx [--budget N] [--land MODE] [--cwd DIR]   detached
//   bun lib/reconcile/main.ts run <issue> --owner mail/xxxxxxxx [--budget N] [--land MODE]   foreground
//   bun lib/reconcile/main.ts status [--cwd DIR]
//   bun lib/reconcile/main.ts stop <issue> [--cwd DIR]
//   bun lib/reconcile/main.ts resolve <issue> <node> <json> [--cwd DIR]
//   bun lib/reconcile/main.ts constrain <issue> <node> TEXT [--cwd DIR]
import { execFileSync } from "node:child_process";
import { mail } from "../board/mailbox";
import { retire, topic, type Handle } from "../dispatch";
import { allThreads } from "../thread/registry";
import { checkout } from "../thread/git";
import { pidAlive as alive } from "../wm";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discardRefinement, replaceRefinement } from "./refinement";
import { parseArgs } from "node:util";
import { prepareStart, type StartOptions, assertThreadState, load, reconcilerTracker, resolutionsDir, resumeRecords, run, saveState, stateDir, stopRefinementWriter, updateState, type State } from "./reconcile.ts";

export function start(o: StartOptions): { pid: number; log: string } {
	const prior = prepareStart(o);
	o = { ...o, cwd: prior.cwd };
	const controlCwd = prior.pr?.path ?? o.cwd;
	if (prior?.stopping) throw new Error("cleanup in progress for " + o.root + ": retry stop to finish it");
	if (prior && !prior.finished && prior.pid && alive(prior.pid)) return { pid: prior.pid!, log: join(stateDir(controlCwd), o.root + ".log") };
	mkdirSync(stateDir(controlCwd), { recursive: true });
	const log = join(stateDir(controlCwd), o.root + ".log");
	const fd = openSync(log, "a");
	const child = Bun.spawn(["bun", import.meta.path, "run", o.root, "--owner", o.owner, "--budget", String(o.budget), "--cwd", controlCwd, "--land", prior.land ?? "local", ...(o.ownerSession ? ["--owner-session", o.ownerSession] : [])],
		{ cwd: controlCwd, stdio: ["ignore", fd, fd], env: { ...process.env, PI_SESSION_ID: "" } });
	child.unref();
	closeSync(fd);
	// Publish before returning, including on the first start: an immediate stop must know its PID.
	updateState(controlCwd, o.root, prior => ({
		...(prior ?? { backend: "threads", root: o.root, cwd: o.cwd, owner: o.owner, budget: o.budget,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] }),
		pid: child.pid,
	}));
	return { pid: child.pid, log };
}

/** Stop before observing workers, so no new launch can race retirement. Collectors are not workers. */
export async function stop(cwd: string, root: string) {
	const initial = updateState(cwd, root, prior => {
		if (!prior) throw new Error("no reconciler for " + root);
		assertThreadState(prior);
		if (prior.pid === process.pid) throw new Error("stop must run outside the reconciler process");
		return { ...prior, stopping: true };
	});
	// An old run's PID may have been reused by an unrelated process on this shared host.
	let command = "";
	if (initial.pid && alive(initial.pid)) {
		try { command = execFileSync("ps", ["-p", String(initial.pid), "-o", "command="], { encoding: "utf8" }).trim(); }
		catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
	}
	if (initial.pid && command.split(/\s+/).some((word, i, args) => word.endsWith("lib/reconcile/main.ts") && args[i + 1] === "run" && args[i + 2] === root)) {
		process.kill(initial.pid, "SIGTERM");
		for (let i = 0; i < 50 && alive(initial.pid); i++) await Bun.sleep(100);
		if (alive(initial.pid)) process.kill(initial.pid, "SIGKILL");
		for (let i = 0; i < 10 && alive(initial.pid); i++) await Bun.sleep(100);
		if (alive(initial.pid)) throw new Error("reconciler still running as pid " + initial.pid);
	}
	// A launch may have registered its thread just before termination, without saving its receipt.
	const s = load(cwd, root)!;
	cwd = s.pr && existsSync(s.pr.path) ? s.pr.path : s.cwd;
	const refinement = { state: s, tracker: reconcilerTracker(cwd, root), save: () => saveState(s),
		locked: async <T>(work: () => Promise<T>) => work(),
		stopWriter: (attempt: State["refinements"][string]) => stopRefinementWriter(s, attempt) };
	for (const attempt of Object.values(s.refinements)) if (attempt.phase === "adopting" && attempt.successor)
		await replaceRefinement(refinement, attempt.handle, attempt.successor, true);
	for (const attempt of Object.values(s.refinements))
		if (attempt.phase !== "accepted" && attempt.phase !== "removed") await discardRefinement(refinement, attempt.handle);
	const threads = await allThreads(true), project = checkout(cwd).project;
	const handles = new Map<string, Handle>();
	const add = (h: Handle) => handles.set(h.threadId ?? topic(h) + ":" + h.path, h);
	for (const c of Object.values(s.chains)) for (const h of [...c.workers, ...(c.handle ? [c.handle] : [])]) add(h);
	for (const e of Object.values(s.exceptions)) if (e.handler) add(e.handler);
	for (const op of Object.values(s.landingOps)) for (const h of op.workers) add(h);
	for (const a of Object.values(s.refinements)) if (a.worker) add(a.worker);
	if (s.pr?.repair?.worker) add(s.pr.repair.worker);
	for (const t of threads) if (!t.archived && t.project === project && t.worker?.run === root)
		add({ ...t.worker, path: t.cwd, threadId: t.id });
	const retired = [];
	for (const h of handles.values()) {
		const t = threads.find(t => h.threadId ? t.id === h.threadId : t.worker?.run === h.run && t.worker.handle === h.handle && t.cwd === h.path);
		if (t?.archived || (!t && !existsSync(h.path))) continue;
		retired.push({ worker: topic(h), ...await retire(h, { cwd }) });
	}
	rmSync(resolutionsDir(cwd, root), { recursive: true, force: true });
	// Retirement kept each unfinished worker's branch (with a WIP commit of what it left uncommitted): a restart
	// continues each node from there.
	const resume = resumeRecords(s);
	const stopped = updateState(cwd, root, prior => ({
		...prior!, chains: {}, exceptions: {}, resume, pid: undefined, stopping: undefined, finished: "stopped",
		log: [...prior!.log, new Date().toISOString().slice(0, 19) + " stopped; retired workers and handlers, kept collectors"].slice(-400),
	}));
	return { ...summary({ ...stopped, running: false }), retired };
}

export function campaigns(cwd: string): (State & { running: boolean })[] {
	const dir = stateDir(cwd);
	if (!existsSync(dir)) return [];
	// Only <root>.json is a run's state: the GitHub tracker keeps <root>.github.json journals beside it.
	return readdirSync(dir).filter(f => /^[^.]+\.json$/.test(f)).map(f => load(cwd, f.slice(0, -5))!).filter(Boolean).map(s => ({ ...s, running: !s.finished && !!s.pid && alive(s.pid) }));
}

export function summary(s: State & { running: boolean }) {
	return {
		root: s.root, backend: s.backend, running: s.running, finished: s.finished ?? null, stopping: !!s.stopping, owner: s.owner, budget: s.budget,
		chains: Object.fromEntries(Object.entries(s.chains).map(([k, c]) => [k, { phase: c.phase, worker: c.handle?.handle, threadId: c.handle?.threadId, held: !!c.held, into: c.into === s.cwd ? "(owner)" : c.into === s.pr?.path ? "(PR staging)" : c.into }])),
		exceptions: Object.fromEntries(Object.entries(s.exceptions).map(([k, e]) => [k, { reason: e.reason, level: e.level, handler: e.handler?.handle ?? null }])),
		cwd: s.cwd, land: s.land ?? "local", target: s.target ?? (s.pr ? "github:" + s.pr.repository + ":" + s.pr.baseBranch : s.cwd),
		pr: s.pr, landed: s.landed, results: s.results, landingOps: s.landingOps, refinements: s.refinements,
		constraints: s.constraints ?? {},
		moved: s.moved, log: s.log.slice(-15),
	};
}

export function resolveException(cwd: string, root: string, node: string, resolution: object) {
	const s = load(cwd, root);
	if (!s || s.finished || s.stopping || !s.pid || !alive(s.pid)) throw new Error("no running reconciler for " + root + ": start it first (its state resumes)");
	if (!s.exceptions[node] && !s.chains[node]) throw new Error(node + " has no exception or running chain in " + root + "'s reconciler");
	mkdirSync(resolutionsDir(cwd, root), { recursive: true });
	writeFileSync(join(resolutionsDir(cwd, root), node + ".json"), JSON.stringify(resolution));
}

export function constrain(cwd: string, root: string, node: string, text: string) {
	if (!text.trim()) throw new Error("constraint text must not be empty");
	const s = updateState(cwd, root, prior => {
		if (!prior || prior.finished || prior.stopping) throw new Error("no active reconciler for " + root);
		assertThreadState(prior);
		if (!prior.chains[node] && !prior.exceptions[node] && !prior.collectors[node] && !(prior.pr && node === root)) throw new Error(node + " is not an active node in " + root);
		(prior.constraints ??= {})[node] ??= [];
		prior.constraints[node].push(text);
		return prior;
	});
	const worker = s.chains[node]?.handle ?? (node === root ? s.pr?.repair?.worker : undefined);
	if (worker) mail(topic(worker), "Constraint from the supervisor (applies throughout this node's work):\n\n" + text, { name: "reconcile/" + root });
	return { recorded: true, mailed: !!worker };
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: {
		owner: { type: "string" }, "owner-session": { type: "string" }, budget: { type: "string", default: "6" }, land: { type: "string" }, cwd: { type: "string", default: process.cwd() } } });
	const [cmd, root, ...rest] = positionals;
	const cwd = resolve(values.cwd!);
	if (cmd === "run" && root && values.owner) { process.chdir(cwd); await run({ cwd, root, owner: values.owner, ownerSession: values["owner-session"], budget: Number(values.budget), land: values.land as StartOptions["land"] }); }
	else if (cmd === "start" && root && values.owner) console.log(JSON.stringify(start({ cwd, root, owner: values.owner, budget: Number(values.budget), land: values.land as StartOptions["land"] })));
	else if (cmd === "stop" && root) console.log(JSON.stringify(await stop(cwd, root)));
	else if (cmd === "status") console.log(JSON.stringify(campaigns(cwd).map(summary), null, 1));
	else if (cmd === "resolve" && root && rest.length === 2) resolveException(cwd, root, rest[0], JSON.parse(rest[1]));
	else if (cmd === "constrain" && root && rest.length === 2) console.log(JSON.stringify(constrain(cwd, root, rest[0], rest[1])));
	else { console.error("usage: main.ts start|run <issue> --owner mail/x [--budget N] [--land local|pr-merge|pr-review] | stop <issue> | status | resolve <issue> <node> <json> | constrain <issue> <node> TEXT"); process.exit(2); }
}
