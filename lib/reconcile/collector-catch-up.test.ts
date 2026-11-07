import { expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";
import { excludeTracker } from "../thread/tracker-worktree";
import type { State } from "./reconcile";

// Root collector R (f.collector) holds b; sub-collector S was cut from R before b landed there, and S's child c is
// blocked by b. 2026-11-07 (concept, release-the-open-local-product): such dependents waited until R was merged into
// their sub-collectors by hand and the run restarted.
type Fixture = ReturnType<typeof protocolFixture>;
type Reconcile = typeof import("./reconcile");

function tree(f: Fixture) {
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Shell fixture.\n");
	f.bb.addThread("thr_owner");
	f.create("b", { "part-of": "root", assignee: "human" });
	f.create("s", { "part-of": "root" });
	f.create("c", { "part-of": "s", "blocked-by": ["b"], assignee: "agent:shell" });
	const sub = join(f.root, "s-tree");
	f.git(f.cwd, "worktree", "add", "--no-checkout", "-qb", "tree/s", sub, f.git(f.collector, "rev-parse", "HEAD"));
	excludeTracker(sub);
	return sub;
}
const state = (f: Fixture, sub: string, extra: Partial<State> = {}): State => ({
	backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 1,
	landed: {}, results: {}, landingOps: {}, refinements: {},
	collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" },
		s: { path: sub, branch: "tree/s", parentBranch: "collector" } },
	chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [], ...extra,
});
const landedIn = (into: string, head: string) => ({ b: { into, head, at: new Date().toISOString() } });

/** A reconciler process on the fixture (a fresh process reads the fixture's agents): step runs every 100ms until it
 * returns true, then the run stops. */
async function reconcile(f: Fixture, step: (r: Reconcile, s: State) => boolean) {
	const r = await import("./reconcile"), { start, stop } = await import("./main");
	process.env.PI_RECONCILE_TICK_MS = "100";
	start({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1 });
	try {
		for (let i = 0; i < 300; i++) {
			const s = r.load(f.cwd, "root");
			if (s && step(r, s)) return s;
			await Bun.sleep(100);
		}
		throw new Error("timed out: " + JSON.stringify(r.load(f.cwd, "root")?.log));
	} finally { await stop(f.cwd, "root"); }
}

test("a landing in the enclosing collector is merged into the sub-collector and launches its dependent", async () => {
	const f = protocolFixture();
	try {
		const sub = tree(f), before = f.git(sub, "rev-parse", "HEAD");
		const head = f.commit(f.collector, "b.txt", "b landed\n");
		const r = await import("./reconcile");
		r.saveState(state(f, sub, { landed: landedIn("root", head) }));
		const s = await reconcile(f, (_, s) => !!s.chains.c?.handle || !!s.finished);
		expect(s.chains.c).toMatchObject({ into: "s", phase: "implement" });
		// S had nothing of its own yet: the merge fast-forwards it to R.
		expect(f.git(sub, "rev-parse", "HEAD")).toBe(head);
		expect(f.git(sub, "merge-base", "--is-ancestor", before, "HEAD")).toBe("");
		expect(s.log.some(l => l.includes("merged collector into tree/s: b landed there"))).toBe(true);
		expect(s.exceptions).toEqual({});
	} finally { f.close(); }
}, 60_000);

test("a conflicting catch-up raises one owner exception naming the files, and retry after a hand merge resumes", async () => {
	const f = protocolFixture();
	try {
		const sub = tree(f);
		f.commit(sub, "shared.txt", "s side\n");
		const head = f.commit(f.collector, "shared.txt", "r side\n");
		const r = await import("./reconcile");
		r.saveState(state(f, sub, { landed: landedIn("root", head) }));
		let merged = false;
		const s = await reconcile(f, (r, s) => {
			if (s.exceptions.s && !merged) {
				expect(s.exceptions.s).toMatchObject({ level: "owner", reason: "collector cannot take its parent's landing of b" });
				expect(s.exceptions.s.text).toContain("shared.txt");
				expect(existsSync(join(f.git(sub, "rev-parse", "--absolute-git-dir"), "MERGE_HEAD"))).toBe(false);
				// The owner merges by hand, then resolves with retry.
				try { f.git(sub, "merge", "-q", "--no-edit", "collector"); } catch {}
				writeFileSync(join(sub, "shared.txt"), "both sides\n");
				f.git(sub, "add", "shared.txt"); f.git(sub, "commit", "-qm", "hand merge");
				mkdirSync(r.resolutionsDir(f.cwd, "root"), { recursive: true });
				writeFileSync(join(r.resolutionsDir(f.cwd, "root"), "s.json"), JSON.stringify({ action: "retry" }));
				merged = true;
			}
			return (!!s.chains.c?.handle && !s.exceptions.s) || !!s.finished;
		});
		expect(merged).toBe(true);
		expect(s.chains.c).toMatchObject({ into: "s", phase: "implement" });
		expect(s.exceptions).toEqual({});
		expect(s.log.filter(l => l.includes("exception s: collector cannot take"))).toHaveLength(1);
		expect(s.log.some(l => l.includes("resolved s: retry"))).toBe(true);
		const told = f.bb.threads().find(t => t.id === "thr_owner")!.tells;
		expect(told.some(t => t.includes("shared.txt"))).toBe(true);
	} finally { f.close(); }
}, 60_000);

test("a landing in a sibling collector leaves the dependent blocked", async () => {
	const f = protocolFixture();
	try {
		const sub = tree(f), before = f.git(sub, "rev-parse", "HEAD");
		const sibling = join(f.root, "t-tree");
		f.git(f.cwd, "worktree", "add", "--no-checkout", "-qb", "tree/t", sibling, f.git(f.collector, "rev-parse", "HEAD"));
		excludeTracker(sibling);
		const head = f.commit(sibling, "b.txt", "b landed in t\n");
		// Even when R contains it: the ledger records it into T, which encloses nothing here.
		f.git(f.collector, "merge", "-q", "--ff-only", "tree/t");
		const r = await import("./reconcile");
		const base = state(f, sub, { landed: landedIn("t", head) });
		r.saveState({ ...base, collectors: { ...base.collectors, t: { path: sibling, branch: "tree/t", parentBranch: "collector" } } });
		const told = () => f.bb.threads().find(t => t.id === "thr_owner")!.tells.some(t => t.includes("c: blocked by b (not satisfied at this destination)"));
		const s = await reconcile(f, (_, s) => !!s.chains.c || (!!s.finished && told()));
		expect(s.finished).toBe("stuck");
		expect(s.chains.c).toBeUndefined();
		expect(f.git(sub, "rev-parse", "HEAD")).toBe(before);
	} finally { f.close(); }
}, 60_000);
