// Runnable, one-off first use. Host observations are seeded; Git, gates,
// shell worker launch/integration/retirement and tracker close are real.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Handle } from "../../../lib/dispatch.ts";
import type { Message } from "../../../lib/board/store.ts";
import type { PullRequestContext } from "../../../lib/reconcile/pull-request.ts";
import type { PullRequestHost, PullRequestSnapshot } from "../../../lib/reconcile/pr-types.ts";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
const root = realpathSync(mkdtempSync("/tmp/rc-pr-lifecycle-"));
const repo = join(root, "repo"), owner = join(root, "owner"), remote = join(root, "remote.git"), outsider = join(root, "contributor");
const bin = join(root, "bin"), agents = join(root, "agents"), gateLog = join(root, "gates"), hookLog = join(root, "hooks");
const saved = { ...process.env }, originalCwd = process.cwd();
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const head = (cwd: string) => git(cwd, "rev-parse", "HEAD");
const put = (cwd: string, file: string, body: string) => {
	mkdirSync(join(cwd, file, ".."), { recursive: true }); writeFileSync(join(cwd, file), body);
};
const commit = (cwd: string, file: string, body: string) => {
	put(cwd, file, body); git(cwd, "add", "--", file); git(cwd, "commit", "-qm", file); return head(cwd);
};
const packet = "docs/attachments/fixture/root.md";
const handoff = (summary: string) => ({ summary, stories: [{ story: "root code survives landing", outcome: "held" }],
	evidence: { path: packet, visual: false, shots: [] }, tests: [] });
const observations: Record<string, unknown> = { host: "seeded typed host, NOT live GitHub", target: root };
let stopRun: AbortController | undefined, running: Promise<void> | undefined;
let workers: Handle[] = [];
try {
	for (const key of Object.keys(process.env))
		if (/^(?:PI_.*|BB_.*|AB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
		PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: agents,
		ZMX_DIR: join(root, "zmx"), PI_THREAD_RUNTIME: "zmx", MISE_TRUSTED_CONFIG_PATHS: root,
		TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
		PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "2",
		WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'", PATH: bin + ":" + saved.PATH });
	for (const dir of [repo, bin, join(agents, "roles")]) mkdirSync(dir, { recursive: true });
	writeFileSync(join(bin, "pi"), "#!/bin/sh\ntouch shell-started\nexec sleep 600\n", { mode: 0o755 });
	for (const [name, role] of [["shell", "implement"], ["shell-drive", "drive"], ["tidy", "review"], ["technical", "implement"]]) {
		put(agents, name + ".md", "---\nrole: " + role + "\n---\nIsolated shell fixture.\n");
		put(agents, "roles/" + role + ".md", "Isolated shell fixture.\n");
	}
	const { run, load, saveState, prepareStart } = await import("../../../lib/reconcile/reconcile.ts");
	const { advancePullRequest } = await import("../../../lib/reconcile/pull-request.ts");
	const { dispatch, retire } = await import("../../../lib/dispatch.ts");
	const { getThread, allThreads, workerThread } = await import("../../../lib/thread/registry.ts");
	const { getTracker } = await import("../../../lib/tracker.ts");
	const { send, read } = await import("../../../lib/board/store.ts");
	const { isAncestor } = await import("../../../lib/reconcile/checks.ts");
	const { closeAtTarget } = await import("../../../lib/reconcile/completion.ts");
	git(repo, "init", "-qb", "tracker"); git(repo, "config", "user.name", "PR lifecycle fixture");
	git(repo, "config", "user.email", "fixture@example.invalid"); git(repo, "config", "commit.gpgSign", "false");
	writeFileSync(join(repo, ".git/hooks/pre-commit"), "#!/bin/sh\nprintf 'commit\\n' >> " + hookLog + "\n", { mode: 0o755 });
	writeFileSync(join(repo, ".git/hooks/pre-merge-commit"), "#!/bin/sh\nprintf 'merge\\n' >> " + hookLog + "\n", { mode: 0o755 });
	writeFileSync(join(repo, ".git/hooks/pre-push"), "#!/bin/sh\nprintf 'push ' >> " + hookLog +
		"\ngit rev-parse HEAD >> " + hookLog + "\n", { mode: 0o755 });
	commit(repo, ".gitignore", "shell-started\n");
	commit(repo, ".pi/reconcile.json", '{"land":"pr-review"}\n');
	commit(repo, ".github/PULL_REQUEST_TEMPLATE.md", "Repository template retained.\n");
	commit(repo, "ci.txt", "red\n");
	commit(repo, "conflict.txt", "base\n");
	commit(repo, "gate.sh", "#!/bin/sh\nprintf '%s ' \"$PWD\" >> " + gateLog +
		"\ngit rev-parse HEAD >> " + gateLog + "\ntest -f ci.txt\n");
	commit(repo, "mise.toml", '[tasks.setup]\nrun = "true"\n[tasks.pre-integrate]\nrun = "bash gate.sh"\n');
	mkdirSync(join(repo, "docs/issues"), { recursive: true });
	const tracker = getTracker(repo, { inflight: false });
	tracker.create({ slug: "root", fields: { stage: "ticket", assignee: "agent:shell", author: "user:fixture" }, body: "Root fixture contract." });
	git(repo, "worktree", "add", "-qb", "main", owner);
	git(repo, "init", "--bare", "-q", remote); git(repo, "remote", "add", "origin", remote); git(owner, "push", "-q", "origin", "main");
	const zeroPublication = process.argv[2] === "publication-zero";
	let identity: ReturnType<typeof prepareStart>["pr"], created = false, publicationCut = !zeroPublication, checksState = zeroPublication ? "empty" : "pending";
	let terminalState: PullRequestSnapshot["state"] = "OPEN", mergeCommit: string | undefined, mergeCalls = 0, creates = 0, finds = 0, observes = 0;
	let body = "", foreign: string | undefined, transportFailure = false, basePending = false;
	const snapshot = (): PullRequestSnapshot => ({
		number: 17, url: "https://example.invalid/seeded/lifecycle/pull/17", state: terminalState,
		headBranch: identity!.branch, head: git(repo, "rev-parse", "refs/remotes/origin/" + identity!.branch),
		baseBranch: "main", base: git(repo, "rev-parse", "refs/remotes/origin/main"), mergeable: "MERGEABLE",
		checks: checksState === "empty" ? [] : [{ id: "build:1", name: "build", state: checksState as "pass" | "pending" | "fail",
			url: "https://example.invalid/diagnostics/1", details: "seeded CI: ci.txt must be green" }],
		reviews: [], threads: [], ...(terminalState === "MERGED" ? { mergeCommit, mergedAt: "2026-10-14T00:00:00Z" } : {}),
	});
	const remoteSnapshot = () => {
		git(repo, "fetch", "-q", "origin", "+refs/heads/main:refs/remotes/origin/main");
		if (created) git(repo, "fetch", "-q", "origin", "+refs/heads/" + identity!.branch + ":refs/remotes/origin/" + identity!.branch);
		return snapshot();
	};
	const host: PullRequestHost = {
		project: () => ({ repository: "seeded/lifecycle", remote: "origin", baseBranch: "main" }),
		find: () => { finds++; return created ? remoteSnapshot() : undefined; },
		create: (_cwd, _repository, input) => {
			creates++; created = true; body = input.body;
			git(repo, "fetch", "-q", "origin", "+refs/heads/" + identity!.branch + ":refs/remotes/origin/" + identity!.branch);
			if (publicationCut) { publicationCut = false; throw new Error("seeded create-before-save cut"); }
			return remoteSnapshot();
		},
		observe: () => { observes++; if (transportFailure) throw new Error("seeded API unavailable"); return remoteSnapshot(); },
		checks: (_cwd, _repository, oid) => {
			assert.equal(oid, git(repo, "rev-parse", "refs/remotes/origin/main"));
			return basePending ? [{ id: "base-ci", name: "base", state: "pending" }] : [];
		},
		merge: (_cwd, _repository, _number, expected) => {
			mergeCalls++; assert.equal(expected, remoteSnapshot().head); assert(checksState === "pass" || checksState === "empty");
			git(outsider, "fetch", "-q", "origin");
			git(outsider, "checkout", "-q", "main"); git(outsider, "merge", "--ff-only", "origin/main");
			git(outsider, "merge", "--no-ff", "--no-edit", "origin/" + identity!.branch);
			mergeCommit = head(outsider); git(outsider, "push", "-q", "origin", "main"); terminalState = "MERGED";
		},
		reply: () => { throw new Error("review selector is dormant in this probe"); },
	};
	git(repo, "clone", "-q", remote, outsider);
	git(outsider, "checkout", "-qb", "main", "origin/main");
	git(outsider, "config", "user.name", "Contributor"); git(outsider, "config", "user.email", "contributor@example.invalid");
	journey: {
	const options = { cwd: owner, root: "root", owner: "mail/fixture", budget: 1, prHost: host,
		...(zeroPublication ? { land: "pr-merge" as const } : {}) };
	identity = prepareStart(options).pr!;
	stopRun = new AbortController(); running = run({ ...options, signal: stopRun.signal });
	const until = async <T>(fn: () => T | false | undefined): Promise<T> => {
		for (let n = 0; n < 1800; n++) { const value = fn(); if (value) return value; await Bun.sleep(100); }
		throw new Error("Probe timeout");
	};
	const report = (h: Handle, value = handoff("original reviewed result")) => send({
		from: {}, topic: h.run + "/" + h.handle, tags: ["done"],
		body: "done\n\n" + "\x60\x60\x60json\n" + JSON.stringify(value) + "\n\x60\x60\x60",
	});
	for (const phase of ["implement", "drive", "review"]) {
		const h = await until(() => {
			const c = load(repo, "root")?.chains.root;
			return c?.phase === phase && c.handle && existsSync(join(c.handle.path, "shell-started")) && c.handle;
		});
		if (phase === "implement") {
			commit(h.path, "root.txt", "root code\n"); commit(h.path, packet, "# Root reviewed evidence\n");
		}
		report(h);
	}
	if (zeroPublication) {
		const merged = await until(() => load(repo, "root")?.finished === "done" && load(repo, "root"));
		stopRun.abort(); await running; running = undefined;
		assert.equal(creates, 1); assert.equal(mergeCalls, 1); assert.equal(merged.pr!.phase, "merged");
		assert.equal(tracker.fields("root").stage, "done");
		assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === "root"));
		console.log(JSON.stringify({ zeroPublication: true, creates, mergeCalls, head: merged.pr!.pushedHead, mergeCommit: merged.pr!.mergeCommit,
			target: merged.target, ownerSync: merged.pr!.ownerSync, readiness: "real shell run finished; scratch resources retired" }, null, 2));
		break journey;
	}
	await until(() => load(repo, "root")?.exceptions.root);
	stopRun.abort(); await running; running = undefined;
	let state = load(repo, "root")!;
	assert.equal(state.pr!.number, undefined); assert.equal(state.pr!.phase, "opening"); assert.equal(creates, 1);
	assert.equal(tracker.fields("root").stage, "ticket");
	assert.equal(state.landed.root.into, identity.path); assert(state.landingOps.root.cleanupDone);
	assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === "root"));
	observations.publicationCut = { numberSaved: state.pr!.number ?? null, creates, phase: state.pr!.phase, rootLanding: state.landed.root.head };
	state.exceptions = {}; state.pr!.lastPolledAt = undefined;
	const ownerExceptions: string[] = [], repairMessages: string[] = [];
	let saveCut: "launch" | "integrate" | undefined;
	const c: PullRequestContext = {
		state, tracker, host, tests: state.tests[identity.path] ?? [], locked: async work => work(),
		save: () => {
			if ((saveCut === "launch" && state.pr!.repair?.worker) || (saveCut === "integrate" && state.pr!.repair?.integratedHead)) {
				const at = saveCut; saveCut = undefined; throw new Error("seeded " + at + "-before-save cut");
			}
			saveState(state);
		},
		raiseOwner: (reason, message) => { ownerExceptions.push(reason + "\n" + message); console.log("owner exception: " + reason + "\n" + message); },
		launchRepair: async request => {
			const r = state.pr!.repair!;
			if (!r.launchHandle) { r.launchHandle = "repair-" + state.pr!.repairs; c.save(); }
			const registered = await workerThread(r.launchHandle, identity!.path, "root");
			if (registered) return { run: "root", handle: r.launchHandle, path: registered.cwd, threadId: registered.id };
			const launched = await dispatch([{ handle: r.launchHandle, agent: "technical", role: "review", base: head(identity!.path),
				prompt: request.message }], { run: "root", cwd: identity!.path, maxConcurrent: 1, active: [] });
			assert(launched.submitted[0], JSON.stringify(launched)); workers.push(launched.submitted[0]); return launched.submitted[0];
		},
		report: (h, after, at) => read({ topic: h.run + "/" + h.handle, limit: 20 }).messages.filter(m =>
			(!after || m.ts > after) && (!at || Date.parse(m.ts) >= at)).at(-1) as Message | undefined,
		retireRepair: async h => { await retire(h, { cwd: identity!.path }); },
		sendRepair: async (_h, message) => { repairMessages.push(message); console.log("repair retry: " + message); },
	};
	const tick = async (poll = true) => { if (poll) state.pr!.lastPolledAt = undefined; return advancePullRequest(c); };
	assert.equal(await tick(), "waiting"); assert.equal(state.pr!.number, 17); assert.equal(creates, 1);
	assert(body.includes("Repository template retained.")); assert(body.includes("## Evidence")); assert(!body.includes("Closes #"));
	const originalResults = structuredClone(state.results);
	const { publication } = await import("../../../lib/reconcile/pr-body.ts");
	const githubState = structuredClone(state); githubState.results.root.parent = "unfinished-parent";
	githubState.landed["opaque-child"] = { ...githubState.landed.root };
	githubState.results["opaque-child"] = { ...githubState.results.root, parent: "root" };
	const nativeTracker = { ...tracker, githubIssue: (slug: string) => ({ repository: "seeded/lifecycle", number: ({ root: 41, "opaque-child": 72, "unfinished-parent": 90 } as Record<string, number>)[slug], url: "https://example.invalid/issue" }) };
	const nativeBody = publication(githubState, nativeTracker).body;
	assert(nativeBody.includes("Closes #41")); assert(nativeBody.includes("Closes #72")); assert(nativeBody.includes("Part of #90"));
	assert.throws(() => publication(githubState, { ...nativeTracker, githubIssue: () => ({ repository: "other/repo", number: 41, url: "" }) }), /not in/);
	observations.references = { native: [41, 72, 90], crossRepositoryRefused: true, vaultClosingLines: false };
	const obs = observes; await tick(false); assert.equal(observes, obs);
	// Failed API and pending base checks wait/hold without a worker or target close.
	transportFailure = true; assert.equal(await tick(), "held"); transportFailure = false;
	assert.equal(tracker.fields("root").stage, "ticket");
	basePending = true; const gateCount = readFileSync(gateLog, "utf8").trim().split("\n").length;
	await tick(); assert(!state.pr!.repair); assert.equal(readFileSync(gateLog, "utf8").trim().split("\n").length, gateCount);
	basePending = false;
	checksState = "fail"; saveCut = "launch";
	await assert.rejects(tick(), /launch-before-save cut/);
	state = load(repo, "root")!; c.state = state;
	assert(!state.pr!.repair!.worker); const launchHandle = state.pr!.repair!.launchHandle;
	await tick(); const repair = state.pr!.repair!.worker!;
	assert.equal(repair.handle, launchHandle); assert.equal(workers.length, 1);
	await until(() => existsSync(join(repair.path, "shell-started")));
	commit(repair.path, "ci.txt", "green\n");
	const goodGate = readFileSync(join(repair.path, "gate.sh"), "utf8");
	commit(repair.path, "gate.sh", goodGate + "exit 1\n"); report(repair, handoff("CI repaired; additional evidence"));
	await tick(); assert.equal(state.pr!.integrationFailures, 1); assert.equal(repairMessages.length, 1);
	assert.equal(state.pr!.repair!.worker!.handle, repair.handle);
	commit(repair.path, "gate.sh", goodGate); report(repair, handoff("CI repaired; gate re-driven"));
	saveCut = "integrate"; await assert.rejects(tick(), /integrate-before-save cut/);
	state = load(repo, "root")!; c.state = state;
	assert(state.pr!.repair!.preparedHead); assert(!state.pr!.repair!.integratedHead);
	assert(isAncestor(identity.path, state.pr!.repair!.preparedHead!));
	observations.receiptRecovery = { launchHandle, preparedHead: state.pr!.repair!.preparedHead, liveLaunches: workers.length, integrationFailures: state.pr!.integrationFailures };
	// Inject another contributor between post-gate fetch and push via the real pre-push hook.
	git(outsider, "fetch", "-q", "origin"); git(outsider, "checkout", "-qb", "contributor", "origin/" + identity.branch);
	foreign = commit(outsider, "foreign.txt", "contributor history\n");
	const oldHook = readFileSync(join(repo, ".git/hooks/pre-push"), "utf8");
	writeFileSync(join(repo, ".git/hooks/pre-push"), oldHook + "\nif test ! -f " + join(root, "race-once") +
		"; then touch " + join(root, "race-once") + "; unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR; git -C " + outsider + " push -q origin HEAD:refs/heads/" + identity.branch + "; fi\n", { mode: 0o755 });
	await tick(); assert(state.pr!.repair); // refused NFF, keeps worker and prepared receipt
	writeFileSync(join(repo, ".git/hooks/pre-push"), oldHook, { mode: 0o755 });
	await tick();
	assert(!state.pr!.repair, JSON.stringify({ receipt: state.pr!.repair, ownerExceptions, repairMessages })); assert.equal(state.pr!.repairs, 1); assert.equal(readFileSync(join(identity.path, "ci.txt"), "utf8"), "green\n");
	assert(isAncestor(identity.path, foreign, state.pr!.pushedHead));
	assert.equal((await getThread(repair.threadId!))?.archived, true); assert.deepEqual(state.results, originalResults);
	observations.repairAndRace = { repairedHead: state.pr!.pushedHead, foreign, repairs: state.pr!.repairs, retired: true, creates };
	checksState = "pass";
	const mainBefore = git(outsider, "rev-parse", "origin/main");
	git(outsider, "checkout", "-q", "main"); git(outsider, "merge", "--ff-only", "origin/main");
	const advanced = commit(outsider, "base-advance.txt", "new base\n"); git(outsider, "push", "-q", "origin", "main");
	await tick(); assert(isAncestor(identity.path, advanced, state.pr!.pushedHead));
	// Divergent base edit conflicts with a preserved local, already published edit.
	commit(identity.path, "conflict.txt", "branch edit\n"); await tick();
	const conflictBase = commit(outsider, "conflict.txt", "base edit\n"); git(outsider, "push", "-q", "origin", "main");
	await tick(); assert.equal(state.pr!.repairs, 2); const conflictWorker = state.pr!.repair!.worker!;
	assert(state.pr!.repair!.request.message.includes("conflict.txt"));
	await until(() => existsSync(join(conflictWorker.path, "shell-started")));
	git(conflictWorker.path, "fetch", "-q", "origin");
	assert.throws(() => git(conflictWorker.path, "merge", "--no-edit", "origin/main"));
	put(conflictWorker.path, "conflict.txt", "branch edit + base edit\n");
	git(conflictWorker.path, "add", "--", "conflict.txt"); git(conflictWorker.path, "commit", "-qm", "resolve both histories");
	report(conflictWorker, handoff("base conflict repaired")); await tick();
	assert(!state.pr!.repair); assert(isAncestor(identity.path, conflictBase, state.pr!.pushedHead)); assert(isAncestor(identity.path, foreign, state.pr!.pushedHead));
	assert.equal((await getThread(conflictWorker.threadId!))?.archived, true); assert.equal(mergeCalls, 0);
	observations.base = { mainBefore, advanced, conflictBase, finalHead: state.pr!.pushedHead, repairs: state.pr!.repairs, mergeCalls };
	checksState = "fail"; assert.equal(await tick(), "held"); assert(!state.pr!.repair);
	assert(ownerExceptions.at(-1)?.includes("repair budget exhausted")); assert.equal(workers.length, 2);
	checksState = "pass";
	const pending = observes; await tick(false); assert.equal(observes, pending);
	terminalState = "CLOSED"; assert.equal(await tick(), "held"); assert.equal(state.pr!.phase, "closed");
	assert.equal(tracker.fields("root").stage, "ticket"); assert(ownerExceptions.at(-1)?.includes("closed without merge"));
	observations.closed = { phase: state.pr!.phase, stage: tracker.fields("root").stage, creates };
	terminalState = "OPEN"; state.pr!.phase = "waiting";
	// pr-merge refuses pending head checks; empty then triggers head-guarded merge.
	state.land = "pr-merge"; checksState = "pending"; await tick(); assert.equal(mergeCalls, 0);
	checksState = "empty"; await tick(); assert.equal(mergeCalls, 1); assert.notEqual(state.pr!.phase, "merged");
	assert.equal(tracker.fields("root").stage, "ticket");
	// Owner is unavailable; a held exception still observes terminal remote landing.
	c.ownerHeld = true; state.cwd = join(root, "missing-owner");
	assert.equal(await tick(), "merged");
	closeAtTarget({ state, tracker, save: c.save, pathOf: into => into, locked: c.locked });
	assert.equal(tracker.fields("root").stage, "done"); assert.equal(state.pr!.ownerSync, "left");
	observations.merged = { mergeCommit, target: state.target, ownerSync: state.pr!.ownerSync, stage: tracker.fields("root").stage, mergeCalls, creates };
	const gates = readFileSync(gateLog, "utf8").trim().split("\n");
	const hooks = readFileSync(hookLog, "utf8").trim().split("\n");
	for (const push of hooks.filter(line => line.startsWith("push ")).slice(1))
		assert(gates.some(line => line.endsWith(push.slice(5))), "push must have gate on exact head: " + push);
	observations.gates = { runs: gates.length, mergeHooks: hooks.filter(line => line === "merge").length };
	assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === "root"));
	assert.deepEqual(state.results.root.summary, originalResults.root.summary);
	console.log(JSON.stringify(observations, null, 2));
	}
} finally {
	stopRun?.abort(); await running?.catch(() => {});
	// Registry and shell processes are private to this invocation.
	try {
		const { retire } = await import("../../../lib/dispatch.ts");
		const { allThreads } = await import("../../../lib/thread/registry.ts");
		for (const t of await allThreads()) if (!t.archived && t.worker?.run === "root")
			workers.push({ ...t.worker, path: t.cwd, threadId: t.id });
		for (const h of workers) await retire(h, { cwd: repo }).catch(() => {});
	} finally {
		process.chdir(originalCwd); process.env = saved;
		// Staging lives next to repo, inside invocation-owned root; no shared resources.
		rmSync(root, { recursive: true, force: true });
	}
}
