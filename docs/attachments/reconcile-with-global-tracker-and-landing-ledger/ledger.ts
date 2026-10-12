// Actual-run drive machinery. No model calls or retained tests.
// Each invocation owns a private repository, board, registry and shell runtime.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { State } from "../../../lib/reconcile/reconcile.ts";
import type { Handle } from "../../../lib/dispatch.ts";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
const cli = join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const modes = ["collector", "restart", "close-replay", "linked-owner"] as const;
type Mode = typeof modes[number];
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const head = (cwd: string) => git(cwd, "rev-parse", "HEAD");
const put = (cwd: string, file: string, body: string) => {
	mkdirSync(join(cwd, file, ".."), { recursive: true }); writeFileSync(join(cwd, file), body);
};
const commit = (cwd: string, file: string, body: string) => {
	put(cwd, file, body); git(cwd, "add", "--", file); git(cwd, "commit", "-qm", file); return head(cwd);
};
const packet = (slug: string) => "docs/attachments/fixture/" + slug + ".md";
const handoff = (slug: string) => ({ summary: slug + " reviewed result", setup: { kind: "isolated-shell" },
	stories: [{ story: slug + " code and joins", outcome: "held" }],
	evidence: { path: packet(slug), visual: false, shots: [] }, tests: [] });

export async function ledger(mode: Mode, replayCut: "delivered" | "prepared" = "delivered") {
	const root = realpathSync(mkdtempSync("/tmp/rc-global-ledger-")), saved = { ...process.env }, originalCwd = process.cwd();
	const main = join(root, "repo"), bin = join(root, "bin"), agents = join(root, "agents");
	let controller = new AbortController(), running: Promise<void> | undefined;
	const observations: Record<string, unknown> = { mode };
	try {
		for (const key of Object.keys(process.env))
			if (/^(?:PI_.*|BB_.*|AB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
			PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: agents,
			ZMX_DIR: join(root, "zmx"), PI_THREAD_RUNTIME: "zmx", MISE_TRUSTED_CONFIG_PATHS: root,
			TRACKER_CLI: cli, PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "3",
			WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'", PATH: bin + ":" + saved.PATH });
		for (const dir of [main, bin, join(agents, "roles")]) mkdirSync(dir, { recursive: true });
		writeFileSync(join(bin, "pi"), "#!/bin/sh\ngit rev-parse HEAD > shell-base\ntouch shell-started\nexec sleep 600\n", { mode: 0o755 });
		for (const [name, role] of [["shell", "implement"], ["shell-drive", "drive"], ["tidy", "review"]]) {
			put(agents, name + ".md", "---\nrole: " + role + "\n---\nDeterministic shell fixture.\n");
			put(agents, "roles/" + role + ".md", "Deterministic shell fixture.\n");
		}
		// Imports which cache env (notably agents.ts) occur only after isolation.
		const { run, load, saveState } = await import("../../../lib/reconcile/reconcile.ts");
		const { allThreads, getThread, saveThread } = await import("../../../lib/thread/registry.ts");
		const { excludeTracker } = await import("../../../lib/thread/tracker-worktree.ts");
		const { getTracker } = await import("../../../lib/tracker.ts");
		const { send } = await import("../../../lib/board/store.ts");
		git(main, "init", "-qb", "main"); git(main, "config", "user.name", "Ledger fixture");
		git(main, "config", "user.email", "fixture@example.invalid");
		git(main, "config", "commit.gpgSign", "false"); git(main, "config", "core.hooksPath", "/dev/null");
		mkdirSync(join(main, "docs/issues"), { recursive: true });
		commit(main, ".gitignore", "shell-started\nshell-base\n");
		const gates = join(root, "gates");
		commit(main, "mise.toml", '[tasks.setup]\nrun = "true"\n[tasks.pre-integrate]\nrun = "git rev-parse HEAD >> ' + gates + '"\n');
		const tracker = getTracker(main, { inflight: false });
		for (const [slug, fields] of [
			["root", { stage: "spec" }], ["a", { stage: "ticket", "part-of": "root" }],
			["b", { stage: "ticket", "part-of": "root", "blocked-by": ["a"] }],
			["outside", { stage: "ticket", "blocked-by": ["a"] }],
		] as const) tracker.create({ slug, fields: { ...fields, assignee: "agent:shell", author: "user:ledger-fixture" }, body: slug + " fixture contract.\n" });
		let owner = main;
		if (mode === "linked-owner") {
			owner = join(root, "linked-owner"); git(main, "worktree", "add", "-qb", "owned", owner);
		}
		const state = () => load(main, "root")!;
		const receiptCount = () => existsSync(gates) ? readFileSync(gates, "utf8").trim().split("\n").filter(Boolean).length : 0;
		const begin = (from = owner) => {
			controller = new AbortController();
			running = run({ cwd: from, root: "root", owner: "mail/ledger-fixture", budget: 1, signal: controller.signal });
		};
		const until = async <T>(read: () => T | false | undefined): Promise<T> => {
			for (let i = 0; i < 1200; i++) {
				const s = load(main, "root");
				if (s && Object.keys(s.exceptions).length) throw new Error("Unexpected exception: " + JSON.stringify(s.exceptions));
				const value = read(); if (value) return value; await Bun.sleep(100);
			}
			throw new Error("Ledger fixture readiness timeout: " + JSON.stringify(load(main, "root")));
		};
		const ready = async (slug: string, phase: string) => {
			const h = await until(() => {
				const c = state()?.chains[slug], h = c?.handle;
				return c?.phase === phase && h && existsSync(join(h.path, "shell-started")) && h;
			});
			assert((await getThread(h.threadId!))?.worker);
			return h;
		};
		const report = (h: Handle, slug: string) => send({ from: {}, topic: h.run + "/" + h.handle, tags: ["done"],
			body: "done\n\n" + "\x60\x60\x60json\n" + JSON.stringify(handoff(slug)) + "\n\x60\x60\x60" });
		const finishChain = async (slug: string, hold = false) => {
			const h = await ready(slug, "implement");
			commit(h.path, slug + ".txt", slug + " code\n");
			commit(h.path, packet(slug), "# " + slug + " evidence\n");
			report(h, slug);
			const d = await ready(slug, "drive"); report(d, slug);
			const r = await ready(slug, "review");
			if (!hold) report(r, slug);
			return { first: h, review: r };
		};
		const final = async () => {
			await until(() => state()?.finished === "done"); await running;
			const s = state(), snap = tracker.snapshot();
			for (const slug of ["a", "b", "root"]) {
				assert(snap.get(slug)?.done); assert.equal(s.landed[slug].into, owner);
				assert(s.results[slug].closedAt); assert.equal(s.results[slug].evidence, packet(slug));
				assert.equal(s.results[slug].summary, slug + " reviewed result");
				const globalResult = tracker.text(slug);
				assert(globalResult.includes(slug + " reviewed result")); assert(globalResult.includes(packet(slug)));
				assert.equal(readFileSync(join(owner, slug + ".txt"), "utf8"), slug + " code\n");
			}
			assert(snap.get("outside")?.frontier);
			observations.final = { cwd: s.cwd, finished: s.finished, ledger: s.landed, results: s.results,
				outsideFrontier: true, gates: receiptCount(), codeHead: head(owner), counter: s.counter };
		};
		if (mode === "close-replay") {
			// Deterministic persisted cut, not a timed crash. Code already delivered;
			// one close receipt exists, b/root remain pending. The second variant
			// omits root's ledger transition: actual run proves prepared ancestry.
			const workerPath = join(root, "saved-review");
			git(main, "worktree", "add", "--no-checkout", "-qb", "saved-review", workerPath);
			excludeTracker(workerPath); git(main, "config", "branch.saved-review.ab-parent", "main");
			for (const slug of ["a", "b", "root"]) {
				commit(workerPath, slug + ".txt", slug + " code\n");
				commit(workerPath, packet(slug), "# " + slug + " evidence\n");
			}
			const preparedHead = head(workerPath), before = head(main);
			git(main, "merge", "--ff-only", "saved-review");
			const h = { run: "root", handle: "saved-review", path: workerPath, threadId: "saved-review" };
			await saveThread({ id: h.threadId, sessionId: h.threadId, sessionFile: join(root, "review.jsonl"),
				cwd: workerPath, project: main, worktree: workerPath, ownership: "owner", branch: h.handle,
				archived: false, created: new Date().toISOString(), worker: { run: h.run, handle: h.handle } });
			const at = new Date().toISOString(), results: State["results"] = {};
			for (const slug of ["a", "b", "root"]) results[slug] = { parent: slug === "root" ? null : "root",
				summary: slug + " reviewed result", evidence: packet(slug), handoff: handoff(slug) };
			tracker.close("a", { summary: results.a.summary, evidence: results.a.evidence }); results.a.closedAt = at;
			saveState({ backend: "threads", root: "root", cwd: main, owner: "mail/ledger-fixture", budget: 1,
				landed: { a: { into: main, head: preparedHead, at },
					b: { into: replayCut === "delivered" ? main : "root", head: preparedHead, at },
					...(replayCut === "delivered" ? { root: { into: main, head: preparedHead, at } } : {}) },
				results, landingOps: { root: { slug: "root", into: main, destination: main, before,
					worker: h, workers: [h], preparedHead, carried: ["b"], result: results.root,
					...(replayCut === "delivered" ? { landedHead: preparedHead, at } : {}) } },
				refinements: {}, collectors: {}, chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
			observations.cut = { kind: replayCut, closed: ["a"], pending: ["b", "root"], preparedHead, before, ledger: state().landed, gates: 0 };
			begin(main); await final();
			assert.equal(state().counter, 0); assert.equal(receiptCount(), 0);
			assert.equal(state().landingOps.root.preparedHead, preparedHead);
			assert(state().landingOps.root.cleanupDone);
			// Close order is observable through canonical result commit history.
			const subjects = git(main, "log", "--reverse", "--format=%s", preparedHead + "..HEAD").split("\n");
			const closeB = subjects.findIndex(s => s.includes("close b")), closeRoot = subjects.findIndex(s => s.includes("close root"));
			assert(closeB >= 0 && closeRoot > closeB, JSON.stringify(subjects));
			observations.replay = { workerLaunches: 0, reintegrationGates: 0, subjects };
		} else {
			begin(); const a = await finishChain("a");
			await until(() => state().landingOps.a?.cleanupDone && !state().chains.a);
			assert((await getThread(a.review.threadId!))?.archived);
			const bFirst = await ready("b", "implement"), collector = state().collectors.root;
			const base = readFileSync(join(bFirst.path, "shell-base"), "utf8").trim();
			const bReceipt = { handle: bFirst.handle, threadId: bFirst.threadId, base,
				branch: git(bFirst.path, "branch", "--show-current"),
				aCode: readFileSync(join(bFirst.path, "a.txt"), "utf8") };
			git(bFirst.path, "merge-base", "--is-ancestor", state().landed.a.head, base);
			assert.equal(readFileSync(join(bFirst.path, "a.txt"), "utf8"), "a code\n");
			assert.equal(state().landed.a.into, "root");
			if (mode === "restart" || mode === "linked-owner") {
				const cut = structuredClone(state()), gatesBefore = receiptCount();
				controller.abort(); await running;
				saveState(cut); // Restore the observed durable cut verbatim, not a computed frontier.
				observations.restartCut = { ledger: cut.landed, result: cut.results.a, bHandle: bFirst.handle,
					aWorkers: cut.landingOps.a.workers.map(h => h.handle), gates: gatesBefore };
				begin(main); // Persisted cwd wins, including when owner is linked.
				await ready("b", "implement");
				assert.equal(state().cwd, owner); assert.equal(state().chains.b.handle?.handle, bFirst.handle);
				assert.equal(receiptCount(), gatesBefore); assert(!state().chains.a);
			}
			await finishChain("b");
			const joined = await finishChain("root", true);
			// Fixture-owned sentinel holds the final review report, hence integration.
			const sentinel = join(root, "release-root"); assert(!existsSync(sentinel));
			const canonical = getTracker(main).snapshot(), s = state();
			for (const slug of ["a", "b"]) assert(!canonical.get(slug)?.done);
			assert(canonical.get("a")?.claims.some(c => c.claimedBy.includes("awaiting target")));
			assert(!canonical.get("outside")?.frontier);
			assert.equal(s.collectors.root.parentBranch, mode === "linked-owner" ? "owned" : "main");
			assert.equal(git(collector.path, "config", "branch." + collector.branch + ".ab-parent"), s.collectors.root.parentBranch);
			const threads = await allThreads(true);
			assert.equal(threads.filter(t => t.worker?.run === "root" && t.worker.handle.includes("b-implement")).length, 1);
			observations.pause = { sentinel: "root review withheld until release-root", canonical: Object.fromEntries(
				["a", "b", "outside", "root"].map(slug => [slug, canonical.get(slug)])),
				ledger: s.landed, b: bReceipt,
				collector, gates: receiptCount() };
			writeFileSync(sentinel, "release\n"); assert(existsSync(sentinel)); report(joined.review, "root");
			await final();
			assert.equal(receiptCount(), 3);
			assert.equal(state().results.a.summary, observations.restartCut ? (observations.restartCut as { result: { summary: string } }).result.summary : "a reviewed result");
			if (mode === "linked-owner") {
				for (const slug of ["a", "b", "root"]) assert(!existsSync(join(main, slug + ".txt")));
				assert(tracker.text("root").includes("root reviewed result"));
				observations.linked = { owner, canonicalMain: main, mainLacksCode: true, trackerResultsInMain: true };
			}
		}
		console.log("RESULT " + JSON.stringify(observations));
		return observations;
	} finally {
		try { controller.abort(); if (running) await running; }
		finally {
		try {
			const { allThreads } = await import("../../../lib/thread/registry.ts");
			const { abandonThread } = await import("../../../lib/thread/lifecycle.ts");
			for (const thread of await allThreads()) await abandonThread(thread.id);
		} finally {
			process.chdir(originalCwd); process.env = saved;
			rmSync(root, { recursive: true, force: true });
		}
		}
	}
}

if (import.meta.main) {
	const mode = process.argv[2];
	if (!mode || mode === "all") {
		// Fresh module caches as well as separate repos/env for every mode.
		for (const item of modes) {
			const child = Bun.spawn(["bun", import.meta.path, item], { stdout: "inherit", stderr: "inherit" });
			assert.equal(await child.exited, 0, item + " failed");
		}
	} else {
		assert(modes.includes(mode as Mode), "Use collector|restart|close-replay|linked-owner");
		if (mode === "close-replay" && !process.argv[3]) {
			for (const cut of ["delivered", "prepared"]) {
				const child = Bun.spawn(["bun", import.meta.path, mode, cut], { stdout: "inherit", stderr: "inherit" });
				assert.equal(await child.exited, 0, cut + " replay failed");
			}
		} else await ledger(mode as Mode, process.argv[3] as "delivered" | "prepared" | undefined);
	}
}
