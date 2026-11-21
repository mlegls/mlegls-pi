import { expect, test } from "bun:test";
import { schedulingView } from "./scheduling";
import { protocolFixture } from "./protocol-fixture";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { start, stop, resolveException } from "./main";
import { load, saveState, type State } from "./reconcile";
import { excludeTracker } from "../thread/tracker-worktree";

async function until<T>(read: () => T | undefined | false): Promise<T> {
	for (let i = 0; i < 400; i++) {
		const value = read();
		if (value) return value;
		await Bun.sleep(100);
	}
	throw new Error("timed out waiting for scheduling replay");
}
const state = (f: ReturnType<typeof protocolFixture>): State => ({
	backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 1,
	landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: {},
	exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [],
});
const spawns = (f: ReturnType<typeof protocolFixture>) => f.bb.calls().filter(c => c.slice(0, 5).join(" ") === "plugin rpc call supervision workerSpawn");

test("collector-local landings release remaining work without releasing canonical outside blockers or foreign claims", () => {
	const f = protocolFixture();
	try {
		f.create("a", { "part-of": "root", assignee: "human", priority: 4, "claimed-by": "reconcile:root" });
		f.create("b", { "part-of": "root", "blocked-by": ["a"] });
		f.create("outside", { "blocked-by": ["a"] });
		const canonical = f.tracker.snapshot(), before = structuredClone([...canonical]);
		const context = { root: "root", into: "root", landed: {
			a: { into: "root", head: "code-head", at: new Date().toISOString() },
		}, attemptClaims: new Set<string>(), withheld: new Set<string>() };
		const local = schedulingView(canonical, context);
		expect(local.get("a")?.satisfied).toBe(true);
		expect(local.get("a")?.done).toBe(false);
		expect(local.get("b")?.frontier).toBe(true);
		expect(local.get("root")?.eligible).toBe(true);
		expect(local.get("root")?.deferred).toBe(false);
		expect(local.get("root")?.selectors).toEqual([
			{ slug: "root", assignee: "agent" }, { slug: "b", assignee: "agent" },
		]);
		const elsewhere = schedulingView(canonical, { ...context, into: f.cwd });
		expect(elsewhere.get("b")?.frontier).toBe(false);
		expect(elsewhere.get("outside")?.blockers).toEqual(["a"]);
		expect(elsewhere.get("outside")?.frontier).toBe(false);

		f.tracker.update("a", { "claimed-by": "session:foreign" });
		expect(schedulingView(f.tracker.snapshot(), context).get("root")?.frontier).toBe(false);
		f.tracker.update("a", { "claimed-by": "reconcile:root/refine" });
		const provisional = schedulingView(f.tracker.snapshot(), { ...context,
			attemptClaims: new Set(["reconcile:root/refine"]), withheld: new Set(["a"]),
		});
		expect(provisional.get("a")?.satisfied).toBe(false);
		expect(provisional.get("root")?.frontier).toBe(false);
		expect([...canonical]).toEqual(before);
		expect(canonical.get("a")?.done).toBe(false);
		expect(f.tracker.snapshot().get("outside")?.frontier).toBe(false);
	} finally { f.close(); }
}, 30_000);

// Approved 11-09 replay: reviewed delivery in R, stale nested S, an already-waiting duplicate,
// then two same-base attempts and a refused third. Fake-bb launches no model or fixture preparation.
test("reviewed snapshot delivery catches up its stale collector, retains a waiting worker, and caps identical implementation launches", async () => {
	for (const waiting of [false, true]) {
		const f = protocolFixture();
		let running = false;
		try {
			process.env.PI_RECONCILE_TICK_MS = "100";
			f.bb.addThread("thr_owner");
			f.create("s", { "part-of": "root" });
			f.create("snapshot", { "part-of": "s", assignee: "agent:shell" });
			f.create("hold", { "part-of": "s", assignee: "human" });
			const sub = join(f.root, "s-tree");
			f.git(f.cwd, "worktree", "add", "--no-checkout", "-qb", "tree/s", sub, "collector");
			excludeTracker(sub);
			const base = f.git(sub, "rev-parse", "HEAD");
			const head = f.commit(f.collector, "snapshot.txt", "reviewed snapshot recipe\n");
			const s = state(f);
			s.collectors = { root: { path: f.collector, branch: "collector", parentBranch: "main" },
				s: { path: sub, branch: "tree/s", parentBranch: "collector" } };
			s.landed.snapshot = { into: "root", head, at: new Date().toISOString() };
			const worker = waiting ? { ...f.worker("snapshot-implement-23", sub, "tree/s"), run: "root" } : undefined;
			if (worker) {
				f.bb.addThread(worker.bb, worker.path, "root/" + worker.handle);
				f.bb.completeTurn(worker.path, "waiting — prepare-current-5000-card-fixture is running");
				s.chains.snapshot = { into: "s", self: false, phase: "implement", handle: worker, base,
					launchedAt: Date.now() - 60_000, waitingSince: new Date().toISOString(), retries: {}, workers: [] };
			}
			saveState(s);
			start({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1 }); running = true;
			await until(() => {
				const s = load(f.cwd, "root");
				return waiting ? s?.exceptions.snapshot?.mailed && s : s?.finished && s;
			});
			await Bun.sleep(500);
			const after = load(f.cwd, "root")!;
			expect(f.git(sub, "rev-parse", "HEAD")).toBe(head);
			expect(spawns(f)).toHaveLength(0);
			expect(after.landed.snapshot).toEqual(s.landed.snapshot);
			if (worker) {
				expect(after.chains.snapshot.handle).toEqual(worker);
				expect(after.exceptions.snapshot.reason).toBe("active chain after recorded landing");
				expect(after.exceptions.snapshot.text).toContain("prepare-current-5000-card-fixture");
				expect(after.log.filter(l => l.includes("exception snapshot:"))).toHaveLength(1);
				expect(f.bb.threads().find(t => t.id === worker.bb)?.archivedAt).toBeNull();
			} else expect(after.exceptions).toEqual({});
		} finally { if (running) await stop(f.cwd, "root"); f.close(); }
	}

	const f = protocolFixture();
	let running = false;
	try {
		process.env.PI_RECONCILE_TICK_MS = "100";
		mkdirSync(join(f.root, "agents/roles"), { recursive: true });
		writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
		writeFileSync(join(f.root, "agents/roles/implement.md"), "Shell fixture.\n");
		f.tracker.update("root", { stage: "ticket", assignee: "agent:shell" });
		f.bb.addThread("thr_owner");
		saveState(state(f));
		start({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1 }); running = true;
		const first = await until(() => load(f.cwd, "root")?.chains.root?.handle);
		f.bb.completeTurn(first.path, "waiting — preparation runs");
		await until(() => load(f.cwd, "root")?.chains.root?.waitingSince);
		await Bun.sleep(500);
		expect(spawns(f)).toHaveLength(1);
		expect(load(f.cwd, "root")!.chains.root.handle).toEqual(first);
		for (let attempt = 1; attempt <= 2; attempt++) {
			const worker = load(f.cwd, "root")!.chains.root.handle!;
			f.bb.completeTurn(worker.path, "blocked — prerequisite code is still missing");
			await until(() => load(f.cwd, "root")?.exceptions.root?.mailed);
			resolveException(f.cwd, "root", "root", { action: "redispatch", note: "Replay the historical unchanged-base retry" });
			if (attempt === 1) await until(() => {
				const next = load(f.cwd, "root")?.chains.root?.handle;
				return next && next.handle !== worker.handle && next;
			});
		}
		const held = await until(() => {
			const ex = load(f.cwd, "root")?.exceptions.root;
			return ex?.reason === "repeated implementation on unchanged prerequisites" && ex.mailed && ex;
		});
		await Bun.sleep(500);
		const after = load(f.cwd, "root")!;
		expect(spawns(f)).toHaveLength(2);
		expect(after.exceptions.root.id).toBe(held.id);
		expect(after.log.filter(l => l.includes("exception root: repeated implementation"))).toHaveLength(1);
		expect(after.implementationLaunches?.root).toHaveLength(1);
		expect(after.implementationLaunches!.root[0].handles).toHaveLength(2);
	} finally { if (running) await stop(f.cwd, "root"); f.close(); }
}, 120_000);
