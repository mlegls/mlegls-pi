// One child pi at a time. Exiting pi leaves the thread active; restarting never resubmits its bootstrap.
import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { readLive } from "../session-meta/live";
import { getThread, threadDir } from "./registry";
import { isPiLaunch, launchEnv, validateLaunch } from "./launch";
import { delay, quote } from "./process";
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
	if (prompt !== undefined) args.push("--", prompt);
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
}

async function run(id: string): Promise<void> {
	while (true) {
		const thread = await getThread(id);
		if (!thread || thread.archived) return;
		// Promotion of an already-running canonical pi is registration, not a concurrent writer.
		if (isPiLaunch(thread.launch) && readLive().some(l => l.sessionId === thread.sessionId)) {
			await delay(500);
			continue;
		}
		await child(thread, await bootstrap(thread));
		if (!isPiLaunch(thread.launch)) return;
		await delay(500);
	}
}

if (import.meta.main) await run(process.argv[2]!);
