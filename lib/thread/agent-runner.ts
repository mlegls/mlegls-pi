// One child pi at a time. Exiting pi leaves the thread active; restarting never resubmits its bootstrap.
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { transientNetworkError, networkRetryDelay } from "../retry";
import { open } from "node:fs/promises";
import { clearSetup, declaresSetup, readSetup, setupLog, writeSetup } from "./setup";
import { join } from "node:path";
import { readLive } from "../session-meta/live";
import { getThread, threadDir } from "./registry";
import { isPiLaunch, launchEnv, validateLaunch } from "./launch";
import { delay, quote } from "./process";
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
	const log = setupLog(thread.id);
	writeFileSync(log, "");
	const out = openSync(log, "a");
	const setup = async () => {
		try {
			for (let attempt = 0; ; attempt++) {
				const offset = statSync(log).size;
				const code = await new Promise<number | null>((resolve, reject) => {
					const proc = spawn("mise", ["run", "setup"], { cwd: thread.cwd, env: launchEnv(thread), stdio: ["ignore", out, out] });
					proc.once("error", reject);
					proc.once("exit", resolve);
					if (proc.pid) writeSetup(thread.id, { state: "running", pid: proc.pid, log });
				});
				// Inspect only this attempt: an earlier network error must not retry a later non-network failure.
				if (thread.worker && code !== 0 && attempt < 2 && transientNetworkError(readFileSync(log).subarray(offset).toString())) {
					const wait = networkRetryDelay(attempt);
					appendFileSync(log, "\nWorker setup network error; retry " + (attempt + 1) + "/2 in " + wait / 1000 + "s\n");
					await delay(wait);
					continue;
				}
				writeSetup(thread.id, { state: "done", code, log });
				if (thread.worker && code !== 0) throw new Error("Worker setup failed: " + code + " (see " + log + ")");
				return;
			}
		} catch (error) {
			if (readSetup(thread.id)?.state !== "done") writeSetup(thread.id, { state: "done", code: -1, log });
			throw error;
		} finally { closeSync(out); }
	};
	if (thread.worker) await setup();
	else void setup().catch(() => {});
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
		if (thread.worker) await workerSlot(id, async () => {
			await waitForMemory(id);
			const current = await getThread(id);
			if (!current || current.archived) return;
			await pendingSetup(current);
			await child(current, await bootstrap(current));
		});
		else await child(thread, await bootstrap(thread));
		if (!isPiLaunch(thread.launch)) return;
		await delay(500);
	}
}

if (import.meta.main) {
	await run(process.argv[2]!);
}
