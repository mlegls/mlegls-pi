// Live records: one small JSON file per running pi process, so views (ab tree) can join a
// process to its session file, tmux pane, and working/idle state without scanning processes.
// Written at session start and on each agent start/end; removed at shutdown. Readers must
// check the pid, since a killed process leaves its record behind.

import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Live {
	pid: number;
	sessionId: string;
	sessionFile?: string;
	cwd: string;
	state: "working" | "idle";
	since: string;
	tmuxPane?: string;
	paseoAgent?: string;
}

export function liveDir(): string {
	return join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "pi-live");
}

export function writeLive(record: Live): void {
	const dir = liveDir();
	mkdirSync(dir, { recursive: true });
	const path = join(dir, record.pid + ".json");
	writeFileSync(path + ".tmp", JSON.stringify(record));
	renameSync(path + ".tmp", path);
}

export function removeLive(pid = process.pid): void {
	try { unlinkSync(join(liveDir(), pid + ".json")); } catch {}
}

/** Records whose process is still alive; stale ones are deleted on the way. */
export function readLive(): Live[] {
	const out: Live[] = [];
	let names: string[] = [];
	try { names = readdirSync(liveDir()); } catch { return out; }
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		try {
			const record = JSON.parse(readFileSync(join(liveDir(), name), "utf8")) as Live;
			try { process.kill(record.pid, 0); out.push(record); } catch { removeLive(record.pid); }
		} catch {}
	}
	return out;
}
