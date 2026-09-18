// Resolve a wm worker's pi session file so the parent can /jump into it.
import { basename, resolve } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { SPAWN_META, type SpawnMeta } from "../session-meta";
import { workmuxStatus } from "../../lib/wm";

function workerDir(handle: string, cwd: string, workdir?: string): string {
	return workdir ?? resolve(cwd, "..", `${basename(cwd)}__worktrees`, handle);
}

function spawnMetaOf(path: string): SpawnMeta | undefined {
	try {
		for (const e of SessionManager.open(path).getEntries()) {
			if (e.type === "custom" && e.customType === SPAWN_META) return e.data as SpawnMeta;
		}
	} catch { /* unreadable session */ }
}

/** Child session for `handle` under `cwd`'s worktree layout. Prefers session-meta, then a fork of `parentFile`, then newest. */
export async function childSession(handle: string, cwd: string, parentFile?: string): Promise<string> {
	const live = (await workmuxStatus(cwd)).find((e) => e.worktree === handle);
	const dir = workerDir(handle, cwd, live?.workdir);
	const sessions = (await SessionManager.list(dir)).sort((a, b) => b.modified.getTime() - a.modified.getTime());
	if (!sessions.length) throw new Error(`no pi session for worker ${handle} (${dir})`);
	const named = sessions.find((s) => spawnMetaOf(s.path)?.handle === handle);
	if (named) return named.path;
	if (parentFile) {
		const forked = sessions.find((s) => s.parentSessionPath === parentFile);
		if (forked) return forked.path;
	}
	return sessions[0]!.path;
}
