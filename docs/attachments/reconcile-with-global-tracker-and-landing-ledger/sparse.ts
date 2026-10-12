// Disposable actual-runtime first use. No model calls; every role has one shell stance.
// Run from any cwd: bun /absolute/package/docs/attachments/.../sparse.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Handle } from "../../../lib/dispatch.ts";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
const cli = join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
async function until<T>(read: () => Promise<T | undefined | false> | T | undefined | false): Promise<T> {
	for (let i = 0; i < 400; i++) { const result = await read(); if (result) return result; await Bun.sleep(100); }
	throw new Error("Sparse fixture readiness timeout");
}
export async function sparse() {
	const root = realpathSync(mkdtempSync("/tmp/rc-global-sparse-")), saved = { ...process.env };
	const cwd = join(root, "repo"), bin = join(root, "bin"), agents = join(root, "agents");
	const commit = (path: string, file: string, text: string, sparse = false) => {
		mkdirSync(join(path, file, ".."), { recursive: true }); writeFileSync(join(path, file), text);
		git(path, "add", ...(sparse ? ["--sparse"] : []), "--", file); git(path, "commit", "-qm", file);
	};
	let launched = false;
	let cleanup: (() => Promise<void>) | undefined, diagnose: (() => void) | undefined;
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_.*|AB_.*|BB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
			PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
			PI_AGENTS_DIR: agents, TRACKER_CLI: cli, PI_THREAD_RUNTIME: "zmx", MISE_TRUSTED_CONFIG_PATHS: root,
			PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "3",
			WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'", PATH: bin + ":" + saved.PATH });
		for (const dir of [cwd, bin, join(agents, "roles")]) mkdirSync(dir, { recursive: true });
		writeFileSync(join(bin, "pi"), "#!/bin/sh\ntouch shell-started\nexec sleep 600\n", { mode: 0o755 });
		for (const [name, role] of [["shell", "implement"], ["shell-refine", "refine"], ["shell-drive", "drive"], ["shell-handler", "handle"], ["tidy", "review"]]) {
			writeFileSync(join(agents, name + ".md"), "---\nrole: " + role + "\n---\nNo-model shell fixture.\n");
			writeFileSync(join(agents, "roles", role + ".md"), "No-model shell fixture.\n");
		}
		// agents.ts caches its roster at import: isolate before loading the runtime.
		const { start, stop } = await import("../../../lib/reconcile/main.ts");
		const { load } = await import("../../../lib/reconcile/reconcile.ts");
		const { newThread } = await import("../../../lib/thread/runtime.ts");
		const { allThreads, getThread } = await import("../../../lib/thread/registry.ts");
		const { abandonThread } = await import("../../../lib/thread/lifecycle.ts");
		const { integrate } = await import("../../../lib/dispatch.ts");
		const { getTracker } = await import("../../../lib/tracker.ts");
		const { send } = await import("../../../lib/board/store.ts");
		const report = (h: Handle, status: string, handoff: object) => send({ from: {}, topic: h.run + "/" + h.handle,
			tags: [status], body: status + "\n\n" + "\x60\x60\x60json\n" + JSON.stringify(handoff) + "\n\x60\x60\x60" });
		cleanup = async () => {
			if (launched) await stop(cwd, "root");
			for (const thread of await allThreads()) await abandonThread(thread.id);
		};
		diagnose = () => {
			if (!launched) return;
			const log = join(cwd, ".git/reconcile/root.log");
			console.error(JSON.stringify({ state: load(cwd, "root"), log: existsSync(log) ? readFileSync(log, "utf8") : null }));
		};
		git(cwd, "init", "-qb", "main"); git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
		commit(cwd, "docs/issues/root.md", "---\nstage: spec\nassignee: agent\n---\n\nSparse collector fixture.\n");
		commit(cwd, "docs/issues/child.md", "---\nstage: ticket\nassignee: agent:shell\npart-of: \"[[projects/repo/issues/root]]\"\n---\n\nOriginal global contract.\n");
		commit(cwd, "docs/attachments/packet.md", "# Fixture evidence\n");
		commit(cwd, ".gitignore", "shell-started\nsetup-contract\n");
		commit(cwd, "setup.ts", 'import { writeFileSync } from "node:fs"; import { getTracker } from ' +
			JSON.stringify(join(packagePath, "lib/tracker.ts")) + '; writeFileSync("setup-contract", getTracker(process.cwd()).text("child"));\n');
		commit(cwd, "mise.toml", '[tasks.setup]\nrun = "bun setup.ts"\n');
		start({ cwd, root: "root", owner: "mail/sparse-owner", budget: 1 }); launched = true;
		const first = await until(() => {
			const h = load(cwd, "root")?.chains.child?.handle;
			return h && existsSync(join(h.path, "setup-contract")) && existsSync(join(h.path, "shell-started")) && h;
		});
		const state = load(cwd, "root")!, collector = state.collectors.root;
		assert(collector);
		for (const path of [first.path, collector.path]) {
			assert(!existsSync(join(path, "docs/issues")));
			assert(existsSync(join(path, "docs/attachments/packet.md")));
		}
		const canonical = execFileSync("bun", [cli, "text", "child"], { cwd: first.path, encoding: "utf8" });
		assert(canonical.includes("Original global contract."));
		console.log(JSON.stringify({ story: "sparse", worker: first.handle, workerPath: first.path, collector: collector.path,
			issuesAbsent: true, attachmentsPresent: true, canonicalCliRead: true, setupReady: true }));

		commit(first.path, "child-code.txt", "predecessor code\n");
		const fixedHead = git(first.path, "rev-parse", "HEAD"), tracker = getTracker(first.path, { inflight: false });
		tracker.update("child", {}, "Global ruling one: offline only.\n");
		assert.equal(git(first.path, "rev-parse", "HEAD"), fixedHead);
		report(first, "blocked", { question: "Please resolve through the global contract." });
		const handler = await until(async () => {
			const h = load(cwd, "root")?.exceptions.child?.handler;
			return h && existsSync(join(h.path, "shell-started")) && (await getThread(h.threadId!))?.launch?.prompt?.includes("Global ruling one") && h;
		});
		assert(!existsSync(join(handler.path, "docs/issues")));
		commit(handler.path, "docs/attachments/handler.md", "# Handler code evidence artifact\n");
		const handlerHead = git(handler.path, "rev-parse", "HEAD");
		tracker.update("child", { drive: "none" }, "Global ruling two: drive after landing, no model.\n");
		assert.equal(git(first.path, "rev-parse", "HEAD"), fixedHead);
		report(handler, "done", { resolution: { action: "answer", message: "Continue; ruling is global." } });
		await until(() => !load(cwd, "root")?.exceptions.child);
		report(first, "done", { setup: { kind: "shell" }, stories: [] });
		const successor = await until(async () => {
			const c = load(cwd, "root")?.chains.child, h = c?.handle;
			return c?.phase === "review" && h && existsSync(join(h.path, "setup-contract")) &&
				readFileSync(join(h.path, "setup-contract"), "utf8").includes("Global ruling two") && h;
		});
		const prompt = (await getThread(successor.threadId!))!.launch!.prompt!;
		assert(prompt.includes("Global ruling two"));
		assert(prompt.includes("Drive was skipped"));
		assert(!load(cwd, "root")!.log.some(line => line.includes("(drive,")));
		git(successor.path, "merge-base", "--is-ancestor", fixedHead, "HEAD");
		git(successor.path, "merge-base", "--is-ancestor", handlerHead, "HEAD");
		console.log(JSON.stringify({ story: "fresh-global-contract", workerHeadBeforeAndAfterRulings: fixedHead,
			handlerPrompt: "Global ruling one", successorPromptAndSetup: "Global ruling two",
			driveNone: true, predecessorAncestry: true, collectorAncestry: true }));
		await stop(cwd, "root"); launched = false;

		// Actual newThread owning workers, not hand-registered helper receipts.
		const worker = async (handle: string) => {
			const t = await newThread({ cwd, runtime: "zmx", worktree: handle, worker: { run: "extra", handle },
				launch: { cmd: "sleep 600" }, prepare: async record => {
					assert(!existsSync(join(record.cwd, "docs/issues")));
					assert(existsSync(join(record.cwd, "docs/attachments/packet.md")));
				} });
			return { handle, run: "extra", path: t.cwd, threadId: t.id };
		};
		const bad = await worker("forbidden");
		// Force materialize ONLY this fixture's forbidden file.
		commit(bad.path, "docs/issues/child.md", getTracker(cwd, { inflight: false }).text("child") + "\nForbidden authored mutation.\n", true);
		const destinationBefore = git(cwd, "rev-parse", "HEAD"), sourceBefore = git(bad.path, "rev-parse", "HEAD");
		let refusal = "";
		try { await integrate(bad, { cwd }); } catch (error) { refusal = String(error); }
		assert(refusal.includes("Forbidden tracker changes: docs/issues/child.md"));
		assert.equal(git(cwd, "rev-parse", "HEAD"), destinationBefore);
		assert.equal(git(bad.path, "rev-parse", "HEAD"), sourceBefore);
		assert(existsSync(bad.path)); assert.equal((await getThread(bad.threadId!))!.archived, false);
		const good = await worker("code-only"); commit(good.path, "code-only.txt", "permitted code\n");
		await integrate(good, { cwd });
		assert.equal(readFileSync(join(cwd, "code-only.txt"), "utf8"), "permitted code\n");
		assert.equal((await getThread(good.threadId!))!.archived, true);
		console.log(JSON.stringify({ story: "production-refusal-and-code-landing", refusal, destinationBefore,
			destinationAfterRefusal: destinationBefore, sourceBefore, sourceAfterRefusal: sourceBefore,
			refusedWorkerRetained: true, codeOnlyDestinationAfter: git(cwd, "rev-parse", "HEAD"), codeOnlyWorkerRetired: true }));
		return { sparse: true, freshness: true, refusal: true, codeOnly: true };
	} catch (error) {
		diagnose?.();
		throw error;
	} finally {
		try {
			await cleanup?.();
		} finally { process.env = saved; rmSync(root, { recursive: true, force: true }); }
	}
}
if (import.meta.main) console.log("RESULT " + JSON.stringify(await sparse()));
