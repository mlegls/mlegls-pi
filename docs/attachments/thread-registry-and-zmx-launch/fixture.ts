// Disposable first-use setup for the public thread library, not an acceptance test.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { allThreads, getThread, saveThread, setCurrentSession } from "../../../lib/thread/registry";
import { attachThread, ensureTerminal, forkThread, historyThread, listThreads, newThread, promoteThread, sendThread } from "../../../lib/thread/runtime";
import { persistHeader } from "../../../lib/thread/sessions";
import { terminals, zmx } from "../../../lib/thread/zmx";
import { readLive } from "../../../lib/session-meta/live";

const packagePath = fileURLToPath(new URL("../../../", import.meta.url));
const [action = "prepare", target, id, text] = process.argv.slice(2);
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const literalReader = { cmd: `printf 'READY thread=%s topic=%s run=%s handle=%s\\n' "$AB_THREAD_ID" "$PI_BOARD_TOPIC" "$PI_WM_RUN" "$PI_WM_HANDLE"; read value; printf 'SUBMITTED:%s\\n' "$value"; sleep 300` };
type Fixture = { root: string; env: Record<string, string>; ids: Record<string, string> };

function environment(root: string): Record<string, string> {
	return {
		XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
		PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
		MISE_TRUSTED_CONFIG_PATHS: root,
	};
}
function use(env: Record<string, string>) {
	for (const key of Object.keys(process.env))
		if (/^(?:PI_WM_.*|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_CHECKPOINT|PI_SESSION_.*|AB_THREAD_ID|TMUX(?:_PANE)?|ZMX_SESSION)$/.test(key)) delete process.env[key];
	Object.assign(process.env, env);
}
async function repo(cwd: string, setup: boolean) {
	await mkdir(cwd);
	git(cwd, "init", "-b", "main");
	git(cwd, "config", "user.name", "Thread fixture");
	git(cwd, "config", "user.email", "thread-fixture@example.invalid");
	await writeFile(join(cwd, ".gitignore"), "setup-marker\n");
	if (setup) await writeFile(join(cwd, "mise.toml"), '[tasks.setup]\nrun = "echo setup >> setup-marker"\n');
	git(cwd, "add", ".");
	git(cwd, "commit", "-m", "Thread fixture seed");
}
async function ready(sessionId: string): Promise<void> {
	for (let i = 0; i < 120; i++) {
		if (readLive().some(l => l.sessionId === sessionId && l.state === "idle")) return;
		await wait(500);
	}
	throw new Error("Pi did not reach idle: " + sessionId);
}

if (action === "prepare") {
	const persona = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent");
	const settings = existsSync(join(persona, "settings.json")) ? JSON.parse(await readFile(join(persona, "settings.json"), "utf8")) : {};
	// macOS Unix sockets have a short path limit; do not use its long per-user TMPDIR.
	const root = realpathSync(await mkdtemp("/tmp/ab-thread-fixture-"));
	const fixture: Fixture = { root, env: environment(root), ids: {} };
	use(fixture.env);
	await mkdir(fixture.env.PI_CODING_AGENT_DIR!);
	if (existsSync(join(persona, "auth.json"))) await symlink(join(persona, "auth.json"), join(root, "agent/auth.json"));
	await writeFile(join(root, "agent/settings.json"), JSON.stringify({
		packages: [packagePath], defaultProvider: settings.defaultProvider, defaultModel: settings.defaultModel,
		defaultThinkingLevel: settings.defaultThinkingLevel, defaultTools: ["+codemode"], quietStartup: true,
	}, null, 2));
	await writeFile(join(root, "fixture.json"), JSON.stringify(fixture, null, 2));
	console.log("Owned fixture: " + root);
	try {
		const cwd = join(root, "repo");
		await repo(cwd, true);
		await repo(join(root, "no-setup"), false);
		const owner = await newThread({ cwd, worktree: "owner", worker: { run: "fixture", handle: "owner" }, launch: literalReader });
		fixture.ids.owner = owner.id;
		const canonical = await newThread({ cwd, in: cwd, parent: owner.id, launch: { args: ["--approve"], prompt: "Reply only bootstrap-ok. Do not use tools." } });
		fixture.ids.canonical = canonical.id;
		await ready(canonical.sessionId);
		const guest = await newThread({ cwd, in: owner.cwd, parent: canonical.id, launch: literalReader });
		fixture.ids.guest = guest.id;
		const fork = await forkThread(canonical.sessionId, { cwd: owner.cwd, worktree: "fork", parent: guest.id, launch: { args: ["--approve"] } });
		fixture.ids.fork = fork.id;
		const free = SessionManager.create(cwd);
		await persistHeader(free.getSessionFile()!, free.getSessionId(), cwd);
		fixture.ids.promoted = (await promoteThread(free.getSessionId(), cwd)).id;
		fixture.ids.noSetup = (await newThread({ cwd: join(root, "no-setup"), launch: literalReader })).id;
		await ensureTerminal(owner.id, "server");
		await ready(fork.sessionId);
		await ready(fixture.ids.promoted);
		await writeFile(join(root, "fixture.json"), JSON.stringify(fixture, null, 2));
		console.log(JSON.stringify({
			...fixture, readiness: "Canonical, fork and promoted pi observed idle; shells launched and labelled",
			setupMarker: await readFile(join(owner.cwd, "setup-marker"), "utf8"),
			entry: "bun " + fileURLToPath(import.meta.url) + " inspect " + root,
		}, null, 2));
	} catch (error) {
		await writeFile(join(root, "fixture.json"), JSON.stringify(fixture, null, 2));
		throw new Error("Fixture remains owned at " + root + "; run cleanup " + root + ": " + String(error));
	}
} else {
	if (!target) throw new Error("Expected fixture root: prepare | inspect|attach|send|history|promote|external|switch|cleanup <root> [id] [text]");
	const root = realpathSync(resolve(target));
	const fixture = JSON.parse(await readFile(join(root, "fixture.json"), "utf8")) as Fixture;
	if (fixture.root !== root || !root.startsWith("/private/tmp/ab-thread-fixture-") && !root.startsWith("/tmp/ab-thread-fixture-"))
		throw new Error("Not an owned thread fixture: " + root);
	if (Object.entries(environment(root)).some(([key, value]) => fixture.env[key] !== value)) throw new Error("Fixture selectors no longer address the owned root: " + root);
	use(fixture.env);
	switch (action) {
		case "inspect": console.log(JSON.stringify({ fixture, spawn: await listThreads(), merge: await listThreads({ tree: "merge" }), live: readLive(), zmx: await terminals() }, null, 2)); break;
		case "attach": await attachThread(id!, text ?? "agent"); break;
		case "send": await sendThread(id!, text!); break;
		case "history": console.log(await historyThread(id!, text === undefined ? undefined : Number(text))); break;
		case "promote": console.log(JSON.stringify(await promoteThread(id!, join(root, "repo")), null, 2)); break;
		case "switch": {
			const thread = await getThread(id!);
			if (!thread) throw new Error("Unknown thread: " + id);
			const session = SessionManager.create(thread.cwd);
			await setCurrentSession(thread.id, { id: session.getSessionId(), file: session.getSessionFile()! });
			console.log(JSON.stringify(await getThread(id!), null, 2));
			break;
		}
		case "external": {
			// Run in a second terminal; inspect shows this free pi's exact id for promotion.
			const child = spawn("pi", ["--approve"], { cwd: join(root, "repo"), env: process.env, stdio: "inherit" });
			await new Promise<void>((resolve, reject) => { child.once("error", reject); child.once("exit", () => resolve()); });
			break;
		}
		case "cleanup": {
			const records = await allThreads(true);
			for (const thread of records) await saveThread({ ...thread, archived: true });
			for (const terminal of await terminals()) await zmx(["kill", terminal.name, "--force"]);
			for (const live of readLive()) { try { process.kill(live.pid, "SIGTERM"); } catch {} }
			for (const thread of records) if (thread.ownership === "owner") {
				if (existsSync(thread.cwd)) git(thread.project, "worktree", "remove", "--force", thread.cwd);
				try { git(thread.project, "show-ref", "--verify", "--quiet", "refs/heads/" + thread.branch); }
				catch (error) { if ((error as { status?: number }).status === 1) continue; throw error; }
				git(thread.project, "branch", "-D", thread.branch!);
			}
			console.log(JSON.stringify({ terminals: await terminals(), activeThreads: await allThreads() }));
			await rm(root, { recursive: true, force: true });
			break;
		}
		default: throw new Error("Unknown fixture action: " + action);
	}
}
