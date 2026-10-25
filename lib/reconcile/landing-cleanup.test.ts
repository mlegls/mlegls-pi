import { expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";

// 2026-10-25 (concept): five roots ran on for hours after landing, retrying the cleanup of a reviewer already retired
// while their final reviewers' worktrees stayed. In-process reconciler, budget 0: nothing launches.
async function landed(prepare: (f: ReturnType<typeof protocolFixture>, r: typeof import("./reconcile"), head: string) => Promise<void>,
	done: (r: typeof import("./reconcile"), f: ReturnType<typeof protocolFixture>) => boolean) {
	const f = protocolFixture(), from = process.cwd();
	process.env.PI_RECONCILE_TICK_MS = "100";
	const r = await import("./reconcile");
	const controller = new AbortController();
	try {
		f.tracker.update("root", { stage: "ticket" });
		f.bb.addThread("thr_owner");
		const head = f.git(f.cwd, "rev-parse", "HEAD"), at = new Date().toISOString();
		const result = { parent: null, summary: "root summary", handoff: {} };
		// The receipt an earlier integration attempt wrote names its reviewer, since retired: its bb thread is gone.
		const gone = { run: "protocol", handle: "root-review-3", path: join(f.root, "root-review-3"), bb: "bbt-gone" };
		r.saveState({ backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 0,
			landed: { root: { into: f.cwd, head, at } }, results: { root: result },
			landingOps: { root: { slug: "root", into: f.cwd, destination: f.cwd, before: head, worker: gone, preparedHead: head,
				carried: [], result, workers: [gone], landedHead: head, at } },
			refinements: {}, collectors: {}, chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
		await prepare(f, r, head);
		const timer = setInterval(() => { if (done(r, f)) controller.abort(); }, 50);
		const deadline = setTimeout(() => controller.abort(), 20_000);
		try { await r.run({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 0, signal: controller.signal }); }
		finally { process.chdir(from); }
		clearInterval(timer); clearTimeout(deadline);
		return { f, state: r.load(f.cwd, "root")! };
	} catch (e) { f.close(); throw e; }
}

test("a landing cleanup skips a retired worker, retires the final reviewer the receipt lacked keeping its ignored state, and finishes", async () => {
	let review = { run: "", handle: "", path: "", bb: "" };
	const { f, state } = await landed(async (f, r) => {
		review = f.worker("root-review-5", f.cwd, "main");
		appendFileSync(join(f.git(f.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "info/exclude"), ".env\n");
		writeFileSync(join(review.path, ".env"), "SECRET=only-here\n");
		// The landing was recorded from the earlier receipt; the chain still holds the reviewer that landed it.
		const s = r.load(f.cwd, "root")!;
		r.saveState({ ...s, chains: { root: { into: f.cwd, self: false, phase: "integrate", retries: {}, workers: [], handle: review } } });
	}, (r, f) => !!r.load(f.cwd, "root")?.finished);
	try {
		expect(state.finished).toBe("done");
		expect(state.landingOps.root.cleanupDone).toBeTruthy();
		expect(state.landingOps.root.workers.map(w => w.handle)).toEqual(["root-review-3", "root-review-5"]);
		expect(f.bb.threads().find(t => t.id === review.bb)?.archivedAt).not.toBeNull();
		expect(existsSync(review.path)).toBe(false);
		const kept = join(f.cwd + "__retired", "root-review-5");
		expect(readFileSync(join(kept, ".env"), "utf8")).toBe("SECRET=only-here\n");
		expect(readFileSync(join(kept, "RETIRED.md"), "utf8")).toContain("- .env");
		expect(state.log.some(l => l.includes("deferred"))).toBe(false);
		const owner = f.bb.threads().find(t => t.id === "thr_owner")!.tells.join("\n");
		expect(owner).toContain("root-review-5 after it finished; its worktree held ignored state");
	} finally { f.close(); }
}, 30_000);

test("a landing cleanup that keeps failing is one owner exception, and an answer finishes it", async () => {
	let answered = false;
	const { f, state } = await landed(async (f, r) => {
		// git refuses to remove a collector holding an untracked file, every tick.
		writeFileSync(join(f.collector, "stray.txt"), "not committed\n");
		const s = r.load(f.cwd, "root")!;
		const collector = { path: f.collector, branch: "collector", parentBranch: "main" };
		r.saveState({ ...s, landingOps: { root: { ...s.landingOps.root, collector } } });
	}, (r, f) => {
		const s = r.load(f.cwd, "root");
		if (!answered && s?.exceptions.root?.mailed) {
			mkdirSync(r.resolutionsDir(f.cwd, "root"), { recursive: true });
			writeFileSync(join(r.resolutionsDir(f.cwd, "root"), "root.json"), JSON.stringify({ action: "answer", note: "leave the collector" }));
			answered = true;
		}
		return !!s?.finished;
	});
	try {
		expect(state.finished).toBe("done");
		expect(state.exceptions).toEqual({});
		expect(state.landingOps.root.cleanupDone).toBeTruthy();
		expect(state.resolved.root).toEqual(["landing cleanup failed → answer: leave the collector"]);
		expect(state.log.filter(l => l.includes("landing cleanup root deferred"))).toHaveLength(1);
		const owner = f.bb.threads().find(t => t.id === "thr_owner")!.tells.join("\n");
		expect(owner.split("needs you: root — landing cleanup failed")).toHaveLength(2);
		expect(existsSync(join(f.collector, "stray.txt"))).toBe(true);
	} finally { f.close(); }
}, 30_000);
