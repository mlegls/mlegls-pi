/**
 * Supervision: launch ready waves of wm workers, integrate and retire them, and /jump into a
 * worker's session. Dispatch subscribes this session to the run's topics with wake, so worker
 * reports (their last message, posted on run/handle) start the parent's next turn.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { dispatch, integrate, retire, type Assignment, type Handle } from "../../lib/dispatch";
import { childSession } from "../../lib/session/jump";
import { dataTool } from "../../lib/tool";

const namespace = { name: "supervision", description: "Dispatch wm workers (workmux worktree + tmux window running pi), integrate their branches, retire them" };

const HandleSchema = Type.Object({ handle: Type.String(), run: Type.String(), path: Type.String(), session: Type.Optional(Type.String()), cursor: Type.Optional(Type.String()) });
const Worker = Type.Union([HandleSchema, Type.String({ description: "Bare handle, looked up among this checkout's worktrees" })]);

export default function (pi: ExtensionAPI) {
	dataTool(pi, {
		name: "dispatch", namespace,
		description: "Launch a ready wave of workers; no waiting or retries. Each assignment is a self-contained prompt with an `agent` stance (agents/<agent>.md; its model list routes through stance/<agent>) or an exact model+effort. " +
			"Workers report by ending their turn (done | blocked | needs-input | checkpoint first) on board topic run/handle; this session is subscribed to run/** with wake. " +
			"`active` lists every outstanding handle from earlier waves for the maxConcurrent budget. Returns {submitted, pending, failed?}: retain submitted handles for integrate; inspect a failure before retrying.",
		parameters: Type.Object({
			run: Type.String({ description: "Parent topic/branch prefix, e.g. compile/1726" }),
			assignments: Type.Array(Type.Object({
				handle: Type.String(), prompt: Type.String(),
				agent: Type.Optional(Type.String()), role: Type.Optional(Type.String()),
				model: Type.Optional(Type.String()), effort: Type.Optional(Type.String()),
				issue: Type.Optional(Type.String({ description: "Tracker issue slug; requires its assignee" })),
				assignee: Type.Optional(Type.String()), base: Type.Optional(Type.String()),
			})),
			maxConcurrent: Type.Optional(Type.Number({ description: "Default 8" })),
			active: Type.Optional(Type.Array(HandleSchema)),
		}),
		async run(p, ctx) {
			const receipt = await dispatch(p.assignments as Assignment[], {
				run: p.run, cwd: ctx.cwd, parent: ctx.sessionManager.getSessionId(),
				maxConcurrent: p.maxConcurrent ?? 8, active: (p.active ?? []) as Handle[],
			});
			if (receipt.submitted.length) pi.events.emit("board:subscribe", { topic: p.run + "/**", wake: true });
			return receipt;
		},
	});

	dataTool(pi, {
		name: "integrate", namespace,
		description: "Merge a settled worker's branch into this checkout, then retire it (close its window and worktree, kill leftover processes, delete the branch once merged). " +
			"Default rebases onto HEAD and fast-forwards; mode merge makes a merge commit. Uncommitted work refuses; a conflict aborts and names the files: send them to the worker to resolve on its branch. keep integrates without cleanup.",
		parameters: Type.Object({ worker: Worker, mode: Type.Optional(Type.Union([Type.Literal("rebase"), Type.Literal("merge")])), keep: Type.Optional(Type.Boolean()) }),
		async run(p, ctx) {
			try { return await integrate(p.worker as Handle | string, { cwd: ctx.cwd, mode: p.mode, keep: p.keep }); }
			catch (error) { if ((error as { files?: string[] }).files) return { conflict: true, ...(error as object), message: (error as Error).message }; throw error; }
		},
	});

	dataTool(pi, {
		name: "retire", namespace,
		description: "Retire a worker without integrating: close its window and worktree and kill leftover processes. Its branch is deleted only if every patch is already in HEAD, else kept and reported.",
		parameters: Type.Object({ worker: Worker }),
		run: (p, ctx) => retire(p.worker as Handle | string, { cwd: ctx.cwd }),
	});

	pi.registerCommand("jump", {
		description: "Switch this session to a worker's session file: /jump <handle>",
		handler: async (args, ctx) => {
			const handle = args?.trim() ?? "";
			if (!handle) return ctx.ui.notify("Usage: /jump <handle>", "error");
			try {
				const file = await childSession(handle, ctx.cwd, ctx.sessionManager.getSessionFile());
				await ctx.waitForIdle();
				const result = await ctx.switchSession(file, { withSession: async (next) => next.ui.notify(`Jumped to ${handle}`, "info") });
				if (result.cancelled) ctx.ui.notify("Jump cancelled", "info");
			} catch (err) {
				ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
			}
		},
	});
}
