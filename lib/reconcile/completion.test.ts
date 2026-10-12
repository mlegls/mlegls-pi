import { expect, test } from "bun:test";
import { closeAtTarget, finishLandingCleanup, landReviewed, recoverLandings, reviewedResult, type CompletionContext } from "./completion";
import { protocolFixture } from "./protocol-fixture";

test("landings carry leaf results to the owner, replay merged code and incomplete child-first closes after retirement", async () => {
	const f = protocolFixture();
	try {
		f.create("leaf", { "part-of": "root" });
		f.create("outside", { "blocked-by": ["leaf"] });
		let failLandingSave = false;
		const context: CompletionContext = {
			state: f.state, tracker: f.tracker, pathOf: into => into === "root" ? f.collector : into,
			locked: async work => work(),
			save: () => {
				if (failLandingSave && context.state.landed.root) {
					failLandingSave = false;
					throw new Error("interrupted ledger save");
				}
				f.save(context.state);
			},
		};
		const leaf = await f.worker("leaf-worker");
		f.commit(leaf.path, "leaf.txt", "leaf code\n");
		const leafResult = reviewedResult("root", { summary: "leaf summary", evidence: { path: "docs/attachments/leaf.md" } }, "leaf report");
		// Omit a packet here: these transitions, not packet/gate validation, are the test's boundary.
		delete leafResult.handoff.evidence;
		expect((await landReviewed(context, { slug: "leaf", into: "root", worker: leaf, workers: [leaf],
			result: leafResult, tests: [] })).ok).toBe(true);
		closeAtTarget(context);
		expect(f.tracker.fields("leaf").stage).toBe("ticket");
		expect(f.tracker.snapshot().get("outside")?.frontier).toBe(false);
		expect(context.state.landed.leaf.into).toBe("root");
		finishLandingCleanup(context, "leaf");

		const rootWorker = await f.worker("root-worker", f.collector, "main");
		f.commit(rootWorker.path, "root.txt", "join code\n");
		const rootResult = reviewedResult(null, { summary: "root summary" }, "root report");
		failLandingSave = true;
		await expect(landReviewed(context, { slug: "root", into: f.cwd, worker: rootWorker, workers: [rootWorker],
			collector: { path: f.collector, branch: "collector", parentBranch: "main" },
			result: rootResult, tests: [] })).rejects.toThrow("interrupted ledger save");
		const targetHead = f.git(f.cwd, "rev-parse", "HEAD");
		context.state = f.restore();
		expect(context.state.landed.root).toBeUndefined();
		expect(context.state.landingOps.root.preparedHead).toBe(targetHead);
		// The source and collector are gone before replay; only saved exact ancestry can prove this landing.
		for (const path of [leaf.path, rootWorker.path, f.collector]) f.git(f.cwd, "worktree", "remove", "--force", path);
		await context.locked(async () => recoverLandings(context));
		expect(context.state.landed.leaf.into).toBe(f.cwd);
		expect(context.state.landed.leaf.head).toBe(targetHead);
		expect(context.state.results.leaf.summary).toBe("leaf summary");
		const replay = await landReviewed(context, { slug: "root", into: f.cwd, worker: rootWorker,
			workers: [], result: reviewedResult(null, {}, "must not replace"), tests: [] });
		expect(replay).toEqual({ ok: true, head: targetHead, replayed: true });
		expect(f.git(f.cwd, "rev-parse", "HEAD")).toBe(targetHead);

		const calls: string[] = [];
		let interruptClose = true;
		context.tracker = { ...f.tracker, close(slug, result) {
			expect(context.state.landed[slug].into).toBe(f.cwd);
			calls.push(slug); f.tracker.close(slug, result);
			if (interruptClose) { interruptClose = false; throw new Error("interrupted close receipt"); }
		} };
		expect(() => closeAtTarget(context)).toThrow("interrupted close receipt");
		context.state = f.restore();
		expect(context.state.results.leaf.closedAt).toBeUndefined();
		expect(f.tracker.fields("leaf").stage).toBe("done");
		closeAtTarget(context);
		expect(calls).toEqual(["leaf", "leaf", "root"]);
		expect(f.tracker.text("leaf")).toContain("leaf summary");
		expect(f.tracker.text("leaf")).toContain("docs/attachments/leaf.md");
		expect(f.tracker.text("leaf")).not.toContain("root summary");
		expect(f.tracker.snapshot().get("outside")?.frontier).toBe(true);
		context.state = f.restore();
		expect(context.state.results.root.closedAt).toBeTruthy();
		closeAtTarget(context);
		expect(calls).toHaveLength(3);
		finishLandingCleanup(context, "root");
		expect(f.restore().landingOps.root.cleanupDone).toBeTruthy();
	} finally { f.close(); }
}, 30_000);
