// Offline first-use trial: real worker setup and reconciler, fake bb CLI in place of the daemon, no model or credentials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getThread, saveThread } from "../../../lib/thread/registry";
import { fakeBb, threads } from "../../../lib/thread/fake-bb";
import { pendingSetup, setupLog, writeSetup } from "../../../lib/thread/setup";
import { start, stop } from "../../../lib/reconcile/main";
import { load } from "../../../lib/reconcile/reconcile";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
async function until<T>(read: () => T | undefined | false, ms = 40_000): Promise<T> {
	for (let i = 0; i < ms / 100; i++) { const value = read(); if (value) return value; await Bun.sleep(100); }
	throw new Error("Fixture timed out");
}
export async function trial() {
	const root = realpathSync(mkdtempSync("/tmp/rc-retry-")), saved = { ...process.env };
	const runs: string[] = [];
	const repo = join(root, "repo"), bin = join(root, "bin"), setupBin = join(root, "setup-bin");
	const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|FAKE_BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"),
			PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"),
			MISE_TRUSTED_CONFIG_PATHS: root, PI_NETWORK_RETRY_MS: "0", PI_RECONCILE_TICK_MS: "100", PI_RECONCILE_ERROR_SETTLE_MS: "0", TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PATH: bin + ":" + saved.PATH });
		const bb = fakeBb(root);
		for (const dir of [repo, bin, setupBin, join(root, "agents/roles")]) mkdirSync(dir, { recursive: true });
		writeFileSync(join(root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
		writeFileSync(join(root, "agents/roles/implement.md"), "Shell fixture.\n");
		git("init", "-qb", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
		mkdirSync(join(repo, "docs/issues"), { recursive: true });
		for (const slug of ["generic", "auth"]) writeFileSync(join(repo, "docs/issues", slug + ".md"), "---\nstage: ticket\nassignee: agent:shell\n---\n\nOffline retry fixture.\n");
		git("add", "."); git("commit", "-qm", "fixture");
		// Run the worker setup directly: it runs before bb starts a worker's pi.
		writeFileSync(join(setupBin, "mise"), "#!/bin/sh\nif [ \"$1\" = tasks ]; then echo '[{\"name\":\"setup\"}]'; exit 0; fi\nn=0; [ ! -f count ] || read n < count\nn=$((n+1)); echo \"$n\" > count\nif [ \"$n\" = 1 ]; then echo \"$FAILURE\" >&2; exit 1; fi\n", { mode: 0o755 });
		for (const [id, failure, success] of [["network", "fetch failed", true], ["nonnetwork", "invalid configuration", false]] as const) {
			const cwd = join(root, id); mkdirSync(cwd);
			await saveThread({ id, sessionId: id, sessionFile: join(cwd, "session.jsonl"), cwd, project: cwd, ownership: "owner",
				archived: false, created: new Date().toISOString(), worker: { run: "setup", handle: id } });
			writeSetup(id, { state: "pending" });
			const path = process.env.PATH, failureEnv = process.env.FAILURE;
			process.env.PATH = setupBin + ":" + path; process.env.FAILURE = failure;
			const code = await pendingSetup((await getThread(id))!).then(() => 0, () => 1).finally(() => { process.env.PATH = path; if (failureEnv === undefined) delete process.env.FAILURE; else process.env.FAILURE = failureEnv; });
			assert.equal(code === 0, success);
			assert.equal(readFileSync(join(cwd, "count"), "utf8").trim(), success ? "2" : "1");
			const log = readFileSync(setupLog(id), "utf8");
			assert.equal((log.match(/retry 1\/2/g) ?? []).length, success ? 1 : 0);
			console.log(JSON.stringify({ story: "setup-" + id, code, started: success, log }));
		}
		const started = (path: string) => threads(join(root, "fake-bb")).some(t => t.environment === path);
		const ownerMail = (slug: string) => threads(join(root, "fake-bb")).find(t => t.id === "thr_" + slug)!.tells.filter(tell => tell.includes("[reconcile " + slug + "]") && tell.includes("provider error"));
		for (const slug of ["generic", "auth"]) {
			runs.push(slug);
			bb.addThread("thr_" + slug);
			start({ cwd: repo, root: slug, owner: "thr_" + slug, budget: 1 });
			const first = await until(() => { const h = load(repo, slug)?.chains[slug]?.handle; return h && started(h.path) && h; });
			// pi ended its turn on the error
			bb.completeTurn(first.path, slug === "auth" ? "authentication invalid_grant" : "Codex error: An error occurred while processing your request", "failed");
			if (slug === "generic") {
				// The first error continues the same worker (its worktree may hold state nothing else has); a repeat gets a fresh one.
				const told = () => threads(join(root, "fake-bb")).find(t => t.environment === first.path)!.tells.some(tell => tell.includes("Continue the assignment where you left off"));
				await until(() => told() && load(repo, slug)?.chains[slug]?.retries.provider === 1);
				assert.equal(load(repo, slug)?.chains[slug]?.handle?.handle, first.handle);
				console.log(JSON.stringify({ story: "generic-first-error-continues", worker: first.handle }));
				bb.completeTurn(first.path, "Codex error: An error occurred while processing your request", "failed");
				const second = await until(() => { const h = load(repo, slug)?.chains[slug]?.handle; return h && h.handle !== first.handle && started(h.path) && h; });
				assert.equal(load(repo, slug)?.chains[slug]?.retries.provider, 2);
				assert.equal(ownerMail(slug).length, 0);
				console.log(JSON.stringify({ story: "generic-second-error", first: first.handle, retry: second.handle, ownerMail: 0 }));
				bb.completeTurn(second.path, "provider failed again", "failed");
			}
			await until(() => ownerMail(slug).length > 0);
			const state = load(repo, slug)!;
			assert.equal(state.chains[slug].handle?.handle === first.handle, slug === "auth");
			assert.equal(state.exceptions[slug].level, "owner");
			console.log(JSON.stringify({ story: slug + "-escalation", reason: state.exceptions[slug].reason, ownerMail: ownerMail(slug).length }));
			await stop(repo, slug);
		}
	} catch (error) {
		console.error(JSON.stringify({ states: runs.map(slug => load(repo, slug)), bb: threads(join(root, "fake-bb")).map(t => ({ id: t.id, title: t.title, tells: t.tells })) }, null, 2));
		throw error;
	} finally {
		for (const slug of runs) if (load(repo, slug) && !load(repo, slug)?.finished) await stop(repo, slug);
		process.env = saved;
		rmSync(root, { recursive: true, force: true });
	}
}
if (import.meta.main) await trial();
