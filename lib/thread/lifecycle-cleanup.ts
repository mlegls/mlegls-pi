import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { markRetired, readLive } from "../session-meta/live";
import { gitAttempt, gitChecked, worktrees } from "./lifecycle-git";
import { command, delay } from "./process";
import { archiveBb, deleteBbEnvironment, stopBb } from "./bb";
import { cwdProcesses } from "./resources";
import type { ThreadCleanup, WorkerThread } from "./types";

const alive = (pid: number) => {
	try { process.kill(pid, 0); return true; }
	catch (error) { if ((error as { code?: string }).code === "ESRCH") return false; throw error; }
};

/** Stop only this thread's owned processes; preserve its workspace for retry. */
export async function stopThreadProcesses(thread: WorkerThread): Promise<ThreadCleanup> {
	return cleanupThread(thread, true, true);
}

/** discardIgnored: the worker finished and its work was taken (integrated, or handed to the next phase), so its
 * ignored files are disposable. Otherwise ignored state that setup can't regenerate is moved aside, not deleted. */
export async function retireThread(thread: WorkerThread, keepBranch: boolean, options: { discardIgnored?: boolean } = {}): Promise<ThreadCleanup> {
	return cleanupThread(thread, keepBranch, false, options.discardIgnored ?? false);
}

/** Ignored paths setup regenerates: dependency installs, tool caches, build output and wm's own files. Matched by
 * path segment, so packages/x/node_modules counts too. A project adds its own with `git config --add wm.disposable
 * <name or path>` (a value with a slash is a path from the worktree root, else a segment name). */
const DISPOSABLE_NAMES = new Set(["node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
	".turbo", ".parcel-cache", ".next", ".nuxt", ".svelte-kit", ".cache", "dist", "build", "target", "coverage", ".DS_Store"]);
/** .wm/ is kept apart from wm's launch file: workers write their debug output and scratch under .wm/<handle>/, and
 * retirement copies the session's managed-process logs to .wm/processes/ (a drive's diagnostics went with its worktree,
 * 2026-10-16). */
const DISPOSABLE_PATHS = [".husky/_", ".wm/launch.env", ".wm/setup.json", ".wm/setup.log"];

/** Whether an ignored entry (a file, or a directory git collapsed) is disposable on retirement. A file identical to the
 * same path in the main checkout (an .env copied in by setup) is too. */
export function disposableIgnored(path: string, worktree: string, project: string, declared: string[] = []): boolean {
	const p = path.replace(/\/+$/, "");
	const segments = p.split("/");
	const names = new Set([...DISPOSABLE_NAMES, ...declared.filter(d => !d.replace(/\/+$/, "").includes("/")).map(d => d.replace(/\/+$/, ""))]);
	if (segments.some(s => names.has(s))) return true;
	const paths = [...DISPOSABLE_PATHS, ...declared.map(d => d.replace(/^\/+|\/+$/g, "")).filter(d => d.includes("/"))];
	if (paths.some(d => p === d || p.startsWith(d + "/"))) return true;
	try {
		const own = lstatSync(join(worktree, p)), main = lstatSync(join(project, p));
		return own.isFile() && main.isFile() && own.size === main.size && own.size < 1 << 20 && readFileSync(join(worktree, p)).equals(readFileSync(join(project, p)));
	} catch { return false; }
}

/** Move ignored state the worktree alone holds (a local database, an export, recordings) aside before the worktree is
 * removed: a checkpointed rehearsal's authorized production export and imported database went with its worktree
 * (2026-10-16). The WIP commit covers tracked and untracked files; this covers what git ignores. Throws when it can't,
 * so the worktree stays. */
async function keepIgnored(root: string, thread: WorkerThread, wip: string | undefined): Promise<{ path: string; entries: string[] } | undefined> {
	const listed = await gitChecked(root, "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory");
	const declared = (await gitAttempt(thread.project, "config", "--get-all", "wm.disposable")).out.split("\n").map(s => s.trim()).filter(Boolean);
	// git collapses an ignored directory to one entry: open .wm/ so wm's launch file alone stays disposable.
	const expanded = listed.split("\0").filter(Boolean).flatMap(p => p === ".wm/"
		? readdirSync(join(root, ".wm"), { withFileTypes: true }).map(d => ".wm/" + d.name + (d.isDirectory() ? "/" : ""))
		: [p]);
	const entries = expanded.filter(p => !disposableIgnored(p, root, thread.project, declared));
	if (!entries.length) return undefined;
	const base = resolve(thread.project + "__retired", basename(root));
	const kept = existsSync(base) ? base + "-" + new Date().toISOString().replace(/[:.]/g, "-") : base;
	for (const entry of entries) {
		const from = join(root, entry.replace(/\/+$/, "")), to = join(kept, entry.replace(/\/+$/, ""));
		mkdirSync(dirname(to), { recursive: true });
		try { renameSync(from, to); }
		catch (error) {
			if ((error as { code?: string }).code !== "EXDEV") throw error;
			cpSync(from, to, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true });
			rmSync(from, { recursive: true, force: true });
		}
	}
	const head = await gitChecked(root, "rev-parse", "HEAD");
	writeFileSync(join(kept, "RETIRED.md"), [
		"# Ignored state kept from a retired worktree", "",
		"worktree: " + root, "thread: " + thread.id + " (" + thread.worker.run + "/" + thread.worker.handle + ")",
		"branch: " + thread.branch, "head: " + head + (wip ? " (WIP commit of its uncommitted work)" : ""),
		"retired: " + new Date().toISOString(), "",
		"These paths were gitignored in the worktree and are kept here at the same relative paths. To resume, check out",
		"the branch in a worktree and move them back. Delete this directory once nothing needs them.", "",
		...entries.map(e => "- " + e), "",
	].join("\n"));
	return { path: kept, entries };
}

/** The pi-processes log directories (one per pi, `<tmp>/pi-processes-*`, holding proc_N-{stdout,stderr,combined}.log)
 * that these pis hold open, copied to <root>/.wm/processes/. A pi with no process running holds no log open, so its
 * directory can't be found; best effort, never fails the retirement. */
export async function keepProcessLogs(root: string, pids: number[]): Promise<string[]> {
	if (!pids.length) return [];
	let listing = "";
	try { listing = await command("lsof", ["-a", "-p", pids.join(","), "-Fn"]); } catch (error) { listing = String((error as Error).message); }
	const dirs = new Set<string>();
	for (const line of listing.split("\n")) {
		const m = /^n(.*\/pi-processes-[^/]+)\/proc_[^/]*\.log$/.exec(line);
		if (m) dirs.add(m[1]);
	}
	const copied: string[] = [];
	for (const dir of dirs) {
		try {
			const to = join(root, ".wm", "processes", basename(dir));
			mkdirSync(dirname(to), { recursive: true });
			cpSync(dir, to, { recursive: true, preserveTimestamps: true });
			copied.push(to);
		} catch {}
	}
	return copied;
}

/** Commit everything uncommitted (ignored files aside) to the worktree's branch; its sha, or undefined when clean.
 * Throws when it can't, so the worktree stays rather than losing the work. */
async function commitWip(root: string, thread: WorkerThread): Promise<string | undefined> {
	if (!await gitChecked(root, "status", "--porcelain")) return;
	await gitChecked(root, "add", "-A");
	await gitChecked(root, "-c", "commit.gpgsign=false", "commit", "--no-verify", "-q", "-m",
		"WIP: uncommitted work of " + thread.worker.run + "/" + thread.worker.handle + " at retirement\n\nSaved by thread cleanup before removing " + root + "; not reviewed.");
	return gitChecked(root, "rev-parse", "--short", "HEAD");
}

async function cleanupThread(thread: WorkerThread, keepBranch: boolean, processesOnly: boolean, discardIgnored = false): Promise<ThreadCleanup> {
	const result: ThreadCleanup = { closed: [], killed: [], branchesDeleted: [], branchesKept: [] };
	let root = resolve(thread.worktree);
	if (root === "/" || root === resolve(thread.project)) throw new Error("Refusing to remove main checkout: " + root);
	const entry = (await worktrees(thread.project)).find(t => t.path === root);
	if (entry && entry.branch !== thread.branch) throw new Error("Worktree has a different branch: " + root);
	// Resolve aliases before matching lsof cwd paths.
	if (entry) root = realpathSync(root);
	const parents = new Map<number, number>();
	for (const row of (await command("ps", ["-axo", "pid=,ppid="])).trim().split("\n")) {
		const [pid, parent] = row.trim().split(/\s+/).map(Number);
		if (pid && Number.isInteger(parent)) parents.set(pid, parent!);
	}
	// A CLI controller may share the cwd, but must not kill itself or the processes holding it open.
	const protectedPids = new Set<number>();
	for (let pid = process.pid; pid > 0 && !protectedPids.has(pid); pid = parents.get(pid) ?? 0) protectedPids.add(pid);
	const live = readLive();
	const canonical = live.filter(l => l.thread === thread.id);
	if (canonical.some(l => protectedPids.has(l.pid)))
		throw new Error("Cleanup controller is inside thread " + thread.id + "; run cleanup from another terminal");
	const selected = new Set<number>([...canonical.map(l => l.pid), ...await cwdProcesses(root)]);
	// Reach pi children outside the cwd too (e.g. MCP servers).
	let grew = true;
	while (grew) {
		grew = false;
		for (const [pid, parent] of parents) if (selected.has(parent) && !selected.has(pid) && !protectedPids.has(pid)) {
			selected.add(pid); grew = true;
		}
	}
	for (const pid of protectedPids) selected.delete(pid);
	// pi's process manager deletes its logs when pi ends: copy them into the worktree first, so they leave with its state.
	if (!discardIgnored && existsSync(root)) await keepProcessLogs(root, canonical.map(l => l.pid).filter(alive));
	for (const record of live) if (selected.has(record.pid)) markRetired(record);
	// Marked first, so the parent's child monitor reads bb's exit as retirement. bb would restart a pi killed under it:
	// release its runtime, then sweep what's left.
	await stopBb(thread.id);
	const retiring = [...selected].filter(alive);
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
	if (processesOnly) return result;
	{
		const entry = (await worktrees(thread.project)).find(t => t.path === root);
		// Uncommitted work outlives the worktree as a WIP commit on its branch, which is then kept: a replaced drive's
		// evidence (recordings of paid live draws, write-ups) was untracked and went with its worktree (2026-10-12).
		const wip = entry ? await commitWip(root, thread) : undefined;
		const kept = entry && !discardIgnored ? await keepIgnored(root, thread, wip) : undefined;
		if (kept) result.kept = [...result.kept ?? [], { worktree: root, ...kept }];
		if (entry) await gitChecked(thread.project, "worktree", "remove", "--force", root);
		{
			if (wip) result.branchesKept.push({ branch: thread.branch, reason: "uncommitted work saved as WIP commit " + wip });
			else if (kept) result.branchesKept.push({ branch: thread.branch, reason: "ignored state kept at " + kept.path });
			else if (keepBranch) result.branchesKept.push({ branch: thread.branch, reason: "keepBranch requested" });
			else {
				const deleted = await gitAttempt(thread.project, "branch", "-D", thread.branch);
				if (deleted.code) result.branchesKept.push({ branch: thread.branch, reason: deleted.err || deleted.out });
				else result.branchesDeleted.push(thread.branch);
			}
		}
	}
	await archiveBb(thread.id);
	if (!existsSync(root)) await deleteBbEnvironment(thread.id);
	result.closed.push(thread.id);
	return result;
}
