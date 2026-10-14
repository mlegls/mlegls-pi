import { expect, test } from "bun:test";
import { acceptRefinement, beginRefinement, discardRefinement, recoverRefinements, replaceRefinement, type RefinementContext } from "./refinement";
import { protocolFixture } from "./protocol-fixture";

test("failed refinement stops its writer before graph-safe cleanup and replays removal without rolling back the contract", async () => {
	const f = protocolFixture();
	try {
		let failStop = true, failRemove = true, stopped = false;
		const removed: string[] = [];
		const context: RefinementContext = {
			state: f.state, locked: async work => work(), save: () => f.save(context.state),
			stopWriter: async attempt => {
				expect(attempt.handle).toBe("failed");
				if (failStop) { failStop = false; throw new Error("writer still live"); }
				stopped = true;
			},
			tracker: { ...f.tracker, remove(slug) {
				expect(stopped).toBe(true);
				f.tracker.remove(slug); removed.push(slug);
				if (failRemove) { failRemove = false; throw new Error("interrupted removal"); }
			} },
		};
		const attempt = beginRefinement(context, "root", "failed");
		f.create("container", { stage: "spec", "part-of": "root", "claimed-by": attempt.claim });
		f.create("leaf", { "part-of": "container", "claimed-by": attempt.claim });
		f.create("dependent", { "part-of": "container", "claimed-by": attempt.claim, "blocked-by": ["leaf"] });
		f.tracker.update("container", { stage: null });
		f.tracker.update("root", { stage: null, priority: 3 }, "Sharpened contract survives\n");
		// No observation save followed these creates: restart must discover exact claim ownership.
		context.state = f.restore();
		expect(context.state.refinements.failed.owned).toEqual([]);
		await expect(discardRefinement(context, "failed")).rejects.toThrow("writer still live");
		expect(f.tracker.snapshot().has("dependent")).toBe(true);
		expect(removed).toEqual([]);
		context.state = f.restore();
		await expect(recoverRefinements(context)).rejects.toThrow("interrupted removal");
		expect(removed).toEqual(["dependent"]);
		context.state = f.restore();
		await recoverRefinements(context);
		expect(removed).toEqual(["dependent", "leaf", "container"]);
		expect(f.tracker.fields("root").stage).toBe("spec");
		expect(f.tracker.fields("root").priority).toBe(3);
		expect(f.tracker.text("root")).toContain("Sharpened contract survives");
		expect(f.restore().refinements.failed.phase).toBe("removed");
	} finally { f.close(); }
}, 30_000);

test("adoption saves successor ownership before claim transfer; ordinary replacement prunes only its remaining provisional children", async () => {
	const f = protocolFixture();
	try {
		f.create("baseline", { "part-of": "root" });
		const stops: string[] = [];
		let interruptTransfer = true;
		const context: RefinementContext = {
			state: f.state, locked: async work => work(), save: () => f.save(context.state),
			stopWriter: async attempt => { stops.push(attempt.handle); },
			tracker: { ...f.tracker, update(slug, fields, body) {
				if (fields["claimed-by"] === "reconcile:root/second") {
					expect(f.restore().refinements.second.phase).toBe("adopting");
					expect(stops).toContain("first");
				}
				f.tracker.update(slug, fields, body);
				if (slug === "keep" && interruptTransfer) { interruptTransfer = false; throw new Error("interrupted transfer"); }
			} },
		};
		const first = beginRefinement(context, "root", "first");
		f.tracker.update("baseline", { "claimed-by": first.claim }); // Baseline is never creation authority.
		for (const slug of ["keep", "pruned", "foreign"]) f.create(slug, { "part-of": "root", "claimed-by": first.claim });
		f.tracker.remove("pruned");
		f.tracker.update("foreign", { "claimed-by": "session:foreign" });
		await expect(replaceRefinement(context, "first", "second", true)).rejects.toThrow("interrupted transfer");
		context.state = f.restore();
		await recoverRefinements(context);
		expect(f.tracker.fields("keep")["claimed-by"]).toBe("reconcile:root/second");
		expect(context.state.refinements.first.phase).toBe("removed");
		expect(context.state.refinements.second.phase).toBe("writing");
		expect(f.tracker.snapshot().has("pruned")).toBe(false);
		const third = await replaceRefinement(context, "second", "third", false);
		expect(stops).toContain("second");
		expect(f.tracker.snapshot().has("keep")).toBe(false);
		expect(third.baseline).not.toContain("keep");
		expect(f.tracker.fields("baseline")["claimed-by"]).toBe(first.claim);
		expect(f.tracker.fields("foreign")["claimed-by"]).toBe("session:foreign");
		expect(f.tracker.snapshot().has("pruned")).toBe(false);
	} finally { f.close(); }
}, 30_000);

// Two tracker/Git recovery cuts, not a timing property: shared worker hosts
// can spend over 30s in these subprocess round-trips.
test("landed refinement stubs forbid discard or replacement before claim conversion; recovery needs no source checkout", async () => {
	// Cover both the durable landed receipt and merge-before-that-save ancestry.
	for (const interruption of ["conversion", "landing-save"] as const) {
		const f = protocolFixture();
		try {
			let interrupt = true, stops = 0;
			const context: RefinementContext = {
				state: f.state, locked: async work => work(),
				stopWriter: async () => { stops++; },
				save: () => {
					if (interruption === "landing-save" && interrupt && context.state.refinements.writer?.acceptance?.landedHead) {
						interrupt = false; throw new Error("interrupted acceptance");
					}
					f.save(context.state);
				},
				tracker: { ...f.tracker, update(slug, fields, body) {
					if (interruption === "conversion" && interrupt && fields["claimed-by"] === "reconcile:root") {
						interrupt = false; throw new Error("interrupted acceptance");
					}
					f.tracker.update(slug, fields, body);
				} },
			};
			const attempt = beginRefinement(context, "root", "writer"), worker = await f.worker("writer");
			const preparedHead = f.commit(worker.path, "stub.ts", "export interface Stub {}\n");
			f.create("part", { "part-of": "root", "claimed-by": attempt.claim });
			f.tracker.update("root", { stage: null });
			await expect(acceptRefinement(context, "writer", { worker, children: ["part"], into: "root",
				destination: f.collector, reportTs: "2026-10-12T00:00:00.000Z", report: "done: stubs" }))
				.rejects.toThrow("interrupted acceptance");
			context.state = f.restore();
			const saved = context.state.refinements.writer.acceptance!;
			expect(saved.report).toBe("done: stubs");
			expect(saved.preparedHead).toBe(preparedHead);
			expect(!!saved.landedHead).toBe(interruption === "conversion");
			const collectorHead = f.git(f.collector, "rev-parse", "HEAD");
			expect(collectorHead).toBe(preparedHead);
			expect(f.tracker.fields("part")["claimed-by"]).toBe(attempt.claim);
			await expect(discardRefinement(context, "writer")).rejects.toThrow("Recover refinement claim conversion");
			for (const adoption of [false, true])
				await expect(replaceRefinement(context, "writer", "replacement", adoption)).rejects.toThrow("Recover refinement claim conversion");
			expect(stops).toBe(0);
			expect(context.state.refinements.replacement).toBeUndefined();
			expect(f.tracker.snapshot().has("part")).toBe(true);
			f.git(f.cwd, "worktree", "remove", "--force", worker.path);
			context.state = f.restore();
			await recoverRefinements(context);
			expect(f.git(f.collector, "rev-parse", "HEAD")).toBe(collectorHead);
			expect(f.tracker.fields("part")["claimed-by"]).toBe("reconcile:root");
			expect(f.restore().refinements.writer.phase).toBe("accepted");
			expect(f.tracker.snapshot().get("part")?.done).toBe(false);
			expect(context.state.landed).toEqual({});
		} finally { f.close(); }
	}
}, 120_000);
