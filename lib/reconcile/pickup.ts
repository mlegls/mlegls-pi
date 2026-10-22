// Pickup: a project's general supervisor discovers ready work in the tracker and starts reconcilers on it, with no
// readiness message from the shaping thread (docs/issues/pick-up-ready-work-from-the-tracker.md). One per repository,
// recorded in <git-common-dir>/pickup/state.json (not under reconcile/, whose *.json are runs). Discovery is this
// mechanical process, never a model turn: a watcher on the canonical issues directory plus a periodic recovery scan.
//   bun lib/reconcile/pickup.ts status|scan|watch|stop [--cwd DIR]
// Configure through the supervision extension's `pickup` tool, which records the owning bb thread.
import { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, watch as watchDir, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { getTracker, type Issue } from "../tracker";
import { findIssuesDir } from "../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts";
import { bbThreads } from "../thread/bb";
import { git } from "../thread/git";
import { pidAlive } from "../wm";
import type { LandingMode } from "./pr-types";
import { campaigns, start } from "./main";

export interface Pickup {
	enabled: boolean;
	paused: boolean;
	/** bb thread that owns every run pickup starts: it gets their exceptions and finishes. */
	owner: string;
	ownerSession?: string;
	/** Checkout the runs land into (the owner's, as with a manual `reconcile`). */
	cwd: string;
	/** Root slugs whose subtrees may be picked up, or the whole project. Never implicit. */
	scope: string[] | "project";
	/** Worker budget of each started run, as a manual reconcile's. */
	budget: number;
	land?: LandingMode;
	/** Quiet period (ms) a subtree's issue files must hold before it is taken. */
	settle: number;
	watcher?: number;
	started: Record<string, { at: string; pid: number }>;
	lastScan?: { at: string; started: string[]; skipped: Record<string, string> };
	log: string[];
}

export const RECOVERY_MS = 5 * 60_000;
export const pickupDir = (cwd: string) => join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "pickup");
const stateFile = (cwd: string) => join(pickupDir(cwd), "state.json");
const stamp = () => new Date().toISOString().slice(0, 19);

export function loadPickup(cwd: string): Pickup | undefined {
	const f = stateFile(cwd);
	return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : undefined;
}

/** Every pickup change, and every scan with its starts, runs under one process-shared lock: two watchers, a watcher
 * and a manual scan, or a scan and a reconfiguration never interleave. */
function locked<T>(cwd: string, work: () => T): T {
	mkdirSync(pickupDir(cwd), { recursive: true });
	const db = new Database(join(pickupDir(cwd), "lock.sqlite"), { create: true });
	try {
		db.exec("PRAGMA busy_timeout = 60000");
		return db.transaction(work).immediate();
	} finally { db.close(); }
}
function save(cwd: string, s: Pickup) {
	s.log = s.log.slice(-200);
	writeFileSync(stateFile(cwd) + ".tmp", JSON.stringify(s, null, 1));
	renameSync(stateFile(cwd) + ".tmp", stateFile(cwd));
}
const update = (cwd: string, change: (s: Pickup | undefined) => Pickup) => locked(cwd, () => { const s = change(loadPickup(cwd)); save(cwd, s); return s; });

/** The live watcher's pid, by pid and command line: an old pid may have been reused on this shared host. */
export function watcherAlive(s: Pickup | undefined): number | undefined {
	if (!s?.watcher || !pidAlive(s.watcher)) return;
	try {
		const command = execFileSync("ps", ["-p", String(s.watcher), "-o", "command="], { encoding: "utf8" });
		return /pickup\.ts watch\b/.test(command) ? s.watcher : undefined;
	} catch { return; }
}

export interface Configure {
	cwd: string; owner: string; ownerSession?: string;
	scope?: string[] | "project"; budget?: number; land?: LandingMode; settle?: number; paused?: boolean;
	/** Tests configure without a watcher process. */
	watch?: boolean;
}
/** Enable or change this repository's pickup. Another live owner's pickup is refused: it stops it first. */
export async function configure(o: Configure): Promise<ReturnType<typeof status>> {
	const prior = loadPickup(o.cwd);
	if (prior?.enabled && prior.owner !== o.owner) {
		const live = [...await bbThreads()].some(([id, t]) => id === prior.owner && !t.archivedAt);
		if (live) throw new Error("pickup here is owned by @thread:" + prior.owner + "; it runs pickup_stop first");
	}
	if (Array.isArray(o.scope) && !o.scope.length) throw new Error("scope lists at least one root, or is \"project\"");
	const scope = o.scope ?? (prior?.enabled ? prior.scope : undefined);
	if (!scope) throw new Error("enabling pickup takes an explicit scope: root slugs, or \"project\"");
	if (Array.isArray(scope)) {
		const known = getTracker(o.cwd).snapshot();
		const missing = scope.filter(slug => !known.has(slug));
		if (missing.length) throw new Error("not in the tracker: " + missing.join(", "));
	}
	update(o.cwd, p => {
		const next: Pickup = {
			...(p ?? { started: {}, log: [] }),
			enabled: true, owner: o.owner, ownerSession: o.ownerSession ?? p?.ownerSession, cwd: resolve(o.cwd), scope,
			budget: o.budget ?? p?.budget ?? 6, land: o.land ?? p?.land, settle: o.settle ?? p?.settle ?? 60_000,
			paused: o.paused ?? p?.paused ?? false,
		} as Pickup;
		next.log.push(stamp() + " configured by @thread:" + o.owner + ": scope " + JSON.stringify(scope) + ", budget " + next.budget + (next.paused ? ", paused" : ""));
		return next;
	});
	if (o.watch !== false) ensureWatcher(o.cwd);
	return status(o.cwd);
}

/** Disable: the watcher exits and nothing more starts. Running reconcilers continue (reconcile_stop ends one). */
export function stopPickup(cwd: string) {
	const s = update(cwd, p => {
		if (!p) throw new Error("no pickup configured here");
		return { ...p, enabled: false, log: [...p.log, stamp() + " stopped"] };
	});
	const pid = watcherAlive(s);
	if (pid) process.kill(pid, "SIGTERM");
	return status(cwd);
}

/** Start the watcher unless one is live. Idempotent; the owner's session start calls it after a host restart. */
export function ensureWatcher(cwd: string): number | undefined {
	const s = loadPickup(cwd);
	if (!s?.enabled) return;
	const live = watcherAlive(s);
	if (live) return live;
	const log = join(pickupDir(cwd), "watcher.log");
	const fd = openSync(log, "a");
	const child = Bun.spawn(["bun", import.meta.path, "watch", "--cwd", s.cwd], { cwd: s.cwd, stdio: ["ignore", fd, fd], env: { ...process.env, PI_SESSION_ID: "" } });
	child.unref();
	closeSync(fd);
	update(cwd, p => ({ ...p!, watcher: child.pid }));
	return child.pid;
}

export function status(cwd: string) {
	const s = loadPickup(cwd);
	if (!s) return { configured: false };
	return { configured: true, enabled: s.enabled, paused: s.paused, owner: s.owner, scope: s.scope, budget: s.budget, land: s.land ?? null,
		settleSeconds: s.settle / 1000, watcher: watcherAlive(s) ?? null, started: s.started, lastScan: s.lastScan ?? null, log: s.log.slice(-15) };
}

const ancestors = (slug: string, rows: Map<string, Issue>) => {
	const out: Issue[] = [];
	for (let p = rows.get(slug)?.partOf; p && rows.has(p) && !out.some(a => a.slug === p); p = rows.get(p)?.partOf) out.push(rows.get(p)!);
	return out;
};
const ownClaims = (i: Issue) => i.claims.filter(c => c.slug === i.slug);

/** Which frontier roots this pickup may start now, and why every other frontier row in scope is skipped. Pure: the
 * snapshot, the roots that have any reconciler state, and each subtree's last change are supplied. */
export function select(s: Pick<Pickup, "scope" | "settle" | "started">, rows: Map<string, Issue>, runs: Map<string, string>,
	changedAt: (slugs: string[]) => number, now: number): { start: string[]; skipped: Record<string, string>; retryIn?: number } {
	const start: string[] = [], skipped: Record<string, string> = {};
	let retryIn: number | undefined;
	const inScope = (i: Issue) => s.scope === "project" || s.scope.includes(i.slug) || ancestors(i.slug, rows).some(a => s.scope.includes(a.slug));
	for (const row of rows.values()) {
		if (!row.frontier || !inScope(row)) continue;
		const up = ancestors(row.slug, rows);
		const held = up.find(a => ownClaims(a).length);
		if (held) { skipped[row.slug] = "ancestor " + held.slug + " claimed: " + ownClaims(held).map(c => c.claimedBy).join("; "); continue; }
		const wider = up.find(a => a.frontier && inScope(a));
		if (wider) { skipped[row.slug] = "inside frontier root " + wider.slug; continue; }
		if (runs.has(row.slug)) { skipped[row.slug] = "has reconciler state (" + runs.get(row.slug) + "); restart it by hand"; continue; }
		if (s.started[row.slug]) { skipped[row.slug] = "already started by pickup at " + s.started[row.slug].at; continue; }
		const subtree = [...rows.values()].filter(i => i.slug === row.slug || ancestors(i.slug, rows).some(a => a.slug === row.slug)).map(i => i.slug);
		const quiet = now - changedAt(subtree);
		if (quiet < s.settle) {
			skipped[row.slug] = "settling: changed " + Math.round(quiet / 1000) + "s ago";
			retryIn = Math.min(retryIn ?? Infinity, s.settle - quiet);
			continue;
		}
		start.push(row.slug);
	}
	return { start, skipped, retryIn };
}

/** One discovery pass under the pickup lock: select, start and record. Returns when a settling tree is due again. */
export function scan(cwd: string, deps: {
	snapshot?: () => Map<string, Issue>;
	startRun?: (root: string, s: Pickup) => { pid: number };
	now?: () => number;
} = {}): { started: string[]; skipped: Record<string, string>; retryIn?: number } {
	return locked(cwd, (): { started: string[]; skipped: Record<string, string>; retryIn?: number } => {
		const s = loadPickup(cwd);
		if (!s?.enabled) return { started: [], skipped: {} };
		if (s.paused) return { started: [], skipped: { "*": "paused" } };
		const rows = (deps.snapshot ?? (() => getTracker(s.cwd).snapshot()))();
		const runs = new Map(campaigns(s.cwd).map(r => [r.root, r.running ? "running" : r.finished ?? (r.stopping ? "stopping" : "not running")]));
		// Vault rows carry their absolute file; a backend without one (GitHub) has no local change time to wait out.
		const changedAt = (slugs: string[]) => Math.max(0, ...slugs.map(slug => {
			const file = rows.get(slug)?.file;
			try { return file && isAbsolute(file) ? statSync(file).mtimeMs : 0; } catch { return 0; }
		}));
		const picked = select(s, rows, runs, changedAt, (deps.now ?? Date.now)());
		const started: string[] = [];
		for (const root of picked.start) {
			try {
				const run = (deps.startRun ?? ((root, s) => start({ cwd: s.cwd, root, owner: s.owner, ownerSession: s.ownerSession, budget: s.budget, land: s.land, quiet: true })))(root, s);
				s.started[root] = { at: stamp(), pid: run.pid };
				s.log.push(stamp() + " started " + root + " (pid " + run.pid + ")");
				started.push(root);
			} catch (e) {
				picked.skipped[root] = "start failed: " + String((e as Error).message ?? e).split("\n")[0];
				s.log.push(stamp() + " start failed for " + root + ": " + picked.skipped[root]);
			}
		}
		s.lastScan = { at: stamp(), started, skipped: picked.skipped };
		save(cwd, s);
		return { started, skipped: picked.skipped, retryIn: picked.retryIn };
	});
}

/** The watcher: scan at start, after each quiet tracker change, when a settling tree is due, and every RECOVERY_MS. */
async function watch(cwd: string) {
	const me = update(cwd, p => {
		if (!p?.enabled) throw new Error("pickup is not enabled");
		const live = watcherAlive(p);
		if (live && live !== process.pid) throw new Error("watcher already running as pid " + live);
		return { ...p, watcher: process.pid, log: [...p.log, stamp() + " watcher " + process.pid + " started"] };
	});
	let timer: ReturnType<typeof setTimeout> | undefined;
	const kick = (ms: number) => { clearTimeout(timer); timer = setTimeout(tick, ms); };
	const tick = () => {
		const s = loadPickup(cwd);
		if (!s?.enabled || s.watcher !== process.pid) { console.log(stamp() + " pickup disabled or superseded; exiting"); process.exit(0); }
		try {
			const r = scan(cwd);
			if (r.started.length) console.log(stamp() + " started " + r.started.join(", "));
			if (r.retryIn !== undefined) kick(r.retryIn + 1000);
		} catch (e) { console.log(stamp() + " scan failed: " + String((e as Error)?.stack ?? e)); }
	};
	const dir = findIssuesDir(me.cwd, false);
	if (dir) watchDir(dir, { recursive: true }, () => kick(1000));
	setInterval(() => kick(0), RECOVERY_MS);
	for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => process.exit(0));
	tick();
	await new Promise(() => {});
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { cwd: { type: "string", default: process.cwd() } } });
	const cwd = resolve(values.cwd!);
	const [cmd] = positionals;
	if (cmd === "watch") await watch(cwd);
	else if (cmd === "status") console.log(JSON.stringify(status(cwd), null, 1));
	else if (cmd === "scan") console.log(JSON.stringify(scan(cwd), null, 1));
	else if (cmd === "stop") console.log(JSON.stringify(stopPickup(cwd), null, 1));
	else { console.error("usage: pickup.ts status|scan|watch|stop [--cwd DIR]  (configure through the supervision `pickup` tool)"); process.exit(2); }
}
