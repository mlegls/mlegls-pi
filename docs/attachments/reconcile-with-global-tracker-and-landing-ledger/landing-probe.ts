// Disposable protocol rehearsal, not a scheduler or a retained test. No model calls.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { retire, type Handle } from "../../../lib/dispatch.ts";
import { getTracker, type Tracker } from "../../../lib/tracker.ts";
import { saveThread } from "../../../lib/thread/registry.ts";
import { excludeTracker } from "../../../lib/thread/tracker-worktree.ts";
import { closeAtTarget, finishLandingCleanup, landReviewed, recoverLandings, reviewedResult, type CompletionContext } from "../../../lib/reconcile/completion.ts";
import type { GlobalRunState } from "../../../lib/reconcile/tracker-state.ts";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));

export async function landingProbe() {
	const root = realpathSync(mkdtempSync("/tmp/rc-ledger-")), repo = join(root, "repo"), collector = join(root, "collector");
	const savedEnv = { ...process.env }, handles: Handle[] = [], observations: Record<string, unknown> = {};
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const put = (cwd: string, path: string, text: string) => { mkdirSync(join(cwd, path, ".."), { recursive: true }); writeFileSync(join(cwd, path), text); };
	const commit = (cwd: string, subject: string) => { git(cwd, "add", "."); git(cwd, "commit", "-qm", subject); };
	const head = (cwd: string) => git(cwd, "rev-parse", "HEAD");
	const orderFile = join(root, "order");
	const order = () => existsSync(orderFile) ? readFileSync(orderFile, "utf8").trim().split("\n").filter(Boolean) : [];
	const resetOrder = () => writeFileSync(orderFile, "");
	let sequence = 0;
	try {
		for (const key of Object.keys(process.env))
			if (/^(?:PI_.*|BB_.*|AB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, {
			XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"), PI_BOARD_DIR: join(root, "board"),
			PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"), ZMX_DIR: join(root, "zmx"),
			AB_THREAD_BACKEND: "zmx", SHELL: "/bin/sh", MISE_TRUSTED_CONFIG_PATHS: root,
			TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
		});
		mkdirSync(join(repo, "docs/issues"), { recursive: true });
		mkdirSync(join(root, "agents/roles"), { recursive: true });
		put(root, "agents/roles/review.md", "Offline registered worker fixture; no agent launch.\n");
		git(repo, "init", "-qb", "main");
		git(repo, "config", "user.name", "Landing probe"); git(repo, "config", "user.email", "probe@example.invalid");
		git(repo, "config", "commit.gpgSign", "false");
		put(repo, "code.txt", "base\n"); put(repo, "bun.lock", "base lock\n");
		put(repo, "retained.sh", "echo test >> " + orderFile + "\n");
		put(repo, "mise.toml", '[tasks.deps]\nrun = "echo deps >> ' + orderFile + '"\n'
			+ '[tasks.pre-integrate]\nrun = "echo gate >> ' + orderFile + '; test ! -f fail-gate"\n');
		commit(repo, "seed");
		const tracker = getTracker(repo, { inflight: false });
		for (const [slug, fields] of [
			["root", { stage: "spec" }], ["leaf", { stage: "ticket", "part-of": "root" }],
			["outside", { stage: "ticket", "blocked-by": ["leaf"] }], ["recovery", { stage: "ticket" }],
			["gate-failure", { stage: "ticket" }], ["packet-failure", { stage: "ticket" }],
			["conflict", { stage: "ticket" }], ["refusal", { stage: "ticket" }],
		] as const) tracker.create({ slug, fields: { ...fields, author: "user:landing-probe", assignee: "agent" }, body: "Disposable landing probe.\n" });
		git(repo, "worktree", "add", "--no-checkout", "-qb", "tree-root", collector);
		excludeTracker(collector);
		const collectorReceipt = { path: collector, branch: "tree-root", parentBranch: "main" };
		const worker = async (name: string, from: string, parentBranch: string, files: Record<string, string>) => {
			const path = join(root, name);
			git(repo, "worktree", "add", "--no-checkout", "-qb", name, path, head(from));
			excludeTracker(path);
			git(repo, "config", "branch." + name + ".ab-parent", parentBranch);
			for (const [file, text] of Object.entries(files)) put(path, file, text);
			commit(path, name + " change");
			const id = "landing-" + name;
			await saveThread({ id, sessionId: id, sessionFile: join(root, id + ".jsonl"), cwd: path, project: repo,
				worktree: path, ownership: "owner", branch: name, archived: false, created: new Date().toISOString(),
				worker: { run: "landing-probe", handle: name } });
			const handle = { run: "landing-probe", handle: name, path, threadId: id };
			handles.push(handle);
			return handle;
		};
		const packetPath = (name: string) => "docs/attachments/probe/" + name + ".md";
		const result = (name: string, parent: string | null = null) => reviewedResult(parent, {
			summary: name + " accepted summary", evidence: { path: packetPath(name), visual: false, shots: [] },
			stories: [{ story: name, outcome: "held" }], tests: ["retained.sh"], extra: { accepted: true },
		}, "done\n" + name + " reviewed report");
		const stateFile = join(root, "run.json");
		let failSave: ((state: GlobalRunState) => boolean) | undefined;
		let held = false;
		const context: CompletionContext = {
			state: { root: "root", cwd: repo, landed: {}, results: {}, landingOps: {}, refinements: {} },
			tracker, pathOf: into => into === "root" ? collector : into,
			locked: async work => { assert.equal(held, false); held = true; try { return await work(); } finally { held = false; } },
			save: () => {
				if (failSave?.(context.state)) { failSave = undefined; throw new Error("deterministic persistence interruption"); }
				writeFileSync(stateFile + ".tmp", JSON.stringify(context.state));
				renameSync(stateFile + ".tmp", stateFile);
				sequence++;
			},
		};
		const restore = () => { context.state = JSON.parse(readFileSync(stateFile, "utf8")); };
		context.save();
		const leaf = await worker("leaf-worker", collector, "tree-root", { "leaf.txt": "leaf code\n", [packetPath("leaf")]: "Leaf evidence.\n" });
		put(collector, "bun.lock", "collector deps\n"); commit(collector, "Collector dependency update");
		const leafBefore = head(leaf.path);
		const leafLanding = await landReviewed(context, { slug: "leaf", into: "root", worker: leaf, workers: [leaf], result: result("leaf", "root"), tests: ["retained.sh"] });
		assert.equal(leafLanding.ok, true);
		assert.deepEqual(order(), ["deps", "gate", "test"]);
		assert.notEqual(head(leaf.path), leafBefore);
		assert.equal(context.state.landingOps.leaf.preparedHead, head(leaf.path));
		assert.equal(context.state.landed.leaf.into, "root");
		assert.equal(tracker.snapshot().get("leaf")?.done, false);
		assert.equal(tracker.snapshot().get("outside")?.frontier, false);
		const closesBefore = head(repo); closeAtTarget(context); assert.equal(head(repo), closesBefore);
		observations.collector = { landing: leafLanding, ledger: structuredClone(context.state.landed), result: structuredClone(context.state.results.leaf),
			canonicalStage: tracker.fields("leaf").stage, outsideFrontier: false, order: order() };
		// Retire/remove the chain now; the saved receipts and leaf result survive.
		await retire(leaf, { cwd: collector }); finishLandingCleanup(context, "leaf");
		assert.ok(context.state.landingOps.leaf.cleanupDone);
		restore();
		const joinWorker = await worker("root-worker", collector, "main", { "root.txt": "root code\n", [packetPath("root")]: "Root join evidence.\n" });
		put(repo, "go.mod", "owner deps\n"); commit(repo, "Owner dependency update");
		// A foreign landing context must not be swept up by graph ancestry.
		context.state.landed.foreign = { into: "other-collector", head: head(repo), at: new Date().toISOString() };
		context.state.results.foreign = reviewedResult("root", {}, "foreign reviewed report");
		context.save(); resetOrder();
		const targetLanding = await landReviewed(context, { slug: "root", into: repo, worker: joinWorker, workers: [joinWorker],
			collector: collectorReceipt, result: result("root"), tests: ["retained.sh"] });
		assert.equal(targetLanding.ok, true, JSON.stringify(targetLanding));
		assert.deepEqual(context.state.landingOps.root.carried, ["leaf"]);
		assert.equal(context.state.landed.leaf.into, repo);
		assert.equal(context.state.landed.leaf.head, context.state.landed.root.head);
		assert.equal(context.state.landed.foreign.into, "other-collector");
		assert.equal(context.state.results.leaf.evidence, packetPath("leaf"));
		assert.equal(context.state.results.root.evidence, packetPath("root"));
		const targetCodeHead = head(repo), calls: string[] = [];
		let throwAfterClose = true;
		const interrupted: Tracker = { ...tracker, close: (slug, accepted) => {
			calls.push(slug); tracker.close(slug, accepted);
			if (throwAfterClose) { throwAfterClose = false; throw new Error("interrupted after real tracker close"); }
		} };
		context.tracker = interrupted;
		assert.throws(() => closeAtTarget(context), /interrupted after real tracker close/);
		assert.equal(tracker.snapshot().get("leaf")?.done, true);
		assert.equal(context.state.results.leaf.closedAt, undefined);
		assert.equal(tracker.snapshot().get("root")?.done, false);
		restore();
		// A save failure *after* close returned must also replay the exact done row.
		failSave = state => !!state.results.leaf.closedAt;
		assert.throws(() => closeAtTarget(context), /persistence interruption/);
		assert.equal(context.state.results.leaf.closedAt, undefined);
		restore(); closeAtTarget(context);
		assert.deepEqual(calls, ["leaf", "leaf", "leaf", "root"]);
		assert.ok(context.state.results.leaf.closedAt); assert.ok(context.state.results.root.closedAt);
		assert.equal(tracker.snapshot().get("outside")?.frontier, true);
		assert.ok(tracker.text("leaf").includes("leaf accepted summary"));
		assert.ok(!tracker.text("leaf").includes("root accepted summary"));
		// Already ledger-landed means no source checkout inspection or result replacement.
		const replay = await landReviewed(context, { slug: "root", into: repo, worker: { ...joinWorker, path: join(root, "missing") },
			workers: [], result: reviewedResult(null, {}, "must not replace"), tests: [] });
		assert.equal(replay.ok && replay.replayed, true);
		assert.equal(context.state.results.root.summary, "root accepted summary");
		observations.target = { codeHead: targetCodeHead, trackerHead: head(repo), ledger: structuredClone(context.state.landed),
			results: structuredClone(context.state.results), operation: structuredClone(context.state.landingOps.root), closeCalls: calls, order: order(), replay };
		await retire(joinWorker, { cwd: repo });
		git(repo, "worktree", "remove", "--force", collector); git(repo, "branch", "-D", "tree-root");
		// Even after chain/collector removal, cleanup is an explicit persisted confirmation.
		restore(); assert.equal(context.state.landingOps.root.cleanupDone, undefined);
		finishLandingCleanup(context, "root");

		context.tracker = tracker;
		const recovery = await worker("recovery-worker", repo, "main", { "recovery.txt": "recover code\n", [packetPath("recovery")]: "Recovery evidence.\n" });
		resetOrder();
		const beforePrepareRefusal = head(repo);
		failSave = state => !!state.landingOps.recovery?.preparedHead;
		const prepareRefusal = await landReviewed(context, { slug: "recovery", into: repo, worker: recovery, workers: [recovery],
			result: result("recovery"), tests: [] });
		assert.equal(prepareRefusal.ok, false);
		assert.equal(head(repo), beforePrepareRefusal);
		assert.equal(context.state.landingOps.recovery.preparedHead, undefined);
		assert.equal(context.state.landed.recovery, undefined);
		restore();
		await context.locked(async () => recoverLandings(context));
		assert.equal(context.state.landed.recovery, undefined);
		const prepareRefusalOrder = order();
		resetOrder();
		failSave = state => !!state.landed.recovery;
		let persistenceThrew = false;
		try { await landReviewed(context, { slug: "recovery", into: repo, worker: recovery, workers: [recovery], result: result("recovery"), tests: [] }); }
		catch (error) { assert.match(String(error), /persistence interruption/); persistenceThrew = true; }
		assert.ok(persistenceThrew);
		assert.equal(context.state.landed.recovery, undefined);
		const mergedHead = head(repo), savedPrepared = context.state.landingOps.recovery.preparedHead;
		assert.equal(savedPrepared, mergedHead);
		restore();
		await context.locked(async () => recoverLandings(context));
		assert.equal(head(repo), mergedHead);
		assert.equal(context.state.landed.recovery.head, mergedHead);
		const recoveryReplay = await landReviewed(context, { slug: "recovery", into: repo, worker: recovery, workers: [],
			result: reviewedResult(null, {}, "ignored replacement"), tests: [] });
		assert.equal(recoveryReplay.ok && recoveryReplay.replayed, true);
		closeAtTarget(context); await retire(recovery, { cwd: repo }); finishLandingCleanup(context, "recovery");
		observations.recovery = { prepareRefusal, beforePrepareRefusal, prepareRefusalOrder, savedPrepared, mergedHead, recoveredHead: context.state.landed.recovery.head, recoveryReplay, order: order() };

		for (const mode of ["gate-failure", "packet-failure", "conflict", "refusal"] as const) {
			const files: Record<string, string> = { [packetPath(mode)]: "Failure probe evidence.\n" };
			if (mode === "gate-failure") files["fail-gate"] = "fail\n";
			if (mode === "conflict") files["code.txt"] = "worker conflict\n";
			else files[mode + ".txt"] = "worker code\n";
			const handle = await worker(mode + "-worker", repo, "main", files);
			if (mode === "conflict") { put(repo, "code.txt", "target conflict\n"); commit(repo, "Target conflict subject"); }
			if (mode === "refusal") {
				// Bypass sparse absence to author a forbidden issue-branch mutation.
				git(handle.path, "sparse-checkout", "disable");
				put(handle.path, "docs/issues/branch-only.md", "---\nstage: ticket\n---\nForbidden branch tracker append.\n");
				commit(handle.path, "Forbidden tracker append");
			}
			const destinationBefore = head(repo), workerBefore = head(handle.path), ledgerBefore = JSON.stringify(context.state.landed);
			resetOrder();
			const accepted = result(mode);
			if (mode === "packet-failure") {
				accepted.handoff.evidence = { path: packetPath("missing"), visual: false, shots: [] };
				accepted.evidence = packetPath("missing");
			}
			const outcome = await landReviewed(context, { slug: mode, into: repo, worker: handle, workers: [handle], result: accepted, tests: ["retained.sh"] });
			assert.equal(outcome.ok, false);
			assert.equal(head(repo), destinationBefore); assert.equal(head(handle.path), workerBefore);
			assert.equal(JSON.stringify(context.state.landed), ledgerBefore);
			assert.equal(context.state.results[mode], undefined);
			assert.equal(tracker.snapshot().get(mode)?.done, false);
			if (outcome.ok) throw new Error("expected refusal");
			if (mode === "conflict") { assert.match(outcome.failure, /code.txt/); assert.match(outcome.failure, /Target conflict subject/); assert.deepEqual(order(), []); }
			if (mode === "refusal") { assert.match(outcome.failure, /Forbidden tracker changes/); assert.deepEqual(order(), []); }
			if (mode === "gate-failure") assert.deepEqual(order(), ["gate"]);
			if (mode === "packet-failure") { assert.match(outcome.failure, /Missing or external evidence/); assert.deepEqual(order(), ["gate", "test"]); }
			await context.locked(async () => recoverLandings(context));
			assert.equal(context.state.landed[mode], undefined);
			observations[mode] = { outcome, destinationBefore, destinationAfter: head(repo), workerBefore, workerAfter: head(handle.path), order: order(), canonicalStage: tracker.fields(mode).stage };
		}
		assert.equal(reviewedResult(null, { summary: " " }, "review fallback").summary, "review fallback");
		observations.audit = { saves: sequence, cleanup: Object.fromEntries(Object.entries(context.state.landingOps).map(([slug, op]) => [slug, !!op.cleanupDone])),
			resultLocators: Object.fromEntries(Object.entries(context.state.results).map(([slug, accepted]) => [slug, accepted.evidence ?? null])) };
		return observations;
	} finally {
		// No worker processes were launched; remove only this fixture's registered worktrees.
		for (const handle of handles) if (existsSync(handle.path)) {
			git(repo, "worktree", "remove", "--force", handle.path);
			git(repo, "branch", "-D", handle.handle);
		}
		if (existsSync(collector)) { git(repo, "worktree", "remove", "--force", collector); git(repo, "branch", "-D", "tree-root"); }
		process.env = savedEnv;
		rmSync(root, { recursive: true, force: true });
	}
}

if (import.meta.main) console.log("RESULT " + JSON.stringify(await landingProbe(), null, 2));
