import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { thread } from "./cli";
import { newThread } from "./runtime";
import { terminals, zmx } from "./zmx";

// Replays check C2 of docs/attachments/thread-cli-over-registry/index.md: a CLI fork resolves its
// spawning parent through the registry from the current session file or id, whichever is present.
const root = realpathSync(mkdtempSync("/tmp/ab-thread-cli-")); // short: zmx socket paths are length-limited
const saved = { ...process.env };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const repo = join(root, "repo");

async function cli(args: string[], env: Record<string, string | undefined>): Promise<unknown> {
	const write = process.stdout.write.bind(process.stdout);
	let stdout = "";
	process.stdout.write = ((chunk: string) => { stdout += chunk; return true; }) as typeof process.stdout.write;
	const before = { ...process.env };
	for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
	process.exitCode = 0;
	try { await thread(args); } finally { process.stdout.write = write; process.env = before; }
	expect(process.exitCode).toBe(0);
	return JSON.parse(stdout);
}

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root });
	mkdirSync(repo);
	git(repo, "init", "-b", "main");
	git(repo, "config", "user.name", "t");
	git(repo, "config", "user.email", "t@example.invalid");
	writeFileSync(join(repo, "seed"), "seed");
	git(repo, "add", ".");
	git(repo, "commit", "-m", "seed");
});

afterAll(async () => {
	for (const t of await terminals().catch(() => [])) await zmx(["kill", t.name, "--force"]).catch(() => {});
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
});

test("fork records its source thread as parent with a matching id, a bare file, or a stale id", async () => {
	const source = await newThread({ cwd: repo, worktree: "source", launch: { cmd: "sleep 300" } });
	const dest = source.cwd;
	for (const env of [
		{ PI_SESSION_FILE: source.sessionFile, PI_SESSION_ID: source.sessionId },
		{ PI_SESSION_FILE: source.sessionFile, PI_SESSION_ID: undefined },
		{ PI_SESSION_FILE: source.sessionFile, PI_SESSION_ID: "stale-id" },
		{ PI_SESSION_FILE: undefined, PI_SESSION_ID: source.sessionId },
	]) {
		const forked = await cli(["fork", "--in", dest], env) as { parent?: string; ownership: string; cwd: string };
		expect(forked).toMatchObject({ parent: source.id, ownership: "guest", cwd: dest });
	}
}, 60_000);
