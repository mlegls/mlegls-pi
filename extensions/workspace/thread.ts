import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getThread, setCurrentSession, threadForSession } from "../../lib/thread/registry";
import { persistHeader } from "../../lib/thread/sessions";
import type { ThreadRecord } from "../../lib/thread/types";

const ab = fileURLToPath(new URL("../../bin/ab", import.meta.url));
const usage = "Usage: /thread new|fork [--worktree <name>] | promote | archive|abandon|merge [<thread>]";

export async function currentThread(ctx: ExtensionContext): Promise<ThreadRecord | undefined> {
	const file = ctx.sessionManager.getSessionFile();
	const record = file && await threadForSession(file);
	return record && !record.archived && record.sessionId === ctx.sessionManager.getSessionId() ? record : undefined;
}

/** Explicit current identity avoids inherited PI_SESSION_* values after /new or /resume. */
export async function runThread(args: string[], ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
	await ctx.waitForIdle();
	const sm = ctx.sessionManager;
	const file = sm.getSessionFile();
	if (!file) throw new Error("/thread requires a persisted session");
	await persistHeader(file, sm.getSessionId(), ctx.cwd);
	const result = await pi.exec("env", [
		"PI_SESSION_ID=" + sm.getSessionId(), "PI_SESSION_FILE=" + file,
		ab, "thread", ...args,
	], { cwd: ctx.cwd });
	if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "ab thread failed");
	ctx.ui.notify(result.stdout.trim() || "Thread action completed", "info");
}

/** Cleanup stops every pi in the target's subtree and refuses a controller inside it, so a thread
 * retiring itself (or an ancestor) is handed to a controller reparented away from this pi. */
async function insideTarget(target: string, ctx: ExtensionContext): Promise<boolean> {
	const seen = new Set<string>();
	for (let id = (await currentThread(ctx))?.id; id && !seen.has(id); id = (await getThread(id))?.parent) {
		if (id === target) return true;
		seen.add(id);
	}
	return false;
}

function runDetached(argv: string[], project: string): string {
	const log = join(tmpdir(), "ab-thread-" + argv.join("-") + ".log");
	// The inner background job outlives sh, so init adopts it and it no longer descends from this pi.
	spawn("sh", ["-c", '"$@" >"$0" 2>&1 &', log, ab, "thread", ...argv], { cwd: project, detached: true, stdio: "ignore" }).unref();
	return log;
}

export async function threadCommand(args: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
	// The only argument value is a worktree name (a git branch name cannot contain spaces).
	const { positionals, values } = parseArgs({
		args: args.trim().split(/\s+/).filter(Boolean), allowPositionals: true, strict: true,
		options: { worktree: { type: "string" } },
	});
	const [action] = positionals;
	const cleanup = action === "archive" || action === "abandon" || action === "merge";
	if (positionals.length > (cleanup ? 2 : 1) || !action || !["new", "fork", "promote", "archive", "abandon", "merge"].includes(action))
		throw new Error(usage);
	const argv = [action];
	if (action === "new" || action === "fork") {
		if (values.worktree !== undefined) argv.push("--worktree", values.worktree);
		if (action === "new") {
			const parent = await currentThread(ctx);
			if (parent) argv.push("--parent", parent.id);
		}
	} else {
		if (values.worktree !== undefined) throw new Error(usage);
		if (cleanup) {
			const target = positionals[1] ?? (await currentThread(ctx))?.id;
			if (!target) throw new Error("/thread " + action + " requires a thread id here: this session is not canonical (/thread promote makes it one)");
			const record = await getThread(target);
			if (!record) throw new Error("Unknown thread: " + target);
			argv.push(target);
			if (await insideTarget(target, ctx)) {
				await ctx.waitForIdle();
				const log = runDetached(argv, record.project);
				ctx.ui.notify("Running ab thread " + argv.join(" ") + " from outside this pi, which exits when the thread retires. Output: " + log, "info");
				return;
			}
		}
	}
	await runThread(argv, ctx, pi);
}

export function registerThread(pi: ExtensionAPI) {
	const handler = async (args: string, ctx: ExtensionCommandContext) => {
		try { await threadCommand(args, ctx, pi); }
		catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); }
	};
	pi.registerCommand("thread", { description: usage, handler });
	pi.registerCommand("fork-tab", { description: "Alias of /thread fork [--worktree <name>]", handler: (args, ctx) => handler("fork " + args, ctx) });

	// pi 0.65+ replaced session_switch with session_start + reason/previousSessionFile.
	pi.on("session_start", async (event, ctx) => {
		if ((event.reason !== "new" && event.reason !== "resume") || !event.previousSessionFile) return;
		const previous = await threadForSession(event.previousSessionFile);
		if (!previous || previous.archived) return; // free sessions do not acquire membership
		const file = ctx.sessionManager.getSessionFile();
		if (!file) throw new Error("Canonical thread session replacement has no session file");
		await setCurrentSession(previous.id, { id: ctx.sessionManager.getSessionId(), file });
	});
}
