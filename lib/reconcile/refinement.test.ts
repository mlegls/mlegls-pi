import { expect, test } from "bun:test";
import { acceptRefinement, beginRefinement, recoverRefinements, type RefinementContext } from "./refinement";
import { protocolFixture } from "./protocol-fixture";

test("saved acceptance recovers from collector ancestry or a published create without the source checkout", async () => {
	for (const cut of ["landing-save", "creation-save"]) {
		const f = protocolFixture();
		try {
			let interrupt = true;
			const context: RefinementContext = {
				state: f.state, locked: async work => work(), tracker: f.tracker,
				save: () => {
					const receipt = context.state.refinements.writer?.acceptance;
					if (interrupt && (cut === "landing-save" ? receipt?.landedHead : receipt?.created?.part)) {
						interrupt = false; throw new Error("interrupted acceptance");
					}
					f.save(context.state);
				},
			};
			beginRefinement(context, "root", "writer");
			const worker = f.worker("writer");
			const head = f.commit(worker.path, "stub.ts", "export interface Stub {}\n");
			f.commit(worker.path, ".reconcile/proposal/children/part.md", "---\nstage: ready\npart-of: root\nassignee: agent\n---\nImplement the interface.\n");
			const input = { worker, into: "root", destination: f.collector, reportTs: "2026-11-23", report: "done" };
			await expect(acceptRefinement(context, "writer", { ...input, children: [] })).rejects.toThrow("report");
			expect(f.restore().refinements.writer.phase).toBe("writing");
			expect(f.tracker.snapshot().has("part")).toBe(false);
			await expect(acceptRefinement(context, "writer", { ...input, children: ["part"] })).rejects.toThrow("interrupted acceptance");
			context.state = f.restore();
			expect(context.state.refinements.writer.acceptance!.preparedHead).toBe(head);
			expect(!!context.state.refinements.writer.acceptance!.landedHead).toBe(cut === "creation-save");
			f.git(f.cwd, "worktree", "remove", "--force", worker.path);
			await recoverRefinements(context);
			expect(f.git(f.collector, "rev-parse", "HEAD")).toBe(head);
			expect(f.tracker.fields("part")["claimed-by"]).toBe("reconcile:root");
			expect(f.restore().refinements.writer.phase).toBe("accepted");
			expect(f.restore().refinements.writer.acceptance!.created).toEqual({ part: "part" });
		} finally { f.close(); }
	}
}, 120_000);
