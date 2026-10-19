import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { excludeTracker } from "./tracker-worktree";
import { runSetup } from "./setup";
import { checkout, git } from "./git";
import { validateLaunch } from "./launch";
import { assertBb, bbThreads, bbWorkerThread, logBb, spawnBb } from "./bb";
import type { NewThreadOptions, WorkerCheckout, WorkerIdentity, WorkerThread } from "./types";

/** A worker's thread from its bb thread id: its worktree is the thread's environment, its branch what is checked out
 * there, its identity the title `<run>/<handle>` bb was given at spawn. undefined once the bb thread is archived or gone.
 * `expected` insists on that identity. */
export async function workerOf(id: string, expected?: WorkerIdentity): Promise<WorkerThread | undefined> {
	const entry = (await bbThreads()).get(id);
	if (!entry || entry.archivedAt) return;
	if (!entry.environmentPath) throw new Error("bb thread " + id + " has no environment");
	const title = entry.title ?? "";
	const slash = title.lastIndexOf("/");
	const worker = expected ?? (slash > 0 ? { run: title.slice(0, slash), handle: title.slice(slash + 1) } : undefined);
	if (!worker || title !== worker.run + "/" + worker.handle) throw new Error("bb thread " + id + " is not " + (expected ? expected.run + "/" + expected.handle : "a worker") + (title ? " (titled " + title + ")" : ""));
	const { cwd, project, worktree, branch } = checkout(entry.environmentPath);
	if (!worktree || !branch) throw new Error("Worker " + title + " has no linked worktree on a branch: " + cwd);
	return { id, cwd, project, worktree, branch, worker };
}

/** Make a worker's worktree on a new branch off options.base, prepare and set it up, and start its pi in bb. */
export async function newThread(options: NewThreadOptions): Promise<WorkerThread> {
	validateLaunch(options.launch);
	await assertBb();
	const spawning = checkout(resolve(options.cwd ?? process.cwd()));
	if (!spawning.branch) throw new Error("A new worktree needs a spawning checkout branch: " + spawning.cwd);
	const name = options.worktree ?? options.worker.handle;
	git(spawning.cwd, "check-ref-format", "--branch", name);
	const path = resolve(spawning.project + "__worktrees", name);
	if (existsSync(path)) throw new Error("Worktree path already exists (not owned): " + path);
	if (git(spawning.cwd, "branch", "--list", name)) throw new Error("Worktree branch already exists (not owned): " + name);
	const inProject = (candidate: string) => { try { return checkout(candidate).project === spawning.project; } catch { return false; } };
	if (bbWorkerThread(await bbThreads(), options.worker.handle, options.worker.run, inProject))
		throw new Error("Active worker already exists: " + options.worker.run + "/" + options.worker.handle);
	try {
		// Own the attempt: git can create a branch/path and then fail during checkout.
		git(spawning.cwd, "worktree", "add", "--no-checkout", "-b", name, path, options.base ?? "HEAD");
		excludeTracker(path);
		const location = checkout(path);
		git(path, "config", "branch." + name + ".ab-parent", spawning.branch);
		const pending: WorkerCheckout = { cwd: location.cwd, project: location.project, worktree: location.worktree!, branch: name, worker: options.worker, launch: options.launch };
		await options.prepare?.(pending);
		await runSetup(pending);
		return { ...pending, id: await spawnBb(pending, options.parent ?? process.env.BB_THREAD_ID) };
	} catch (error) {
		const cleanup: string[] = [];
		// Failed setup/launch owns its partial path until cleanup succeeds.
		try {
			const registered = git(spawning.cwd, "worktree", "list", "--porcelain", "-z").split("\0").includes("worktree " + path);
			if (registered) git(spawning.cwd, "worktree", "remove", "--force", path);
			else await rm(path, { recursive: true, force: true });
			if (git(spawning.cwd, "branch", "--list", name)) git(spawning.cwd, "branch", "-D", name);
		} catch (e) { cleanup.push(String(e)); }
		throw new Error("Worker " + options.worker.run + "/" + options.worker.handle + " at " + path + " failed: " + String(error) + (cleanup.length ? "\nPartial resources remain: " + cleanup.join("\n") : "\nPartial resources cleaned"));
	}
}

/** The tail of a bb thread's log (all of it without `lines`). */
export async function historyThread(id: string, lines?: number): Promise<string> {
	if (lines !== undefined && (!Number.isInteger(lines) || lines < 0)) throw new Error("lines must be a nonnegative integer");
	const history = await logBb(id);
	if (lines === undefined) return history;
	const split = history.replace(/\n$/, "").split("\n");
	return lines === 0 ? "" : split.slice(-lines).join("\n") + (history.endsWith("\n") ? "\n" : "");
}
