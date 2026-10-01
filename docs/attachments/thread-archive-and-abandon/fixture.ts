// Disposable lifecycle starting state and library entry points; not an acceptance test.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { abandonThread, archiveThread, integrateThread, ThreadMergeConflict } from "../../../lib/thread/lifecycle";
import { allThreads, getThread, setCurrentSession } from "../../../lib/thread/registry";
import { ensureTerminal, historyThread, listThreads, newThread, promoteThread } from "../../../lib/thread/runtime";
import { persistHeader } from "../../../lib/thread/sessions";
import { readLive } from "../../../lib/session-meta/live";
import { logSize, read, readFrom } from "../../../lib/board/store";
import { mail } from "../../../lib/board/mailbox";
import { terminals, zmx } from "../../../lib/thread/zmx";

const packagePath = fileURLToPath(new URL("../../../", import.meta.url));
const [action = "help", target, selector, text] = process.argv.slice(2);
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Fixture = { root: string; env: Record<string, string>; ids: Record<string, string>; peerPid?: number; leftoverPid?: number; mainHead?: string; response: "done" | "blocked" };
function environment(root: string): Record<string, string> {
	return { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), ZMX_DIR: join(root, "zmx"),
		PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root };
}
function use(env: Record<string, string>) {
	for (const key of Object.keys(process.env))
		if (/^(?:PI_WM_.*|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_CHECKPOINT|PI_SESSION_.*|AB_THREAD_ID|TMUX(?:_PANE)?|ZMX_SESSION)$/.test(key)) delete process.env[key];
	Object.assign(process.env, env);
}
async function commit(cwd: string, file: string, value: string) {
	await writeFile(join(cwd, file), value + "\n");
	git(cwd, "add", file); git(cwd, "commit", "-m", file);
}
async function ready(id: string) {
	for (let i = 0; i < 180; i++) {
		const thread = await getThread(id);
		const topic = thread?.worker ? thread.worker.run + "/" + thread.worker.handle : "thread/" + id;
		if (thread && readLive().some(l => l.sessionId === thread.sessionId && l.state === "idle") &&
			read({ topic, tags: "done", limit: Infinity }).messages.some(m => m.from.session === thread.sessionId)) return;
		await wait(500);
	}
	throw new Error("Canonical pi did not complete fixture-ready: " + id);
}
async function inspect(fixture: Fixture) {
	const cwd = join(fixture.root, "repo");
	return { fixture, threads: await allThreads(true), spawn: await listThreads(), zmx: await terminals(), live: readLive(),
		mainHead: git(cwd, "rev-parse", "HEAD"), conflict: await readFile(join(cwd, "conflict.txt"), "utf8"),
		worktrees: git(cwd, "worktree", "list", "--porcelain"), branches: git(cwd, "branch", "--list"),
		leftoverAlive: fixture.leftoverPid ? (() => { try { process.kill(fixture.leftoverPid!, 0); return true; } catch { return false; } })() : undefined,
		board: read({ limit: Infinity }).messages, peerAlive: fixture.peerPid ? (() => { try { process.kill(fixture.peerPid!, 0); return true; } catch { return false; } })() : undefined };
}
const help = `mise exec -- bun docs/attachments/thread-archive-and-abandon/fixture.ts prepare [done|blocked]
bun docs/attachments/thread-archive-and-abandon/fixture.ts inspect <root>
bun docs/attachments/thread-archive-and-abandon/fixture.ts archive <root> [parent|guest|id]
bun docs/attachments/thread-archive-and-abandon/fixture.ts abandon <root> [abandon|guest|id] [keep]
bun docs/attachments/thread-archive-and-abandon/fixture.ts integrate <root> <id> [rebase|merge]
bun docs/attachments/thread-archive-and-abandon/fixture.ts resolve <root> [child|id]
bun docs/attachments/thread-archive-and-abandon/fixture.ts mail <root> <id> <text>
bun docs/attachments/thread-archive-and-abandon/fixture.ts history <root> <id>
bun docs/attachments/thread-archive-and-abandon/fixture.ts switch <root> <id>
bun docs/attachments/thread-archive-and-abandon/fixture.ts external <root>
bun docs/attachments/thread-archive-and-abandon/fixture.ts cleanup <root>`;

if (action === "help" || action === "--help" || action === "-h") {
	console.log(help);
} else if (action === "prepare") {
	if (target !== undefined && target !== "done" && target !== "blocked") throw new Error(help);
	const persona = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent");
	const settings = existsSync(join(persona, "settings.json")) ? JSON.parse(await readFile(join(persona, "settings.json"), "utf8")) : {};
	const root = realpathSync(await mkdtemp("/tmp/ab-lifecycle-"));
	const fixture: Fixture = { root, env: environment(root), ids: {}, response: target ?? "done" };
	use(fixture.env);
	await mkdir(fixture.env.PI_CODING_AGENT_DIR!);
	if (existsSync(join(persona, "auth.json"))) await symlink(join(persona, "auth.json"), join(root, "agent/auth.json"));
	await writeFile(join(root, "agent/settings.json"), JSON.stringify({
		packages: [packagePath], defaultProvider: settings.defaultProvider, defaultModel: settings.defaultModel,
		defaultThinkingLevel: settings.defaultThinkingLevel, defaultTools: ["+codemode"], quietStartup: true,
	}, null, 2));
	const persist = () => writeFile(join(root, "fixture.json"), JSON.stringify(fixture, null, 2));
	await persist();
	console.log("Owned fixture: " + root);
	try {
		const cwd = join(root, "repo"); await mkdir(cwd);
		git(cwd, "init", "-b", "main"); git(cwd, "config", "user.name", "Lifecycle fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
		await commit(cwd, "conflict.txt", "seed");
		fixture.mainHead = git(cwd, "rev-parse", "HEAD");
		const launch = { args: ["--approve"], prompt: "This is a disposable lifecycle fixture. Reply only done fixture-ready. Do not use tools." };
		const parent = await newThread({ cwd, worktree: "parent", launch });
		fixture.ids.parent = parent.id; await persist(); await ready(parent.id);
		// Already-retired descendants must remain retired after a later sibling blocks.
		const early = await newThread({ cwd: parent.cwd, worktree: "early", parent: parent.id, launch });
		fixture.ids.early = early.id; await persist(); await ready(early.id); await commit(early.cwd, "early.txt", "early");
		const instructions = fixture.response === "blocked"
			? "This is a disposable fixture. When an archive conflict request arrives, do not change any files or run git. Reply blocked fixture-awaits-manual-resolution."
			: "This is a disposable fixture. When an archive conflict request arrives, rebase onto its named parent. Resolve conflict.txt by keeping the single line resolved-child. Use GIT_EDITOR=true for rebase --continue. Commit any resolution and report done. Do not retire/archive threads or change anything else.";
		const child = await newThread({ cwd: parent.cwd, worktree: "child", parent: parent.id,
			worker: { run: "lifecycle-fixture", handle: "child" }, launch: { ...launch, args: ["--approve", "--append-system-prompt", instructions] } });
		fixture.ids.child = child.id; await persist(); await ready(child.id);
		await commit(child.cwd, "conflict.txt", "child");
		await commit(parent.cwd, "conflict.txt", "parent");
		await ensureTerminal(child.id, "server");
		// Detached process exercises the cwd sweep after zmx closes.
		const leftover = spawn("sleep", ["3600"], { cwd: child.cwd, detached: true, stdio: "ignore" }); leftover.unref();
		fixture.leftoverPid = leftover.pid; await persist();
		const abandon = await newThread({ cwd, worktree: "abandon", launch });
		fixture.ids.abandon = abandon.id; await persist(); await ready(abandon.id);
		const nested = await newThread({ cwd: abandon.cwd, worktree: "abandon-child", parent: abandon.id, launch });
		fixture.ids.abandonChild = nested.id; await persist(); await ready(nested.id); await commit(nested.cwd, "unmerged.txt", "must not merge");
		const guest = await newThread({ cwd, in: cwd, launch });
		fixture.ids.guest = guest.id; await persist(); await ready(guest.id); await ensureTerminal(guest.id, "server");
		const peer = spawn("sleep", ["3600"], { cwd, detached: true, stdio: "ignore" }); peer.unref(); fixture.peerPid = peer.pid; await persist();
		console.log(JSON.stringify({ ...await inspect(fixture), readiness: "Parent, child and guest canonical pi completed fixture-ready; tracked conflict prepared",
			conflictFile: "conflict.txt", entry: "bun " + fileURLToPath(import.meta.url) + " archive " + root + " parent" }, null, 2));
	} catch (error) {
		await persist();
		throw new Error("Owned fixture remains at " + root + "; cleanup it with the command in --help: " + String(error));
	}
} else {
	if (!target) throw new Error(help);
	const root = realpathSync(resolve(target));
	const fixture = JSON.parse(await readFile(join(root, "fixture.json"), "utf8")) as Fixture;
	if (fixture.root !== root || !root.startsWith("/private/tmp/ab-lifecycle-") && !root.startsWith("/tmp/ab-lifecycle-") ||
		Object.entries(environment(root)).some(([key, value]) => fixture.env[key] !== value)) throw new Error("Not an owned lifecycle fixture: " + root);
	use(fixture.env);
	const id = fixture.ids[selector ?? (action === "abandon" ? "abandon" : "parent")] ?? selector!;
	switch (action) {
		case "inspect": console.log(JSON.stringify(await inspect(fixture), null, 2)); break;
		case "archive": {
			let cursor = logSize();
			const poll = setInterval(() => {
				const batch = readFrom(cursor); cursor = batch.offset;
				for (const message of batch.messages) console.log(JSON.stringify({ event: "board", message }));
			}, 250);
			try { console.log(JSON.stringify({ cleanup: await archiveThread(id), after: await inspect(fixture) }, null, 2)); }
			finally { clearInterval(poll); }
			break;
		}
		case "abandon": console.log(JSON.stringify({ cleanup: await abandonThread(id, { keepBranch: text === "keep" }), after: await inspect(fixture) }, null, 2)); break;
		case "integrate": {
			try { console.log(JSON.stringify(await integrateThread(id, { mode: text === "merge" ? "merge" : "rebase" }), null, 2)); }
			catch (error) {
				if (!(error instanceof ThreadMergeConflict)) throw error;
				console.log(JSON.stringify({ conflict: { threadId: error.threadId, branch: error.branch, parentBranch: error.parentBranch, files: error.files } }, null, 2));
			}
			break;
		}
		case "resolve": {
			const child = await getThread(id);
			if (!child || !child.branch) throw new Error("Unknown child: " + id);
			const parent = git(child.project, "config", "--get", "branch." + child.branch + ".ab-parent");
			try { git(child.cwd, "merge", "--no-edit", parent); }
			catch {
				await writeFile(join(child.cwd, "conflict.txt"), "resolved-child\n"); git(child.cwd, "add", "conflict.txt"); git(child.cwd, "commit", "-m", "Resolve fixture conflict");
			}
			console.log(JSON.stringify({ id, branch: child.branch, parent, status: git(child.cwd, "status", "--porcelain") }));
			break;
		}
		case "mail": console.log(mail((await getThread(id))!.sessionId, text!)); break;
		case "history": console.log(await historyThread(id, 60)); break;
		case "switch": {
			const thread = (await getThread(id))!;
			const session = SessionManager.create(thread.cwd); await persistHeader(session.getSessionFile()!, session.getSessionId(), thread.cwd);
			await setCurrentSession(id, { id: session.getSessionId(), file: session.getSessionFile()! });
			console.log(JSON.stringify(await getThread(id), null, 2)); break;
		}
		case "external": {
			// A real canonical pi open outside zmx; promotion must not create a concurrent writer.
			const cwd = join(root, "repo"), session = SessionManager.create(cwd);
			await persistHeader(session.getSessionFile()!, session.getSessionId(), cwd);
			const pi = spawn("pi", ["--approve", "--mode", "rpc", "--session", session.getSessionFile()!],
				{ cwd, env: process.env, detached: true, stdio: ["pipe", "ignore", "ignore"] });
			try {
				let ready = false;
				for (let i = 0; i < 120; i++) {
					if (readLive().some(l => l.pid === pi.pid && l.sessionId === session.getSessionId())) { ready = true; break; }
					await wait(250);
				}
				if (!ready) throw new Error("External canonical pi did not start");
				const guest = await promoteThread(session.getSessionId(), cwd);
				console.log(JSON.stringify({ id: guest.id, externalPid: pi.pid, before: readLive(),
					cleanup: await archiveThread(guest.id), after: readLive(), peerAlive: (await inspect(fixture)).peerAlive }, null, 2));
			} finally { pi.stdin.end(); if (pi.pid) { try { process.kill(pi.pid, "SIGTERM"); } catch {} } }
			break;
		}
		case "cleanup":
			for (const thread of await allThreads()) if (!thread.parent || !(await getThread(thread.parent)) || (await getThread(thread.parent))!.archived) await abandonThread(thread.id);
			for (const terminal of await terminals()) await zmx(["kill", terminal.name, "--force"]);
			if (fixture.peerPid) { try { process.kill(fixture.peerPid, "SIGTERM"); } catch {} }
			console.log(JSON.stringify({ active: await allThreads(), zmx: await terminals(), live: readLive() }));
			await rm(root, { recursive: true, force: true }); break;
		default: throw new Error(help);
	}
}
