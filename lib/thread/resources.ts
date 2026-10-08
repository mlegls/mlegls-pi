import { execFile } from "node:child_process";
import { command } from "./process";
import type { ThreadRecord } from "./types";

const inside = (cwd: string, root: string) => cwd === root || cwd.startsWith(root + "/");

async function cwdInventory(): Promise<Map<number, string>> {
	const listing = await new Promise<string>((resolve, reject) => {
		execFile("lsof", ["-d", "cwd", "-Fpn"], { encoding: "utf8", maxBuffer: 64 << 20 }, (error, out) => {
			if (error && error.code !== 1) reject(error); else resolve(out);
		});
	});
	const out = new Map<number, string>();
	let pid = 0;
	for (const line of listing.split("\n")) {
		if (line.startsWith("p")) pid = Number(line.slice(1));
		else if (line.startsWith("n") && pid) out.set(pid, line.slice(1));
	}
	return out;
}

export async function cwdProcesses(root: string): Promise<number[]> {
	return [...await cwdInventory()].filter(([, cwd]) => inside(cwd, root)).map(([pid]) => pid);
}

/** Workspace census includes runner infrastructure and dev servers, even after pi has died.
 * RSS is a rough sum (shared pages can be counted twice), not a memory-pressure measurement. */
export interface WorkspaceResources { processes: number; rssMB: number }
export async function workerResources(threads: ThreadRecord[]): Promise<Map<string, WorkspaceResources>> {
	const workers = threads.filter(t => t.worker && t.ownership === "owner" && t.worktree);
	if (!workers.length) return new Map();
	const [cwds, listing] = await Promise.all([cwdInventory(), command("ps", ["-axo", "pid=,rss="])]);
	const rss = new Map(listing.trim().split("\n").map(row => row.trim().split(/\s+/).map(Number) as [number, number]));
	return new Map(workers.map(t => {
		const pids = [...cwds].filter(([, cwd]) => inside(cwd, t.worktree!)).map(([pid]) => pid);
		return [t.id, { processes: pids.length, rssMB: Math.round(pids.reduce((sum, pid) => sum + (rss.get(pid) ?? 0), 0) / 1024) }];
	}));
}
