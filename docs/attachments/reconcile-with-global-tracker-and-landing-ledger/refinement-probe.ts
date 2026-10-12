// Disposable first-use machinery: real Tracker, registered fixture workers and
// actual stop/integrate. No model, browser, retained test or live scheduler.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stop, type Handle } from "../../../lib/dispatch.ts";
import { getTracker, type Tracker } from "../../../lib/tracker.ts";
import { saveThread } from "../../../lib/thread/registry.ts";
import { excludeTracker } from "../../../lib/thread/tracker-worktree.ts";
import {
	acceptRefinement, beginRefinement, discardRefinement, observeRefinements,
	recoverRefinements, releaseRefinementClaims, replaceRefinement,
	type RefinementContext,
} from "../../../lib/reconcile/refinement.ts";
import type { GlobalRunState } from "../../../lib/reconcile/tracker-state.ts";

export async function refinementProbe() {
	const savedEnv = { ...process.env };
	const root = realpathSync(mkdtempSync("/tmp/refinement-probe-"));
	const cwd = join(root, "repo"), destination = join(root, "collector"), stateFile = join(root, "run.json");
	const git = (path: string, ...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const commit = (path: string, message: string) => { git(path, "add", "."); git(path, "commit", "-qm", message); };
	const require = (value: unknown, message: string) => { if (!value) throw new Error(message); };
	const expectFailure = async (work: () => unknown | Promise<unknown>, pattern: string) => {
		try { await work(); } catch (error) {
			require(String(error).includes(pattern), "Unexpected failure: " + String(error));
			return String(error);
		}
		throw new Error("Expected failure: " + pattern);
	};
	const observations: Record<string, unknown> = {};
	try {
		for (const key of Object.keys(process.env))
			if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|PI_CODING_AGENT_DIR|AB_.*|BB_.*|ZMX_.*|TMUX.*|TRACKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, {
			XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
			PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
			AB_THREAD_RUNTIME: "zmx", MISE_TRUSTED_CONFIG_PATHS: root,
			TRACKER_CLI: resolve(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
			PI_AGENT_PROMPTS_DIR: resolve(import.meta.dir, "../../../agent-prompts"),
			TRACKER_VAULT: join(root, "vault"),
		});
		mkdirSync(join(cwd, "docs/issues"), { recursive: true });
		git(cwd, "init", "-qb", "main");
		git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
		writeFileSync(join(cwd, "code.txt"), "fixture\n");
		commit(cwd, "Seed code");
		const actual = getTracker(cwd, { inflight: false });
		const create = (slug: string, parent?: string, claim?: string, extra: Record<string, unknown> = {}) =>
			actual.create({ slug, fields: { stage: "spec", assignee: "agent", author: "user:fixture",
				...(parent && { "part-of": parent }), ...(claim && { "claimed-by": claim }), ...extra }, body: "Fixture contract: " + slug + "\n" });
		create("fixture");
		for (const slug of ["cleanup", "protected", "replace", "adopt", "decompose", "promote", "refusal"]) create(slug, "fixture");
		create("baseline", "protected", undefined, { stage: "ticket" });
		create("friction", undefined, undefined, { stage: "idea" });
		git(cwd, "worktree", "add", "-qb", "collector", "--no-checkout", destination);
		excludeTracker(destination);

		const workers = new Map<string, Handle>();
		const register = async (handle: string, stub = true, trackerEdit = false) => {
			const path = join(root, handle), branch = "worker-" + handle, id = "fixture-" + handle;
			git(cwd, "worktree", "add", "-qb", branch, "--no-checkout", path, "collector");
			excludeTracker(path);
			git(cwd, "config", "branch." + branch + ".ab-parent", "main");
			if (stub) {
				writeFileSync(join(path, handle + ".ts"), "export const stub = " + JSON.stringify(handle) + ";\n");
				commit(path, "Committed interface stub " + handle);
			}
			if (trackerEdit) {
				git(path, "sparse-checkout", "disable");
				writeFileSync(join(path, "docs/issues/refusal.md"), "---\nstage: ticket\nassignee: agent\n---\nForbidden branch contract\n");
				commit(path, "Forbidden tracker edit");
			}
			const worker: Handle = { handle, run: "refinement-fixture", path, threadId: id };
			await saveThread({ id, sessionId: id, sessionFile: join(root, id + ".jsonl"), cwd: path, project: cwd,
				worktree: path, ownership: "owner", branch, archived: false, created: new Date().toISOString(),
				worker: { handle, run: worker.run } });
			workers.set(handle, worker);
			return worker;
		};

		let state: GlobalRunState = { root: "fixture", cwd, landed: {}, results: {}, landingOps: {}, refinements: {} };
		let failSave: ((value: GlobalRunState) => boolean) | undefined;
		let failUpdate: string | undefined, failRemove: string | undefined, failStop: string | undefined;
		const writes: string[] = [], stops: string[] = [];
		const tracker: Tracker = {
			...actual,
			update(slug, fields, body) {
				actual.update(slug, fields, body); writes.push("update " + slug + " " + JSON.stringify(fields));
				if (failUpdate === slug) { failUpdate = undefined; throw new Error("Interrupted after tracker update " + slug); }
			},
			remove(slug) {
				actual.remove(slug); writes.push("remove " + slug);
				if (failRemove === slug) { failRemove = undefined; throw new Error("Interrupted after tracker removal " + slug); }
			},
		};
		const context: RefinementContext = {
			state, tracker,
			save() {
				if (failSave?.(context.state)) { failSave = undefined; throw new Error("Interrupted state save"); }
				writeFileSync(stateFile, JSON.stringify(context.state));
			},
			async stopWriter(attempt) {
				stops.push(attempt.handle);
				if (failStop === attempt.handle) { failStop = undefined; throw new Error("Exact writer stop failed"); }
				const worker = workers.get(attempt.handle);
				if (!worker) throw new Error("No registered fixture writer " + attempt.handle);
				await stop(worker, { cwd });
			},
			locked: async work => work(),
		};
		const reload = () => { state = JSON.parse(readFileSync(stateFile, "utf8")); context.state = state; };
		const rows = () => [...actual.snapshot().values()].map(row => ({ slug: row.slug, parent: row.partOf, stage: row.ownStage, claim: actual.fields(row.slug)["claimed-by"] ?? null }));
		const claim = (slug: string) => actual.fields(slug)["claimed-by"];
		const accepts = (worker: Handle, children: string[]) => ({
			worker, children, into: "collector", destination, reportTs: "2026-10-12T00:00:00.000Z", report: "done: committed fixture stubs",
		});

		// A create before observe/crash, dependent-first deletion, omitted-stage
		// provisional container and restoration of only the parent's residual.
		const cleanup = beginRefinement(context, "cleanup", "cleanup-first");
		await register(cleanup.handle, false);
		create("container", "cleanup", cleanup.claim);
		create("leaf", "container", cleanup.claim, { stage: "ticket" });
		create("dependent", "container", cleanup.claim, { stage: "ticket", "blocked-by": ["leaf"] });
		actual.update("container", { stage: null }); actual.update("cleanup", { stage: null, priority: 3 }, "Sharpened body survives cleanup\n");
		const beforeCleanup = rows().filter(row => ["cleanup", "container", "leaf", "dependent"].includes(row.slug));
		reload(); require(state.refinements[cleanup.handle]!.owned.length === 0, "Create was already observed");
		failRemove = "dependent";
		await expectFailure(() => discardRefinement(context, cleanup.handle), "Interrupted after tracker removal");
		reload(); await recoverRefinements(context);
		require(!actual.snapshot().has("container") && !actual.snapshot().has("leaf") && !actual.snapshot().has("dependent"), "Cleanup left owned children");
		require(actual.fields("cleanup").stage === "spec" && actual.fields("cleanup").priority === 3 && actual.text("cleanup").includes("Sharpened body"), "Cleanup rolled back fields/body or omitted residual");
		observations.cleanup = { before: beforeCleanup, after: rows().filter(row => row.slug === "cleanup"), owned: state.refinements[cleanup.handle]!.owned, writes: [...writes] };

		// Saved baseline even with the exact token, changed ownership, unrelated
		// children/friction, and stop failure as a hard boundary before removal.
		const protectedAttempt = beginRefinement(context, "protected", "protected-first");
		await register(protectedAttempt.handle, false);
		actual.update("baseline", { "claimed-by": protectedAttempt.claim });
		create("unowned", "protected", undefined, { stage: "ticket" });
		create("changed-owner", "protected", protectedAttempt.claim, { stage: "ticket" });
		create("owned", "protected", protectedAttempt.claim, { stage: "ticket" });
		observeRefinements(context);
		actual.update("changed-owner", { "claimed-by": "session:foreign" });
		failStop = protectedAttempt.handle;
		const stoppedError = await expectFailure(() => discardRefinement(context, protectedAttempt.handle), "Exact writer stop failed");
		require(actual.snapshot().has("owned"), "Stop failure permitted removal");
		const afterFailedStop = rows().filter(row => ["baseline", "unowned", "changed-owner", "owned", "friction"].includes(row.slug));
		reload(); await recoverRefinements(context);
		require(!actual.snapshot().has("owned"), "Recovery did not remove owned child");
		for (const slug of ["baseline", "unowned", "changed-owner", "friction"]) require(actual.snapshot().has(slug), "Removed protected identity " + slug);
		observations.protection = { stoppedError, afterFailedStop, after: rows().filter(row => ["baseline", "unowned", "changed-owner", "friction"].includes(row.slug)) };

		const replace = beginRefinement(context, "replace", "replace-first");
		await register(replace.handle, false);
		create("discarded", "replace", replace.claim, { stage: "ticket" });
		actual.update("replace", { stage: null });
		const successor = await replaceRefinement(context, replace.handle, "replace-second", false);
		require(!actual.snapshot().has("discarded") && !successor.baseline.includes("discarded"), "Ordinary replacement retained child");
		observations.replacement = { old: state.refinements[replace.handle], successor };

		const adoptAttempt = beginRefinement(context, "adopt", "adopt-first");
		await register(adoptAttempt.handle, false);
		create("adopt-a", "adopt", adoptAttempt.claim, { stage: "ticket" });
		create("adopt-b", "adopt", adoptAttempt.claim, { stage: "ticket" });
		create("already-pruned", "adopt", adoptAttempt.claim, { stage: "ticket" }); actual.remove("already-pruned");
		failUpdate = "adopt-a";
		await expectFailure(() => replaceRefinement(context, adoptAttempt.handle, "adopt-second", true), "Interrupted after tracker update");
		reload();
		const midAdoption = rows().filter(row => ["adopt-a", "adopt-b"].includes(row.slug));
		require(state.refinements["adopt-second"]!.phase === "adopting", "Adoption released successor early");
		await recoverRefinements(context);
		require(claim("adopt-a") === "reconcile:fixture/adopt-second" && claim("adopt-b") === "reconcile:fixture/adopt-second", "Adoption lost exact claims");
		require(!actual.snapshot().has("already-pruned"), "Adoption recreated removed child");
		observations.adoption = { mid: midAdoption, after: rows().filter(row => ["adopt-a", "adopt-b"].includes(row.slug)), old: state.refinements[adoptAttempt.handle], successor: state.refinements["adopt-second"] };

		// Acceptance persists the report and prepared head, actual integrate
		// merges, then a deterministic save failure interrupts its receipt.
		create("existing-part", "decompose", undefined, { stage: "ticket" });
		const decomposition = beginRefinement(context, "decompose", "decompose-first");
		const decompositionWorker = await register(decomposition.handle);
		create("part-a", "decompose", decomposition.claim, { stage: "ticket" });
		create("part-b", "decompose", decomposition.claim, { stage: "spec", "blocked-by": ["part-a"] });
		actual.update("decompose", { stage: null });
		await expectFailure(() => acceptRefinement(context, decomposition.handle, accepts(decompositionWorker, ["part-a"])), "do not match");
		actual.update("part-b", { "claimed-by": "session:foreign" });
		await expectFailure(() => acceptRefinement(context, decomposition.handle, accepts(decompositionWorker, ["existing-part", "part-a", "part-b"])), "Foreign");
		actual.update("part-b", { "claimed-by": decomposition.claim });
		const stubBefore = git(decompositionWorker.path, "rev-parse", "HEAD"), collectorBefore = git(destination, "rev-parse", "HEAD");
		failSave = value => !!value.refinements[decomposition.handle]?.acceptance?.landedHead;
		await expectFailure(() => acceptRefinement(context, decomposition.handle, accepts(decompositionWorker, ["existing-part", "part-a", "part-b"])), "Interrupted state save");
		const collectorMerged = git(destination, "rev-parse", "HEAD");
		reload();
		require(state.refinements[decomposition.handle]!.phase === "accepting" && !state.refinements[decomposition.handle]!.acceptance!.landedHead, "Lost merge-before-save condition");
		const savedReceipt = structuredClone(state.refinements[decomposition.handle]!.acceptance);
		failUpdate = "part-a";
		await expectFailure(() => recoverRefinements(context), "Interrupted after tracker update");
		reload();
		const midConversion = rows().filter(row => ["existing-part", "part-a", "part-b"].includes(row.slug));
		require(claim("part-a") === "reconcile:fixture" && claim("part-b") === decomposition.claim, "Conversion interruption missed partial claim state");
		await expectFailure(() => discardRefinement(context, decomposition.handle), "Recover refinement claim conversion");
		failSave = value => value.refinements[decomposition.handle]?.phase === "accepted";
		await expectFailure(() => recoverRefinements(context), "Interrupted state save");
		reload();
		const beforeAcceptedSave = rows().filter(row => ["existing-part", "part-a", "part-b"].includes(row.slug));
		await recoverRefinements(context);
		require(git(destination, "rev-parse", "HEAD") === collectorMerged, "Recovery merged twice");
		require(state.refinements[decomposition.handle]!.phase === "accepted" && claim("part-a") === "reconcile:fixture" && claim("part-b") === "reconcile:fixture", "Acceptance did not save stable claims");
		require(claim("existing-part") === undefined, "Acceptance reserved a baseline child");
		require(Object.keys(state.landed).length === 0 && !actual.snapshot().get("decompose")!.done, "Stub acceptance closed tracker or wrote completion ledger");
		observations.acceptance = { collectorBefore, stubBefore, collectorMerged, savedReceipt, midConversion, beforeAcceptedSave, accepted: state.refinements[decomposition.handle], after: rows().filter(row => ["decompose", "existing-part", "part-a", "part-b"].includes(row.slug)) };

		const promotion = beginRefinement(context, "promote", "promote-first");
		const promotionWorker = await register(promotion.handle);
		await expectFailure(() => acceptRefinement(context, promotion.handle, accepts(promotionWorker, [])), "not a ticket promotion");
		actual.update("promote", { stage: "ticket" }, "One-session promoted contract\n");
		const promoted = await acceptRefinement(context, promotion.handle, accepts(promotionWorker, []));
		require(promoted.kind === "promoted" && git(cwd, "branch", "--show-current") === "main"
			&& readFileSync(join(destination, promotion.handle + ".ts"), "utf8").includes("stub"), "Promotion stubs missed collector");
		observations.promotion = { outcome: promoted, accepted: state.refinements[promotion.handle], ownerHasStub: (() => { try { git(cwd, "cat-file", "-e", "HEAD:" + promotion.handle + ".ts"); return true; } catch { return false; } })() };

		const refusal = beginRefinement(context, "refusal", "refusal-first");
		const forbiddenWorker = await register(refusal.handle, true, true);
		actual.update("refusal", { stage: "ticket" });
		create("refusal-child", "refusal", refusal.claim, { stage: "ticket" });
		const beforeRefusal = git(destination, "rev-parse", "HEAD");
		const refusalError = await expectFailure(() => acceptRefinement(context, refusal.handle, accepts(forbiddenWorker, ["refusal-child"])), "Forbidden tracker changes");
		require(git(destination, "rev-parse", "HEAD") === beforeRefusal, "Refused branch landed");
		await replaceRefinement(context, refusal.handle, "refusal-second", false);
		require(!actual.snapshot().has("refusal-child"), "Failed acceptance leaked provisional child");
		observations.refusal = { error: refusalError, replacement: state.refinements["refusal-second"] };

		actual.update("part-b", { "claimed-by": "session:foreign" });
		releaseRefinementClaims(context, "decompose");
		require(claim("part-a") === undefined && claim("part-b") === "session:foreign", "Move-out overwrote foreign claims");
		observations.moveOut = rows().filter(row => ["part-a", "part-b"].includes(row.slug));
		observations.stopHandles = stops;
		return observations;
	} finally {
		// Only this mkdtemp fixture owns these checkouts/registry records. No
		// launched process or daemon is left behind; the probe never starts one.
		process.env = savedEnv;
		rmSync(root, { recursive: true, force: true });
	}
}

if (import.meta.main) console.log("RESULT " + JSON.stringify(await refinementProbe(), null, 2));
