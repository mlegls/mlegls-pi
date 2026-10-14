// One-off first-use machinery: real Git, tracker, shell workers, integration,
// retirement and fetch. GitHub observations are explicitly seeded, not live.
import assert from "node:assert/strict";
import { shellBb } from "../land-reconciled-trees-through-pull-requests/shell-bb.ts";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { State } from "../../../lib/reconcile/reconcile.ts";
import type { Handle } from "../../../lib/dispatch.ts";
import type { PullRequestHost, PullRequestSnapshot } from "../../../lib/reconcile/pr-types.ts";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
const cli = join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const head = (cwd: string) => git(cwd, "rev-parse", "HEAD");
const put = (cwd: string, path: string, body: string) => {
	mkdirSync(join(cwd, path, ".."), { recursive: true }); writeFileSync(join(cwd, path), body);
};
const commit = (cwd: string, path: string, body: string) => {
	put(cwd, path, body); git(cwd, "add", "--", path); git(cwd, "commit", "-qm", path); return head(cwd);
};
const packet = (slug: string) => "docs/attachments/fixture/" + slug + ".md";
const handoff = (slug: string) => ({ summary: slug + " reviewed result", setup: { kind: "isolated-shell" },
	stories: [{ story: slug + " code and joins", outcome: "held" }],
	evidence: { path: packet(slug), visual: false, shots: [] }, tests: [] });

async function staging(ownerCase: string) {
	const root = realpathSync(mkdtempSync("/tmp/rc-pr-staging-")), saved = { ...process.env }, originalCwd = process.cwd();
	const main = join(root, "repo"), owner = join(root, "owner"), remote = join(root, "remote.git");
	const agents = join(root, "agents"), bin = join(root, "bin"), gateLog = join(root, "gates"), hookLog = join(root, "hooks");
	let controller = new AbortController(), running: Promise<void> | undefined, merged: PullRequestSnapshot | undefined;
	const observations: Record<string, unknown> = { ownerCase, github: "seeded host, not live GitHub" };
	try {
		for (const key of Object.keys(process.env))
			if (/^(?:PI_.*|BB_.*|AB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
			PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: agents,
			MISE_TRUSTED_CONFIG_PATHS: root,
			TRACKER_CLI: cli, PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "3",
			WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'", PATH: bin + ":" + saved.PATH });
		for (const dir of [main, bin, join(agents, "roles")]) mkdirSync(dir, { recursive: true });
		shellBb(root, "git rev-parse HEAD > shell-base\ntouch shell-started\n");
		for (const [name, role] of [["shell", "implement"], ["shell-drive", "drive"], ["tidy", "review"], ["technical", "implement"]]) {
			put(agents, name + ".md", "---\nrole: " + role + "\n---\nDeterministic shell fixture.\n");
			put(agents, "roles/" + role + ".md", "Deterministic shell fixture.\n");
		}
		const { run, load, saveState, prepareStart, stateFile } = await import("../../../lib/reconcile/reconcile.ts");
		const { stop, summary } = await import("../../../lib/reconcile/main.ts");
		const { resolveLanding, prepareStaging, landingMode } = await import("../../../lib/reconcile/pr-config.ts");
		const { getThread, allThreads } = await import("../../../lib/thread/registry.ts");
		const { getTracker } = await import("../../../lib/tracker.ts");
		const { send } = await import("../../../lib/board/store.ts");
		git(main, "init", "-qb", "tracker"); git(main, "config", "user.name", "PR staging fixture");
		git(main, "config", "user.email", "fixture@example.invalid"); git(main, "config", "commit.gpgSign", "false");
		// Hooks are installed and executed normally, never disabled.
		writeFileSync(join(main, ".git/hooks/pre-commit"), "#!/bin/sh\nprintf 'commit\\n' >> " + hookLog + "\n", { mode: 0o755 });
		writeFileSync(join(main, ".git/hooks/pre-merge-commit"), "#!/bin/sh\nprintf 'merge\\n' >> " + hookLog + "\n", { mode: 0o755 });
		commit(main, ".gitignore", "shell-started\nshell-base\n");
		assert.equal(resolveLanding(main), "local");
		commit(main, ".pi/reconcile.json", '{"land":"pr-review"}\n');
		commit(main, "gate.sh", "#!/bin/sh\nprintf '%s ' \"$PWD\" >> " + gateLog + "\ngit rev-parse HEAD | tr '\\n' ' ' >> " + gateLog + "\nparent=$(git config --get branch.$(git branch --show-current).ab-parent || git branch --show-current)\nprintf '%s\\n' \"$parent\" >> " + gateLog + "\n");
		commit(main, "mise.toml", '[tasks.setup]\nrun = "true"\n[tasks.pre-integrate]\nrun = "bash gate.sh"\n');
		mkdirSync(join(main, "docs/issues"), { recursive: true });
		const tracker = getTracker(main, { inflight: false });
		for (const [slug, fields] of [
			["root", { stage: "spec" }], ["a", { stage: "ticket", "part-of": "root" }],
			["b", { stage: "ticket", "part-of": "root", "blocked-by": ["a"] }],
			["outside", { stage: "ticket", "blocked-by": ["a"] }],
		] as const) tracker.create({ slug, fields: { ...fields, assignee: "agent:shell", author: "user:pr-fixture" }, body: slug + " fixture contract.\n" });
		git(main, "worktree", "add", "-qb", "main", owner);
		git(main, "init", "--bare", "-q", remote); git(main, "remote", "add", "origin", remote);
		git(owner, "push", "-q", "origin", "main");
		let published = false, creates = 0;
		const snapshot = (): PullRequestSnapshot => merged ?? {
			number: 1, url: "https://github.com/seeded/staging/pull/1", state: "OPEN",
			headBranch: identity.branch, head: git(main, "rev-parse", "refs/heads/" + identity.branch),
			baseBranch: "main", base: git(main, "rev-parse", "refs/remotes/origin/main"), mergeable: "MERGEABLE",
			checks: [], reviews: [], threads: [],
		};
		const host: PullRequestHost = {
			project: () => ({ repository: "seeded/staging", remote: "origin", baseBranch: "main" }),
			observe: () => { assert(published); return snapshot(); },
			find: () => published ? snapshot() : undefined,
			create: () => { published = true; creates++; return snapshot(); },
			checks: () => [], merge: () => { throw new Error("seeded merge is performed by actual Git"); },
			reply: () => { throw new Error("reviews out of scope"); },
		};
		assert.equal(resolveLanding(owner), "pr-review");
		put(owner, ".pi/reconcile.json", '{"land":"local"}\n');
		assert.equal(resolveLanding(owner), "pr-review"); // ignores dirty config
		put(owner, ".pi/reconcile.json", '{"land":"pr-review"}\n');
		assert.equal(resolveLanding(owner, "local"), "local");
		assert.equal(resolveLanding(owner, undefined, { land: undefined } as State), "local");
		assert.throws(() => landingMode("pr"), /Invalid/);
		const options = { cwd: owner, root: "root", owner: "mail/staging-fixture", budget: 1, prHost: host };
		const captured = prepareStart(options), identity = structuredClone(captured.pr!);
		assert.equal(captured.land, "pr-review");
		assert(!existsSync(join(identity.path, "docs/issues")));
		assert.throws(() => prepareStart({ ...options, land: "local" }), /already captured/);
		// Committed config changes do not reinterpret this run. Publish only the
		// private base config commit, so clean owner can still ff after closure.
		commit(owner, ".pi/reconcile.json", '{"land":"local"}\n'); git(owner, "push", "-q", "origin", "main");
		assert.equal(prepareStart(options).land, "pr-review");
		assert.equal(prepareStart(options).pr?.path, identity.path);
		const configProbe = join(root, "config-probe");
		git(main, "worktree", "add", "-qb", "config-probe", configProbe);
		commit(configProbe, ".pi/reconcile.json", "{malformed\n");
		assert.throws(() => prepareStart({ ...options, cwd: configProbe, root: "invalid" }), /Malformed/);
		assert(!existsSync(stateFile(configProbe, "invalid")));
		git(main, "worktree", "remove", configProbe);
		// Exact persisted pre-creation identity recovery, without a guessed path.
		git(main, "worktree", "remove", identity.path); git(main, "branch", "-D", identity.branch);
		prepareStaging(captured, host, () => saveState(captured));
		assert.equal(captured.pr?.path, identity.path); assert.equal(captured.pr?.branch, identity.branch);
		assert.equal(head(identity.path), identity.baseHead);
		put(main, ".git/verify-main/red", "seeded local-main red must not hold a PR root\n");
		const ownerHead = head(owner);
		const state = () => load(main, "root")!;
		const begin = (from = owner) => {
			controller = new AbortController();
			running = run({ ...options, cwd: from, signal: controller.signal });
		};
		const until = async <T>(read: () => T | false | undefined): Promise<T> => {
			for (let i = 0; i < 1200; i++) {
				const s = load(main, "root");
				if (s && Object.keys(s.exceptions).length) throw new Error("Unexpected exception: " + JSON.stringify(s.exceptions));
				const value = read(); if (value) return value; await Bun.sleep(100);
			}
			throw new Error("Staging fixture timeout: " + JSON.stringify(state()));
		};
		const ready = async (slug: string, phase: string) => until(() => {
			const c = state()?.chains[slug], h = c?.handle;
			return c?.phase === phase && h && existsSync(join(h.path, "shell-started")) && h;
		});
		const report = (h: Handle, slug: string) => send({ from: {}, topic: h.run + "/" + h.handle, tags: ["done"],
			body: "done\n\n" + "\x60\x60\x60json\n" + JSON.stringify(handoff(slug)) + "\n\x60\x60\x60" });
		const finish = async (slug: string, hold = false) => {
			const h = await ready(slug, "implement");
			commit(h.path, slug + ".txt", slug + " code\n"); commit(h.path, packet(slug), "# " + slug + " evidence\n");
			report(h, slug); const d = await ready(slug, "drive"); report(d, slug); const r = await ready(slug, "review");
			if (!hold) report(r, slug);
			return r;
		};
		begin(); await finish("a"); await finish("b");
		const review = await finish("root", true), collectorCut = structuredClone(state());
		assert.equal(collectorCut.landed.a.into, "root"); assert.equal(collectorCut.landed.b.into, "root");
		assert.equal(collectorCut.collectors.root.parentBranch, identity.branch);
		assert.equal(git(review.path, "config", "branch." + review.handle + ".ab-parent"), identity.branch);
		assert.equal(head(owner), ownerHead);
		for (const slug of ["a", "b"]) assert.equal(tracker.fields(slug).stage, "ticket");
		assert.equal(tracker.snapshot().get("outside")?.frontier, false);
		report(review, "root");
		await until(() => state().landingOps.root?.cleanupDone && !Object.keys(state().chains).length && state().pr?.phase === "waiting");
		const staged = structuredClone(state());
		assert.equal(staged.pr?.phase, "waiting"); assert.equal(staged.landed.root.into, identity.path);
		assert.equal(creates, 1); assert.equal(staged.pr?.number, 1);
		assert.equal(head(owner), ownerHead); assert(!existsSync(join(owner, "root.txt")));
		for (const slug of ["a", "b", "root"]) {
			assert.equal(staged.landed[slug].into, identity.path); assert(!staged.results[slug].closedAt);
			assert.equal(staged.results[slug].summary, slug + " reviewed result");
		}
		const gates = readFileSync(gateLog, "utf8").trim().split("\n");
		assert.equal(gates.length, 4); assert(gates.at(-1)?.endsWith(identity.branch));
		assert(gates[2].includes(review.path)); assert(gates[3].includes(identity.path)); assert((await getThread(review.threadId!))?.archived);
		assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === "root"));
		assert(getTracker(main).snapshot().get("root")?.claims.some(c => c.claimedBy.includes("PR staging")));
		const status = summary({ ...staged, running: true });
		observations.staging = { owner, ownerHead, staging: identity, collector: collectorCut.collectors.root,
			ledger: staged.landed, rootReceipt: staged.landingOps.root, gates,
			retired: staged.landingOps.root.cleanupDone, results: staged.results,
			status: { land: status.land, target: status.target, phase: status.pr?.phase, chains: status.chains } };
		controller.abort(); await running;
		// Emulate the exited reconciler, then exercise explicit stop and restart.
		staged.pid = undefined; saveState(staged); await stop(main, "root");
		assert.equal(state().finished, "stopped"); assert(existsSync(identity.path));
		assert.equal(state().pr?.branch, identity.branch); assert.equal(tracker.fields("b").stage, "ticket");
		begin(main); await Bun.sleep(5500);
		assert.equal(state().counter, staged.counter); assert(!Object.keys(state().chains).length);
		assert.deepEqual(state().results, staged.results); assert.equal(head(owner), ownerHead);
		controller.abort(); await running;
		// A seeded MERGED claim without fetched base proof cannot close anything.
		const { closeAtTarget } = await import("../../../lib/reconcile/completion.ts");
		const unproven = structuredClone(state());
		unproven.pr = { ...unproven.pr!, phase: "merged", mergeCommit: unproven.landed.root.head };
		assert.throws(() => closeAtTarget({ state: unproven, tracker, save: () => { throw new Error("must not save"); },
			pathOf: into => into, locked: async work => work() }), /not in fetched base/);
		assert.equal(tracker.fields("b").stage, "ticket");
		// Actual private remote merge commit, not a staging ancestry inference.
		const merger = join(root, "merger");
		git(main, "worktree", "add", "-q", "--detach", merger, "refs/remotes/origin/main");
		git(merger, "merge", "--no-ff", "--no-edit", identity.branch); const mergeCommit = head(merger);
		git(merger, "push", "-q", "origin", "HEAD:refs/heads/main");
		merged = { number: 1, url: "https://github.com/seeded/staging/pull/1", state: "MERGED", headBranch: identity.branch,
			head: staged.pr!.pushedHead!, baseBranch: "main", base: mergeCommit, mergeable: "MERGEABLE",
			checks: [], reviews: [], threads: [], mergedAt: new Date().toISOString(), mergeCommit };
		if (ownerCase === "dirty") put(owner, "uncommitted.txt", "do not overwrite\n");
		if (ownerCase === "other") git(owner, "checkout", "-qb", "unrelated");
		if (ownerCase === "divergent") commit(owner, "divergent.txt", "do not discard\n");
		if (ownerCase === "missing") git(main, "worktree", "remove", owner);
		const beforeClose = ownerCase === "missing" ? undefined : head(owner);
		const closeCut = state(), observed = host.observe(identity.path, identity.repository, 1);
		assert.equal(observed.state, "MERGED");
		closeCut.pr = { ...closeCut.pr!, phase: "merged", mergeCommit: observed.mergeCommit, mergedAt: observed.mergedAt, url: observed.url, number: observed.number };
		closeCut.pid = undefined; saveState(closeCut);
		begin(main); await until(() => state().finished === "done"); await running;
		const final = state(), target = "github:seeded/staging:main";
		for (const slug of ["a", "b", "root"]) {
			assert.equal(final.landed[slug].into, target); assert(final.results[slug].closedAt);
			assert(tracker.text(slug).includes(slug + " reviewed result")); assert(tracker.text(slug).includes(packet(slug)));
		}
		assert.equal(final.pr?.ownerSync, ownerCase === "clean" ? "updated" : "left");
		if (ownerCase === "clean") assert.equal(head(owner), mergeCommit);
		else if (ownerCase !== "missing") assert.equal(head(owner), beforeClose);
		if (ownerCase === "dirty") assert.equal(readFileSync(join(owner, "uncommitted.txt"), "utf8"), "do not overwrite\n");
		if (ownerCase === "other") assert.equal(git(owner, "branch", "--show-current"), "unrelated");
		assert.equal(final.counter, staged.counter); assert.equal(creates, 1);
		assert.equal(readFileSync(gateLog, "utf8").trim().split("\n").length, 4);
		const subjects = git(main, "log", "--reverse", "--format=%s", ownerHead + "..tracker").split("\n");
		const closes = subjects.filter(s => s.includes("close ")).map(s => s.slice(s.indexOf("close ")));
		assert.deepEqual(closes, ["close a", "close b", "close root"]);
		let replayCloses = 0;
		closeAtTarget({ state: final, tracker: { ...tracker, close: () => { replayCloses++; } }, save: () => saveState(final), pathOf: into => into, locked: async work => work() });
		assert.equal(replayCloses, 0);
		assert.equal(state().pr?.ownerSync, final.pr?.ownerSync);
		observations.merged = { mergeCommit, fetchedBase: git(identity.path, "rev-parse", "refs/remotes/origin/main"),
			target: final.target, closeOrder: closes, ownerSync: final.pr?.ownerSync, ownerHead: beforeClose,
			counter: final.counter, creates, replayCloses, hooks: readFileSync(hookLog, "utf8").trim().split("\n").length };
		console.log("RESULT " + JSON.stringify(observations));
	} finally {
		try { controller.abort(); if (running) await running; }
		finally {
			try {
				const { allThreads } = await import("../../../lib/thread/registry.ts");
				const { abandonThread } = await import("../../../lib/thread/lifecycle.ts");
				for (const thread of await allThreads()) await abandonThread(thread.id);
			} finally { process.chdir(originalCwd); process.env = saved; rmSync(root, { recursive: true, force: true }); }
		}
	}
}

if (import.meta.main) {
	const mode = process.argv[2] ?? "all";
	if (mode === "all") for (const item of ["clean", "dirty", "other", "divergent", "missing"]) {
		const child = Bun.spawn(["bun", import.meta.path, item], { stdout: "inherit", stderr: "inherit" });
		assert.equal(await child.exited, 0, item + " failed");
	} else {
		assert(["clean", "dirty", "other", "divergent", "missing"].includes(mode));
		await staging(mode);
	}
}
