// Replay a lost createIssue response through the refinement engine and GitHub adapter together.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { configureGithub, saveRun } from "../../../lib/fixtures/github-acceptance";
import { installFakeGh, issue, newState } from "../../../lib/fixtures/fake-github";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { acceptRefinement, beginRefinement, recoverRefinements } from "../../../lib/reconcile/refinement";
import type { GlobalRunState } from "../../../lib/reconcile/tracker-state";
import { getGithubTracker } from "../../../lib/tracker-github";

const f = protocolFixture(), root = "gh-1", claim = "reconcile:" + root;
try {
	configureGithub(f.cwd);
	const remote = newState([issue(1)]);
	remote.faults.lose = ["createIssue"];
	const fake = installFakeGh(join(f.root, "gh-bin"), remote);
	const worker = f.worker("refiner"), base = f.git(f.collector, "rev-parse", "HEAD");
	const propose = (alias: string, extra = "") => f.commit(worker.path, ".reconcile/proposal/children/" + alias + ".md",
		"---\nstage: ready\nassignee: agent\npart-of: gh-1\n" + extra + "---\nImplement " + alias + ".\n");
	propose("consumer", "blocked-by: [provider]\n");
	f.commit(worker.path, "stub.ts", "export interface Stub {}\n");
	propose("provider");

	const context = (state: GlobalRunState) => ({
		state, tracker: getGithubTracker(f.cwd, { run: root })!,
		save: () => saveRun(f.cwd, root, state.refinements), locked: <T>(fn: () => Promise<T>) => fn(),
	});
	const ctx = context({ ...f.state, root });
	beginRefinement(ctx, root, worker.handle);
	assert.deepEqual([...ctx.tracker.snapshot().keys()], [root]);
	await assert.rejects(acceptRefinement(ctx, worker.handle, {
		worker, children: ["consumer", "provider"], reportTs: "fixture", report: "done", into: root, destination: f.collector,
	}));
	assert.equal(fake.calls("createIssue").length, 1);
	const restarted = context(JSON.parse(readFileSync(join(f.cwd, ".git/reconcile", root + ".json"), "utf8")));
	assert.deepEqual(restarted.state.refinements.refiner.acceptance?.created, {});
	await recoverRefinements(restarted);
	assert.equal(restarted.state.refinements.refiner.phase, "accepted");
	assert.deepEqual(restarted.state.refinements.refiner.acceptance?.created, { provider: "gh-2", consumer: "gh-3" });
	assert.equal(fake.calls("createIssue").length, 2);
	assert.deepEqual(restarted.tracker.fields("gh-3")["blocked-by"], ["gh-2"]);
	for (const slug of ["gh-2", "gh-3"]) assert.equal(restarted.tracker.fields(slug)["claimed-by"], claim);
	assert.equal(f.git(f.collector, "log", "--format=%s", base + "..HEAD"), "stub.ts");
	assert.equal(f.git(f.collector, "show", "HEAD:stub.ts"), "export interface Stub {}");
	assert.equal(f.git(f.collector, "log", "--format=%H", "--", ".reconcile/proposal"), "");
	console.log("Lost createIssue response; restarted from disk: provider gh-2, consumer gh-3 blocked by gh-2, two creates, only stub.ts landed.");
} finally { f.close(); }
