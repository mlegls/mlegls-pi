// Interactive edits go in task worktrees, not the shared canonical checkout (docs/issues/isolate-interactive-edits-in-task-worktrees.md).
// Under bb, an interactive session's edit/write into a git repository's main worktree is refused with the route: ab task start,
// update_environment_directory, continue there. Discussion costs nothing until it edits. Workers (PI_WM_HANDLE) have their own
// worktrees. Ignored paths (desk/, .wm/) pass, as do linked worktrees and non-git paths. Opt out per repository with
// `git config pi.taskWorktrees false`, or per session with /edit-here. Shell-made edits are not seen here.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { insideBb, notice } from "../../lib/notice.ts";
import { taskOf } from "../../lib/task.ts";

const EDITING = new Set(["edit", "write"]);

/** Paths a file-writing tool call targets. */
export function targets(input: unknown): string[] {
	const i = (input ?? {}) as { path?: unknown; file_path?: unknown; edits?: { path?: unknown }[] };
	return [i.path, i.file_path, ...(Array.isArray(i.edits) ? i.edits.map(e => e?.path) : [])].filter((p): p is string => typeof p === "string" && !!p);
}

const gitOut = (cwd: string, ...args: string[]) => {
	const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
	return r.status === 0 ? r.stdout.trim() : undefined;
};

/** The main worktree a path would be written into, when it is a tracked-or-trackable path there and the repository hasn't
 * opted out; undefined otherwise. */
export function canonicalTarget(path: string): string | undefined {
	let dir = dirname(path);
	while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
	const top = gitOut(dir, "rev-parse", "--show-toplevel");
	if (!top) return;
	const gitDir = gitOut(dir, "rev-parse", "--path-format=absolute", "--git-dir");
	const common = gitOut(dir, "rev-parse", "--path-format=absolute", "--git-common-dir");
	if (!gitDir || gitDir !== common) return; // a linked worktree
	if (gitOut(top, "config", "--get", "pi.taskWorktrees") === "false") return;
	const rel = relative(top, path);
	if (!rel || rel.startsWith("..") || rel === ".git" || rel.startsWith(".git/")) return;
	if (spawnSync("git", ["-C", top, "check-ignore", "-q", "--", rel]).status === 0) return;
	return top;
}

export const refusal = (top: string) => "Independent edits go in a task worktree, not the shared checkout " + top + ". " +
	"Run `ab task start <short-task-name>` in bash from " + top + ", call update_environment_directory with the path it prints, and end your turn: " +
	"a queued message resumes you there. Commit coherent changes as you go; finish with `ab task finish`. " +
	"Nothing you haven't committed moves; don't take other sessions' changes. (The user can allow edits here with /edit-here.)";

export default function (pi: ExtensionAPI) {
	if (process.env.PI_WM_HANDLE) return;
	let here = false;
	pi.on("tool_call", (event, ctx) => {
		if (here || !insideBb() || !EDITING.has(event.toolName)) return;
		for (const p of targets(event.input)) {
			const top = canonicalTarget(isAbsolute(p) ? p : resolve(ctx.cwd, p));
			if (top) return { block: true, reason: refusal(top) };
		}
	});
	pi.registerCommand("edit-here", {
		description: "Allow this session to edit the shared checkout directly (task worktrees are the default)",
		handler: async (_args, ctx) => { here = true; notice(pi, ctx, "Edits in the shared checkout allowed for this session."); },
	});
	pi.on("before_agent_start", (event, ctx) => {
		const task = taskOf(ctx.cwd);
		if (!task) return;
		return { systemPrompt: event.systemPrompt + "\n\nThis thread works in task worktree " + task.path + " (branch " + task.branch + ", target " + task.parent +
			" in " + task.project + "). Commit coherent changes as you go. When the task is done and verified, run `ab task finish` here, then move back with update_environment_directory " + task.project + "." };
	});
	// bb's diff for the task compares against its target.
	pi.on("session_start", (_event, ctx) => {
		const task = taskOf(ctx.cwd), thread = process.env.BB_THREAD_ID;
		if (!task?.parent || !thread) return;
		const bb = process.env.BB_CLI || "bb";
		try {
			const shown = JSON.parse(execFileSync(bb, ["thread", "show", thread, "--json"], { encoding: "utf8", timeout: 10_000 })) as { environment?: { id: string; path?: string; mergeBaseBranch?: string | null } };
			const env = shown.environment;
			if (env && env.path && resolve(env.path) === task.path && env.mergeBaseBranch !== task.parent)
				execFileSync(bb, ["environment", "update", env.id, "--merge-base-branch", task.parent, "--json"], { timeout: 10_000 });
		} catch {}
	});
}
