// Offline first-use trial: real admitted runner and reconciler, shell pi substitute, no model or credentials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { saveThread } from "../../../lib/thread/registry";
import { setupLog, writeSetup } from "../../../lib/thread/setup";
import { start, stop } from "../../../lib/reconcile/main";
import { load } from "../../../lib/reconcile/reconcile";
import { send, readFrom } from "../../../lib/board/store";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
async function until<T>(read: () => T | undefined | false, ms = 40_000): Promise<T> {
	for (let i = 0; i < ms / 100; i++) { const value = read(); if (value) return value; await Bun.sleep(100); }
	throw new Error("Fixture timed out");
}
export async function trial() {
	const root = realpathSync(mkdtempSync("/tmp/rc-retry-")), saved = { ...process.env };
	const runs: string[] = [], children: ReturnType<typeof Bun.spawn>[] = [];
	const repo = join(root, "repo"), bin = join(root, "bin"), setupBin = join(root, "setup-bin");
	const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
			PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"), ZMX_DIR: join(root, "zmx"),
			PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "2", WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'",
			MISE_TRUSTED_CONFIG_PATHS: root, PI_RECONCILE_ERROR_SETTLE_MS: "0", PI_THREAD_RUNTIME: "zmx", TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PATH: bin + ":" + saved.PATH });
		for (const dir of [repo, bin, setupBin, join(root, "agents/roles")]) mkdirSync(dir, { recursive: true });
		writeFileSync(join(bin, "pi"), "#!/bin/sh\ntouch shell-started\nexec sleep 120\n", { mode: 0o755 });
		writeFileSync(join(root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
		writeFileSync(join(root, "agents/roles/implement.md"), "Shell fixture.\n");
		git("init", "-qb", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
		mkdirSync(join(repo, "docs/issues"), { recursive: true });
		for (const slug of ["generic", "auth"]) writeFileSync(join(repo, "docs/issues", slug + ".md"), "---\nstage: ticket\nassignee: agent:shell\n---\n\nOffline retry fixture.\n");
		writeFileSync(join(repo, ".gitignore"), "shell-started\n");
		git("add", "."); git("commit", "-qm", "fixture");
		// Run the admitted entry directly: no host slots or terminal UI are needed to try setup.
		writeFileSync(join(setupBin, "mise"), "#!/bin/sh\nif [ \"$1\" = tasks ]; then echo '[{\"name\":\"setup\"}]'; exit 0; fi\nn=0; [ ! -f count ] || read n < count\nn=$((n+1)); echo \"$n\" > count\nif [ \"$n\" = 1 ]; then echo \"$FAILURE\" >&2; exit 1; fi\n", { mode: 0o755 });
		for (const [id, failure, success] of [["network", "fetch failed", true], ["nonnetwork", "invalid configuration", false]] as const) {
			const cwd = join(root, id); mkdirSync(cwd);
			await saveThread({ id, sessionId: id, sessionFile: join(cwd, "session.jsonl"), cwd, project: cwd, ownership: "owner",
				archived: false, created: new Date().toISOString(), worker: { run: "setup", handle: id }, launch: { cmd: "touch worker-started" } });
			writeSetup(id, { state: "pending" });
			const child = Bun.spawn(["bun", join(packagePath, "lib/thread/agent-runner.ts"), id, "--admitted"], {
				env: { ...process.env, PATH: setupBin + ":" + process.env.PATH, FAILURE: failure }, stdout: "pipe", stderr: "pipe" });
			children.push(child);
			const code = await child.exited;
			assert.equal(code === 0, success);
			assert.equal(existsSync(join(cwd, "worker-started")), success);
			assert.equal(readFileSync(join(cwd, "count"), "utf8").trim(), success ? "2" : "1");
			const log = readFileSync(setupLog(id), "utf8");
			assert.equal((log.match(/retry 1\/2/g) ?? []).length, success ? 1 : 0);
			console.log(JSON.stringify({ story: "setup-" + id, code, started: success, log }));
		}
		const ownerMail = (slug: string) => readFrom(0).messages.filter(m => (m.topic === "mail/" + slug || m.topic === "role/repo/supervisor") && m.body.includes("[reconcile " + slug + "]") && m.body.includes("provider error"));
		for (const slug of ["generic", "auth"]) {
			runs.push(slug);
			start({ cwd: repo, root: slug, owner: "mail/" + slug, budget: 1 });
			const first = await until(() => { const h = load(repo, slug)?.chains[slug]?.handle; return h && existsSync(join(h.path, "shell-started")) && h; });
			send({ from: {}, topic: slug + "/" + first.handle, tags: ["turn-end", "error"], body: slug === "auth" ? "error: authentication invalid_grant" : "Codex error: An error occurred while processing your request" });
			if (slug === "generic") {
				const second = await until(() => { const h = load(repo, slug)?.chains[slug]?.handle; return h && h.handle !== first.handle && existsSync(join(h.path, "shell-started")) && h; });
				assert.equal(load(repo, slug)?.chains[slug]?.retries.provider, 1);
				assert.equal(ownerMail(slug).length, 0);
				console.log(JSON.stringify({ story: "generic-first-error", first: first.handle, retry: second.handle, ownerMail: 0 }));
				send({ from: {}, topic: slug + "/" + second.handle, tags: ["turn-end", "error"], body: "error: provider failed again" });
			}
			await until(() => ownerMail(slug).length > 0);
			const state = load(repo, slug)!;
			assert.equal(state.chains[slug].handle?.handle === first.handle, slug === "auth");
			assert.equal(state.exceptions[slug].level, "owner");
			console.log(JSON.stringify({ story: slug + "-escalation", reason: state.exceptions[slug].reason, ownerMail: ownerMail(slug).length }));
			await stop(repo, slug);
		}
	} catch (error) {
		console.error(JSON.stringify({ states: runs.map(slug => load(repo, slug)), board: readFrom(0).messages }, null, 2));
		throw error;
	} finally {
		for (const child of children) if (child.exitCode === null) { child.kill(); await child.exited; }
		for (const slug of runs) if (load(repo, slug) && !load(repo, slug)?.finished) await stop(repo, slug);
		process.env = saved;
		rmSync(root, { recursive: true, force: true });
	}
}
if (import.meta.main) await trial();
