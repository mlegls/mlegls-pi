import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeAtTarget, finishLandingCleanup, landReviewed, recoverLandings, reviewedResult, type CompletionContext } from "./completion";
import { protocolFixture } from "./protocol-fixture";

test("foreign handoff commits hold closing until the configured loaded checkout contains them", async () => {
	const f = protocolFixture();
	try {
		f.create("foreign");
		const loaded = join(f.root, "loaded"), implementation = join(f.root, "implementation");
		f.git(f.cwd, "clone", "-q", f.cwd, loaded);
		f.git(loaded, "config", "user.name", "Fixture");
		f.git(loaded, "config", "user.email", "fixture@example.invalid");
		f.git(loaded, "worktree", "add", "-qb", "implementation", implementation);
		const commit = f.commit(implementation, "foreign.txt", "foreign implementation\n");
		const agent = process.env.PI_CODING_AGENT_DIR!;
		mkdirSync(agent, { recursive: true });
		// Resolve a relative object-form source exactly as pi does. The worker's
		// branch has the object, but the source's HEAD still lacks it.
		writeFileSync(join(agent, "settings.json"), JSON.stringify({ packages: [{ source: "../loaded" }] }));
		const context: CompletionContext = {
			state: f.state, tracker: f.tracker, pathOf: into => into,
			locked: async work => work(), save: () => f.save(context.state),
		};
		const worker = await f.worker("foreign-record", f.cwd, "main");
		const record = f.commit(worker.path, "record.md", "Foreign review record.\n");
		expect((await landReviewed(context, { slug: "foreign", into: f.cwd, worker, workers: [worker],
			result: reviewedResult(null, { commit: record, summary: "Foreign implementation reviewed" }, "done\n\ncommit: " + record + " # foreign fix " + commit),
			tests: [] })).ok).toBe(true);
		expect(() => closeAtTarget(context)).toThrow("not installed in loaded checkout " + loaded);
		expect(f.tracker.fields("foreign").stage).toBe("ticket");
		expect(context.state.results.foreign.closedAt).toBeUndefined();

		// Runtime's exception callback holds without throwing and is retried on
		// the next completion pass, including after a saved-state restart.
		let held = "";
		context.holdForeignCommit = (_slug, text) => { held = text; };
		closeAtTarget(context);
		expect(held).toContain(commit);
		context.state = f.restore();
		f.git(loaded, "merge", "-q", "--ff-only", commit);
		closeAtTarget(context);
		expect(f.tracker.fields("foreign").stage).toBe("done");
		expect(context.state.results.foreign.closedAt).toBeTruthy();
	} finally { f.close(); }
}, 30_000);

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
		f.commit(leaf.path, "docs/attachments/leaf.md", "Leaf evidence.\n");
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
test("a close holds on a cited packet that exists only on a drive branch, names it, and closes once the target has it; unrelated stale links never block", async () => {
	const f = protocolFixture();
	try {
		const body = (name: string) => name + " contract\n\nPacket: [index](../attachments/" + name + "/index.md)\n";
		f.tracker.create({ slug: "held", fields: { stage: "ticket", assignee: "agent", author: "user:fixture" }, body: body("held") });
		f.tracker.create({ slug: "stale", fields: { stage: "ticket", assignee: "agent", author: "user:fixture" }, body: body("stale") });
		const base = f.git(f.cwd, "rev-parse", "HEAD");
		const context: CompletionContext = {
			state: f.state, tracker: f.tracker, pathOf: into => into === "root" ? f.collector : into,
			locked: async work => work(), save: () => f.save(context.state),
		};
		// The packet was committed on a drive branch that never lands; the implement branch lands.
		const drive = await f.worker("held-drive", f.cwd, "main");
		const packetCommit = f.commit(drive.path, "docs/attachments/held/index.md", "Held evidence.\n");
		context.state.evidenceScopes = {
			held: { body: [], base, branches: [drive.handle] },
			// Stale link predates the node's run and no branch of the node adds it.
			stale: { body: ["docs/attachments/stale/index.md"], base, branches: [] },
		};
		for (const slug of ["held", "stale"]) {
			const worker = await f.worker(slug + "-impl", f.cwd, "main");
			f.commit(worker.path, slug + ".txt", slug + " code\n");
			expect((await landReviewed(context, { slug, into: f.cwd, worker, workers: [worker],
				result: reviewedResult(null, { summary: slug + " summary" }, slug + " report"), tests: [] })).ok).toBe(true);
		}
		const held: string[] = [];
		context.holdEvidence = (slug, text) => { held.push(slug); expect(text).toContain("docs/attachments/held/index.md"); expect(text).toContain(packetCommit); };
		closeAtTarget(context);
		expect(held).toEqual(["held"]);
		expect(f.tracker.fields("held").stage).toBe("ticket");
		expect(context.state.results.held.closedAt).toBeUndefined();
		expect(f.tracker.fields("stale").stage).toBe("done");
		expect(context.state.results.stale.closedAt).toBeTruthy();

		f.git(f.cwd, "merge", "-q", "--no-edit", drive.handle);
		held.length = 0;
		closeAtTarget(context);
		expect(held).toEqual([]);
		expect(f.tracker.fields("held").stage).toBe("done");
		expect(context.state.results.held.closedAt).toBeTruthy();
	} finally { f.close(); }
}, 30_000);
