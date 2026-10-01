import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { markRetired, readLive, type Live } from "../session-meta/live";
import { getThread, saveThread } from "./registry";
import { gitAttempt, gitChecked, worktrees } from "./lifecycle-git";
import { command, delay } from "./process";
import { terminals, zmx } from "./zmx";
import type { ThreadCleanup, ThreadRecord } from "./types";

const inside = (cwd: string, root: string) => cwd === root || cwd.startsWith(root + "/");
const alive = (pid: number) => {
	try { process.kill(pid, 0); return true; }
	catch (error) { if ((error as { code?: string }).code === "ESRCH") return false; throw error; }
};

async function cwdProcesses(root: string): Promise<number[]> {
	// Discover before removing the worktree: no trash-directory naming assumption.
	const listing = await new Promise<string>((resolve, reject) => {
		execFile("lsof", ["-d", "cwd", "-Fpn"], { encoding: "utf8", maxBuffer: 64 << 20 }, (error, out) => {
			if (error && error.code !== 1) reject(error); else resolve(out);
		});
	});
	const pids: number[] = [];
	let pid = 0;
	for (const line of listing.split("\n")) {
		if (line.startsWith("p")) pid = Number(line.slice(1));
		else if (line.startsWith("n") && pid && inside(line.slice(1), root)) pids.push(pid);
	}
	return pids;
}

export async function retireThread(thread: ThreadRecord, keepBranch: boolean): Promise<ThreadCleanup> {
	const result: ThreadCleanup = { closed: [], killed: [], branchesDeleted: [], branchesKept: [] };
	const owned = thread.ownership === "owner";
	let root: string | undefined;
	if (owned) {
		if (!thread.worktree) throw new Error("Refusing to remove an owner without a linked worktree: " + thread.id);
		root = resolve(thread.worktree);
		if (root === "/" || root === resolve(thread.project)) throw new Error("Refusing to remove main checkout: " + root);
		const entry = (await worktrees(thread.project)).find(t => t.path === root);
		if (entry && entry.branch !== thread.branch) throw new Error("Owned worktree has a different branch: " + root);
		// Resolve aliases before matching lsof cwd paths.
		if (entry) root = realpathSync(root);
	}
	const inventory = await terminals();
	const named = inventory.filter(t => t.thread === thread.id || t.name.startsWith(thread.id + "."));
	if (named.some(t => t.thread && t.thread !== thread.id)) throw new Error("Thread terminal has conflicting ownership: " + thread.id);
	const parents = new Map<number, number>();
	for (const row of (await command("ps", ["-axo", "pid=,ppid="])).trim().split("\n")) {
		const [pid, parent] = row.trim().split(/\s+/).map(Number);
		if (pid && Number.isInteger(parent)) parents.set(pid, parent!);
	}
	// A CLI controller may share the cwd, but must not kill itself or the processes holding it open.
	const protectedPids = new Set<number>();
	for (let pid = process.pid; pid > 0 && !protectedPids.has(pid); pid = parents.get(pid) ?? 0) protectedPids.add(pid);
	const live = readLive();
	const canonical = live.filter(l => l.sessionId === thread.sessionId || (l as Live & { thread?: string }).thread === thread.id);
	if (named.some(t => protectedPids.has(t.pid)) || canonical.some(l => protectedPids.has(l.pid)))
		throw new Error("Cleanup controller is inside thread " + thread.id + "; run cleanup from another terminal");
	const selected = new Set<number>([...named.map(t => t.pid), ...canonical.map(l => l.pid), ...owned && root ? await cwdProcesses(root) : []]);
	// Reach pi children outside the cwd too (e.g. MCP servers); guests never use the shared cwd sweep.
	let grew = true;
	while (grew) {
		grew = false;
		for (const [pid, parent] of parents) if (selected.has(parent) && !selected.has(pid) && !protectedPids.has(pid)) {
			selected.add(pid); grew = true;
		}
	}
	for (const pid of protectedPids) selected.delete(pid);
	for (const record of live) if (selected.has(record.pid)) markRetired(record);
	const retiring = [...selected].filter(alive);
	// Stop the restart loop before stopping canonical pi, including a promoted pi open elsewhere.
	for (const terminal of named) await zmx(["kill", terminal.name, "--force"]);
	for (const pid of retiring) {
		try { process.kill(pid, "SIGTERM"); }
		catch (error) { if ((error as { code?: string }).code !== "ESRCH") throw error; }
	}
	for (let i = 0; i < 10 && retiring.some(alive); i++) await delay(100);
	for (const pid of retiring.filter(alive)) {
		try { process.kill(pid, "SIGKILL"); }
		catch (error) { if ((error as { code?: string }).code !== "ESRCH") throw error; }
	}
	for (let i = 0; i < 10 && retiring.some(alive); i++) await delay(100);
	if (retiring.some(alive)) throw new Error("Retiring thread still has live processes: " + retiring.filter(alive).join(", "));
	result.killed = retiring;
	if (owned && root) {
		const entry = (await worktrees(thread.project)).find(t => t.path === root);
		if (entry) await gitChecked(thread.project, "worktree", "remove", "--force", root);
		if (thread.branch) {
			if (keepBranch) result.branchesKept.push({ branch: thread.branch, reason: "keepBranch requested" });
			else {
				const deleted = await gitAttempt(thread.project, "branch", "-D", thread.branch);
				if (deleted.code) result.branchesKept.push({ branch: thread.branch, reason: deleted.err || deleted.out });
				else result.branchesDeleted.push(thread.branch);
			}
		}
	}
	// Current session can change while cleanup waits; never overwrite it with the walk's snapshot.
	const current = await getThread(thread.id);
	if (!current) throw new Error("Thread disappeared during cleanup: " + thread.id);
	await saveThread({ ...current, archived: true, blocked: undefined });
	result.closed.push(thread.id);
	return result;
}
