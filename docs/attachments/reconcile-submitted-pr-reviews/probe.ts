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
	writeFileSync(join(bin, "pi"), "#!/bin/sh\ncase \"$PWD\" in */repair-1) printf 'repaired code\\n' > root.txt; git add root.txt; git commit -qm 'Repair submitted threads T1 and T2' ;; esac\ntouch shell-started\nexec sleep 600\n", { mode: 0o755 });
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
	let identity: ReturnType<typeof prepareStart>["pr"], created = false, publicationCut = false, checksState = "empty";
	let terminalState: PullRequestSnapshot["state"] = "OPEN", mergeCommit: string | undefined, mergeCalls = 0, creates = 0, finds = 0, observes = 0;
	let body = "", foreign: string | undefined, transportFailure = false, basePending = false;
	let reviews: PullRequestSnapshot["reviews"] = [], threads: PullRequestSnapshot["threads"] = [];
	const posted = new Map<string, string>(); let replyCut = true, postCount = 0;
	const snapshot = (): PullRequestSnapshot => ({
		number: 17, url: "https://example.invalid/seeded/lifecycle/pull/17", state: terminalState,
		headBranch: identity!.branch, head: git(repo, "rev-parse", "refs/remotes/origin/" + identity!.branch),
		baseBranch: "main", base: git(repo, "rev-parse", "refs/remotes/origin/main"), mergeable: "MERGEABLE",
		checks: checksState === "empty" ? [] : [{ id: "build:1", name: "build", state: checksState as "pass" | "pending" | "fail",
			url: "https://example.invalid/diagnostics/1", details: "seeded CI: ci.txt must be green" }],
		reviews: reviews, threads: threads, ...(terminalState === "MERGED" ? { mergeCommit, mergedAt: "2026-10-14T00:00:00Z" } : {}),
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
		reply: (_cwd, _repository, thread, body, marker) => {
			assert.equal(git(repo, "rev-parse", "refs/remotes/origin/" + identity!.branch), head(identity!.path));
			if (posted.has(marker)) return;
			posted.set(marker, body); postCount++;
			if (replyCut) { replyCut = false; throw new Error("seeded post-before-save cut"); }
		},
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

	await until(() => load(repo, "root")?.pr?.number);
	stopRun.abort(); await running; running = undefined;
	let state = load(repo, "root")!;
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

	const originalResults = structuredClone(state.results);
	const thread = (id: string, reviewId?: string, resolved = false) => ({ id, resolved,
		comments: [{ id: "comment-" + id, reviewId, body: "Fix " + id, path: "root.txt", line: 1,
			url: "https://example.invalid/seeded/lifecycle/pull/17#discussion-" + id }] });
	threads = [thread("lone")];
	await tick(); assert.equal(workers.length, 0);
	reviews = [{ id: "quiet", state: "APPROVED", submittedAt: "2026-01-01T00:00:00Z", commit: snapshot().head }];
	await tick(); assert(state.pr!.reviews.processed.includes("quiet")); assert.equal(workers.length, 0);
	// A contributor has advanced the actual PR head before submission.
	git(outsider, "fetch", "-q", "origin");
	git(outsider, "checkout", "-qb", "contribution", "origin/" + identity!.branch);
	const contributorHead = commit(outsider, "contribution.txt", "preserve me\n");
	git(outsider, "push", "-q", "origin", "HEAD:refs/heads/" + identity!.branch);
	reviews.push({ id: "R1", state: "CHANGES_REQUESTED", submittedAt: "2026-01-02T00:00:00Z",
		commit: contributorHead, url: "https://example.invalid/seeded/lifecycle/pull/17#pullrequestreview-1" });
	reviews.push({ id: "R2", state: "COMMENTED", submittedAt: "2026-01-03T00:00:00Z",
		commit: contributorHead });
	threads = [thread("T1", "R1"), thread("T2", "R2"), thread("resolved", "R1", true), thread("lone")];
	await tick(); assert.equal(workers.length, 1);
	const repair = state.pr!.repair!.worker!, request = state.pr!.repair!.request;
	assert.equal(request.head, contributorHead); assert.deepEqual(request.reviewIds, ["R1", "R2"]);
	assert.deepEqual(request.threadIds, ["T1", "T2"]); assert(request.message.includes("Fix T1"));
	await until(() => existsSync(join(repair.path, "shell-started")));
	assert.equal(git(repair.path, "rev-parse", "HEAD^"), contributorHead);
	const repairHead = head(repair.path);
	assert.equal(readFileSync(join(repair.path, "root.txt"), "utf8"), "repaired code\n");
	const reviewed = { ...handoff("review repair"), threadReplies: { T1: "Fixed T1 in " + repairHead, T2: "Fixed T2 in " + repairHead } };
	report(repair, reviewed);
	assert.equal(await tick(), "held"); // first reply reached host, receipt did not save
	assert.equal(postCount, 1); assert(!state.pr!.reviews.repaired.length);
	const pushedHead = state.pr!.repair!.pushedHead!;
	assert(isAncestor(repo, repairHead, pushedHead)); assert(isAncestor(repo, contributorHead, pushedHead));
	state = load(repo, "root")!; c.state = state;
	// A review arriving during repair is not consumed by completion.
	reviews.push({ id: "during", state: "APPROVED", submittedAt: "2026-01-04T00:00:00Z", commit: pushedHead });
	await tick(); assert.equal(postCount, 2); assert(!state.pr!.repair);
	assert(!state.pr!.reviews.processed.includes("during"));
	await tick(); assert(state.pr!.reviews.processed.includes("during"));
	await tick(); assert.equal(postCount, 2); assert.equal(workers.length, 1);
	// Dismissal does not erase durable policy. The later submission escalates.
	reviews[1].state = "DISMISSED";
	reviews.push({ id: "second", state: "CHANGES_REQUESTED", submittedAt: new Date(Date.now() + 1000).toISOString(),
		commit: pushedHead, url: "https://example.invalid/seeded/lifecycle/pull/17#pullrequestreview-2" });
	threads.push(thread("T3", "second"));
	assert.equal(await tick(), "held"); assert.equal(workers.length, 1);
	assert(ownerExceptions.at(-1)!.includes("Second changes-requested"));
	assert(ownerExceptions.at(-1)!.includes("T3")); assert(ownerExceptions.at(-1)!.includes(pushedHead));
	assert.equal(mergeCalls, 0); assert.equal(tracker.fields("root").stage, "ticket");
	// Explicit human merge, NOT the host's merge method.
	git(outsider, "fetch", "-q", "origin"); git(outsider, "checkout", "-q", "main");
	git(outsider, "merge", "--no-ff", "--no-edit", "origin/" + identity!.branch);
	mergeCommit = head(outsider); git(outsider, "push", "-q", "origin", "main"); terminalState = "MERGED";
	c.ownerHeld = true;
	assert.equal(await tick(), "merged");
	closeAtTarget({ state, tracker, save: c.save, pathOf: into => into, locked: c.locked });
	assert.equal(tracker.fields("root").stage, "done"); assert.equal(mergeCalls, 0);
	assert.deepEqual(state.results.root.handoff, originalResults.root.handoff);
	assert.equal(state.results.root.summary, originalResults.root.summary);
	const gates = readFileSync(gateLog, "utf8").trim().split("\n");
	for (const push of readFileSync(hookLog, "utf8").trim().split("\n").filter(line => line.startsWith("push ")).slice(1))
		assert(gates.some(line => line.endsWith(push.slice(5))), "push had exact-head gates");
	assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === "root"));
	console.log(JSON.stringify({ host: "seeded API sequence, not live GitHub", contributorHead, repairHead,
		pushedHead, mergeCommit, worker: repair, request, replies: [...posted], postCount, workerCount: workers.length,
		mergeCalls, target: state.target, closedStage: tracker.fields("root").stage, gateRuns: gates.length,
		secondException: ownerExceptions.at(-1), readiness: "scratch resources retired after this run" }, null, 2));
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