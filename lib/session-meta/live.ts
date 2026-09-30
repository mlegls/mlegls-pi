// Live records: one small JSON file per running pi process, so views (ab tree) can join a
// process to its session file, tmux pane, and working/idle state without scanning processes.
// Session-meta updates state on agent start/end; the board keeps its subscription snapshot here too.
// check the pid, since a killed process leaves its record behind.

import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { boardDir } from "../board/store";

export interface BoardSubscription {
	topic: string;
	tags?: string;
	wake: boolean;
}

export interface Live {
	pid: number;
	sessionId: string;
	parentSession?: string;
	sessionFile?: string;
	cwd: string;
	state: "working" | "idle";
	since: string;
	tmuxPane?: string;
	mode?: "tui" | "rpc" | "json" | "print";
	subscriptions?: BoardSubscription[];
	/** Store whose board host registered these subscriptions. */
	boardDir?: string;
}

export function liveDir(): string {
	return join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "pi-live");
}

export function writeLive(record: Live): void {
	const dir = liveDir();
	mkdirSync(dir, { recursive: true });
	const path = join(dir, record.pid + ".json");
	let next = record;
	if (record.subscriptions === undefined) {
		// Session-meta state writes preserve the board host's last subscription snapshot.
		try {
			const previous = JSON.parse(readFileSync(path, "utf8")) as Live;
			if (previous.subscriptions) next = { ...record, subscriptions: previous.subscriptions, boardDir: previous.boardDir };
		} catch {}
	}
	writeFileSync(path + ".tmp", JSON.stringify(next));
	renameSync(path + ".tmp", path);
}

export function writeLiveSubscriptions(sessionId: string, cwd: string, subscriptions: BoardSubscription[], pid = process.pid): void {
	const path = join(liveDir(), pid + ".json");
	let previous: Partial<Live> = {};
	try { previous = JSON.parse(readFileSync(path, "utf8")) as Live; } catch {}
	writeLive({
		...previous,
		pid,
		sessionId,
		cwd,
		state: previous.state ?? "idle",
		since: previous.since ?? new Date().toISOString(),
		subscriptions,
		boardDir: resolve(boardDir()),
	});
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
