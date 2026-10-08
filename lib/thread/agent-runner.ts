// One child pi at a time. Exiting pi leaves the thread active; restarting never resubmits its bootstrap.
import { spawn } from "node:child_process";
import { openSync, rmSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { clearSetup, declaresSetup, readSetup, setupLog, writeSetup } from "./setup";
import { join } from "node:path";
import { readLive } from "../session-meta/live";
import { getThread, threadDir } from "./registry";
import { isPiLaunch, launchEnv, validateLaunch } from "./launch";
import { delay, executable, quote } from "./process";
import { waitForMemory, workerSlot } from "./admission";
import type { ThreadRecord } from "./types";

async function bootstrap(thread: ThreadRecord): Promise<string | undefined> {
	try {
		const fd = await open(join(threadDir(), thread.id + ".started"), "wx", 0o600);
		await fd.close();
		return thread.launch?.prompt;
	} catch (error) {
		if ((error as { code?: string }).code !== "EEXIST") throw error;
	}
}

async function child(thread: ThreadRecord, prompt?: string): Promise<void> {
	const launch = thread.launch;
	validateLaunch(launch);
	const args = [...(launch?.args ?? []), "--session", thread.sessionFile];
	// The prompt goes in as a file, not argv: argv is visible host-wide, and a `pkill -f` matching a phrase from a ticket killed workers.
	let file: string | undefined;
	if (prompt !== undefined) {
		file = join(threadDir(), thread.id + ".prompt.md");
		writeFileSync(file, prompt, { mode: 0o600 });
		args.push("--", "@" + file);
	}
	const env = launchEnv(thread);
	// Keep the current terminal's zmx identity for explicit attach/switch inside pi.
	env.ZMX_SESSION = process.env.ZMX_SESSION;
	const cmd = launch?.cmd;
	const pi = isPiLaunch(launch);
	const bin = cmd === undefined ? "pi" : "/bin/sh";
	const argv = cmd === undefined ? args : ["-c", pi ? cmd + " " + args.map(quote).join(" ") : cmd];
	await new Promise<void>((resolve, reject) => {
		const proc = spawn(bin, argv, { cwd: thread.cwd, env, stdio: "inherit" });
		proc.once("error", reject);
		proc.once("exit", () => resolve());
	});
	// The session holds the prompt once pi has run; a restart never resubmits it.
	if (file) rmSync(file, { force: true });
}

/** Pending setup starts beside the first pi, its output in a log; the workspace extension reports it at pi's next turn. */
async function pendingSetup(thread: ThreadRecord): Promise<void> {
	if (readSetup(thread.id)?.state !== "pending") return;
	if (!await declaresSetup(thread.cwd)) return void await clearSetup(thread.id);
	const log = setupLog(thread.id), out = openSync(log, "w");
	const proc = spawn("mise", ["run", "setup"], { cwd: thread.cwd, env: launchEnv(thread), stdio: ["ignore", out, out] });
	proc.once("error", () => writeSetup(thread.id, { state: "done", code: -1, log }));
	proc.once("exit", code => writeSetup(thread.id, { state: "done", code, log }));
	if (proc.pid) writeSetup(thread.id, { state: "running", pid: proc.pid, log });
	if (thread.worker) await new Promise<void>((resolve, reject) => {
		proc.once("error", reject);
		proc.once("exit", code => code === 0 ? resolve() : reject(new Error("Worker setup failed: " + code + " (see " + log + ")")));
	});
}

async function run(id: string): Promise<void> {
	const first = await getThread(id);
	if (first && !first.archived && !first.worker) await pendingSetup(first);
	while (true) {
		const thread = await getThread(id);
		if (!thread || thread.archived) return;
		// Promotion of an already-running canonical pi is registration, not a concurrent writer.
		if (isPiLaunch(thread.launch) && readLive().some(l => l.sessionId === thread.sessionId)) {
			await delay(500);
			continue;
		}
		if (thread.worker) await workerSlot(id, [executable("bun"), import.meta.path, id, "--admitted"]);
		else await child(thread, await bootstrap(thread));
		if (!isPiLaunch(thread.launch)) return;
		await delay(500);
	}
}

if (import.meta.main) {
	const id = process.argv[2]!;
	if (process.argv[3] === "--admitted") {
		await waitForMemory(id);
		const thread = await getThread(id);
		if (thread && !thread.archived) {
			await pendingSetup(thread);
			await child(thread, await bootstrap(thread));
		}
	} else await run(id);
}
