// Reconciler processes, one per dispatched subtree, detached from any session; state and log live under
// <git-common-dir>/reconcile/.
//   bun lib/reconcile/main.ts start <issue> --owner mail/xxxxxxxx [--budget N] [--cwd DIR]   detached
//   bun lib/reconcile/main.ts run <issue> --owner mail/xxxxxxxx [--budget N]                 foreground
//   bun lib/reconcile/main.ts status [--cwd DIR]
//   bun lib/reconcile/main.ts resolve <issue> <node> <json> [--cwd DIR]
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { load, resolutionsDir, run, stateDir, type State } from "./reconcile.ts";

const alive = (pid?: number) => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch { return false; } };

export function start(o: { cwd: string; root: string; owner: string; budget: number }): { pid: number; log: string } {
	const prior = load(o.cwd, o.root);
	if (prior && !prior.finished && alive(prior.pid)) return { pid: prior.pid!, log: join(stateDir(o.cwd), o.root + ".log") };
	mkdirSync(stateDir(o.cwd), { recursive: true });
	const log = join(stateDir(o.cwd), o.root + ".log");
	const fd = openSync(log, "a");
	const child = Bun.spawn(["bun", import.meta.path, "run", o.root, "--owner", o.owner, "--budget", String(o.budget), "--cwd", o.cwd],
		{ cwd: o.cwd, stdio: ["ignore", fd, fd], env: { ...process.env, PI_SESSION_ID: "" } });
	child.unref();
	closeSync(fd);
	return { pid: child.pid, log };
}

export function campaigns(cwd: string): (State & { running: boolean })[] {
	const dir = stateDir(cwd);
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter(f => f.endsWith(".json")).map(f => load(cwd, f.slice(0, -5))!).filter(Boolean).map(s => ({ ...s, running: !s.finished && alive(s.pid) }));
}

export function summary(s: State & { running: boolean }) {
	return {
		root: s.root, running: s.running, finished: s.finished ?? null, owner: s.owner, budget: s.budget,
		chains: Object.fromEntries(Object.entries(s.chains).map(([k, c]) => [k, { phase: c.phase, worker: c.handle?.handle, held: !!c.held, into: c.into === s.cwd ? "(owner)" : c.into }])),
		exceptions: Object.fromEntries(Object.entries(s.exceptions).map(([k, e]) => [k, { reason: e.reason, level: e.level, handler: e.handler?.handle ?? null }])),
		moved: s.moved, log: s.log.slice(-15),
	};
}

export function resolveException(cwd: string, root: string, node: string, resolution: object) {
	mkdirSync(resolutionsDir(cwd, root), { recursive: true });
	writeFileSync(join(resolutionsDir(cwd, root), node + ".json"), JSON.stringify(resolution));
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: {
		owner: { type: "string" }, budget: { type: "string", default: "6" }, cwd: { type: "string", default: process.cwd() } } });
	const [cmd, root, ...rest] = positionals;
	const cwd = resolve(values.cwd!);
	if (cmd === "run" && root && values.owner) { process.chdir(cwd); await run({ cwd, root, owner: values.owner, budget: Number(values.budget) }); }
	else if (cmd === "start" && root && values.owner) console.log(JSON.stringify(start({ cwd, root, owner: values.owner, budget: Number(values.budget) })));
	else if (cmd === "status") console.log(JSON.stringify(campaigns(cwd).map(summary), null, 1));
	else if (cmd === "resolve" && root && rest.length === 2) resolveException(cwd, root, rest[0], JSON.parse(rest[1]));
	else { console.error("usage: main.ts start|run <issue> --owner mail/x [--budget N] | status | resolve <issue> <node> <json>"); process.exit(2); }
}
