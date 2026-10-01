import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { setCurrentSession, threadForSession } from "../../lib/thread/registry";
import { persistHeader } from "../../lib/thread/sessions";
import type { ThreadRecord } from "../../lib/thread/types";

const ab = fileURLToPath(new URL("../../bin/ab", import.meta.url));
const usage = "Usage: /thread new|fork [--worktree <name>] | promote | archive | abandon | merge";

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

export async function threadCommand(args: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
	// The only argument value is a worktree name (a git branch name cannot contain spaces).
	const { positionals, values } = parseArgs({
		args: args.trim().split(/\s+/).filter(Boolean), allowPositionals: true, strict: true,
		options: { worktree: { type: "string" } },
	});
	const [action] = positionals;
	if (positionals.length !== 1 || !action || !["new", "fork", "promote", "archive", "abandon", "merge"].includes(action))
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
		if (action !== "promote") {
			const member = await currentThread(ctx);
			if (!member) throw new Error("/thread " + action + " requires a canonical thread; use /thread promote first");
			argv.push(member.id);
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
