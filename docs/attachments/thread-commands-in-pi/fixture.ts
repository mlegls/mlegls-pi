// Disposable first-use surface: real pi commands, isolated thread/board/zmx state.
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { newThread, sendThread, abandonThread } from "../../../lib/thread";
import { allThreads, getThread } from "../../../lib/thread/registry";
import { persistHeader } from "../../../lib/thread/sessions";
import { readLive } from "../../../lib/session-meta/live";
import { zmx } from "../../../lib/thread/zmx";

const [action = "help", target] = process.argv.slice(2);
const packagePath = fileURLToPath(new URL("../../../", import.meta.url));
const selectors = (root: string) => ({ XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), ZMX_DIR: join(root, "zmx"), PI_CODING_AGENT_DIR: join(root, "agent") });
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until<T>(get: () => T | Promise<T>, label: string): Promise<NonNullable<T>> {
	for (let i = 0; i < 120; i++) { const value = await get(); if (value) return value as NonNullable<T>; await sleep(500); }
	throw new Error("Timed out: " + label);
}
function use(root: string) {
	for (const key of Object.keys(process.env))
		if (/^(?:PI_WM_.*|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_SESSION_.*|AB_THREAD_ID|TMUX(?:_PANE)?|ZMX_SESSION)$/.test(key)) delete process.env[key];
	Object.assign(process.env, selectors(root));
}
if (action === "help" || action === "--help") {
	console.log("prepare | smoke ROOT | inspect ROOT | attach ROOT | cleanup ROOT\nprepare launches a canonical pi in an owned temporary Git repository; attach opens its story surface. No model requests are made by smoke. Uses existing local pi auth.");
	process.exit(0);
}
if (action === "prepare") {
	const persona = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent");
	const settings = JSON.parse(await readFile(join(persona, "settings.json"), "utf8"));
	const root = realpathSync(await mkdtemp("/tmp/thread-commands-"));
	const repo = join(root, "repo");
	await mkdir(repo);
	git(repo, "init", "-q", "-b", "main");
	git(repo, "config", "user.name", "Thread commands fixture");
	git(repo, "config", "user.email", "fixture@example.invalid");
	git(repo, "commit", "-q", "--allow-empty", "-m", "fixture");
	await mkdir(join(root, "agent"));
	if (existsSync(join(persona, "auth.json"))) await symlink(join(persona, "auth.json"), join(root, "agent/auth.json"));
	await writeFile(join(root, "agent/settings.json"), JSON.stringify({ packages: [packagePath], defaultProvider: settings.defaultProvider, defaultModel: settings.defaultModel, quietStartup: true }));
	use(root);
	const thread = await newThread({ cwd: repo, in: repo });
	await writeFile(join(root, "fixture.json"), JSON.stringify({ root, repo, thread: thread.id }));
	await until(() => readLive().find(l => l.sessionId === thread.sessionId), "canonical pi ready");
	console.log(JSON.stringify({ root, thread, entrypoint: "mise exec -- bun " + import.meta.path + " attach " + root }));
	process.exit(0);
}
if (!target) throw new Error("Expected ROOT");
const root = realpathSync(target);
const f = JSON.parse(await readFile(join(root, "fixture.json"), "utf8"));
if (f.root !== root || !/^\/(?:private\/)?tmp\/thread-commands-/.test(root)) throw new Error("Not an owned fixture");
use(root);
process.chdir(f.repo);
if (action === "attach") {
	const { attachThread } = await import("../../../lib/thread");
	await attachThread(f.thread);
} else if (action === "inspect") {
	console.log(JSON.stringify({ threads: await allThreads(true), live: readLive(), zmx: await zmx(["ls"]) }));
} else if (action === "smoke") {
	const before = (await getThread(f.thread))!;
	await sendThread(f.thread, "/new\r");
	const moved = await until(async () => {
		const t = await getThread(f.thread);
		return t?.sessionId !== before.sessionId && t;
	}, "/new registry update");
	console.log(JSON.stringify({ event: "new", before, moved }));
	const pid = await until(() => readLive().find(l => l.sessionId === moved.sessionId)?.pid, "new session live");
	await sendThread(f.thread, "/quit\r");
	const restarted = await until(() => readLive().find(l => l.sessionId === moved.sessionId && l.pid !== pid), "restart on moved session");
	console.log(JSON.stringify({ event: "restart", restarted }));
	await sendThread(f.thread, "/thread fork --worktree x\r");
	const fork = await until(async () => (await allThreads()).find(t => t.branch === "x"), "fork worktree x");
	console.log(JSON.stringify({ event: "fork", fork }));
	console.log(JSON.stringify({ event: "tree", output: execFileSync(join(packagePath, "bin/ab"), ["thread", "ls", "--tree", "spawn"], { encoding: "utf8", env: process.env }) }));
	await sendThread(f.thread, "/workspace " + fork.cwd + "\r");
	const workspaceFork = await until(async () => (await allThreads()).find(t => t.id !== fork.id && t.cwd === fork.cwd && t.parent === f.thread), "canonical workspace fork");
	console.log(JSON.stringify({ event: "workspace", workspaceFork, source: await getThread(f.thread) }));
	const free = SessionManager.create(f.repo);
	await persistHeader(free.getSessionFile()!, free.getSessionId(), f.repo);
	await zmx(["run", "free", "-d", "pi", "--session", free.getSessionFile()!]);
	await until(() => readLive().find(l => l.sessionId === free.getSessionId()), "free pi ready");
	await zmx(["send", "free", "/new\r"]);
	await sleep(1500);
	const freeCurrent = await until(() => readLive().find(l => l.pid && l.sessionId !== free.getSessionId() && l.cwd === f.repo && !l.thread), "free /new");
	await zmx(["send", "free", "/thread promote\r"]);
	const promoted = await until(() => getThread(freeCurrent.sessionId), "free promote");
	console.log(JSON.stringify({ event: "promote", promoted }));
} else if (action === "cleanup") {
	await zmx(["kill", "free", "--force"]).catch(() => {});
	for (const t of await allThreads()) await abandonThread(t.id);
	await rm(root, { recursive: true, force: true });
	console.log("Owned fixture removed");
} else throw new Error("Unknown action");
