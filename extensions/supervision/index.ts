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
import { mailbox } from "../../lib/board/mailbox";
import { campaigns, resolveException, start, summary } from "../../lib/reconcile/main";

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
				maxConcurrent: p.maxConcurrent ?? 8, active: (p.active ?? []) as Handle[], follow: p.run,
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

	const reconcileNs = { name: "reconcile", description: "Execute a ready issue subtree autonomously: a reconciler process runs specs to tickets and tickets through implement → drive → review → integrate, handles mechanical failures itself, and mails this session only for exceptions no handler could resolve, and when it finishes" };
	dataTool(pi, {
		name: "reconcile", namespace: reconcileNs,
		description: "Start (or confirm running) the reconciler for a ready spec or ticket and its subtree. Its work lands in this checkout. You (this session's mailbox) are its owner: you get root-level exceptions and the final report. `budget` caps its live workers (default 6).",
		parameters: Type.Object({ issue: Type.String(), budget: Type.Optional(Type.Number()) }),
		run: (p, ctx) => start({ cwd: ctx.cwd, root: p.issue, owner: mailbox(ctx.sessionManager.getSessionId()), ownerSession: ctx.sessionManager.getSessionId(), budget: p.budget ?? 6 }),
	});
	dataTool(pi, {
		name: "reconcile_status", namespace: reconcileNs, readOnly: true,
		description: "Reconcilers in this repository: running or finished, each node's phase and worker, pending exceptions, moved-out nodes, recent log.",
		parameters: Type.Object({ issue: Type.Optional(Type.String()) }),
		run: (p, ctx) => campaigns(ctx.cwd).filter(s => !p.issue || s.root === p.issue).map(summary),
	});
	dataTool(pi, {
		name: "reconcile_resolve", namespace: reconcileNs,
		description: "Resolve an exception the reconciler escalated to you. answer: `message` goes to the waiting worker. retry: relaunch the failed phase with `note`. redispatch: restart the node's implementation with `note`. move-out: after you moved it out in the tracker (lifecycle), with `summary`. escalate is not available at the root: decide, or ask the user.",
		parameters: Type.Object({
			issue: Type.String({ description: "The reconciler's root issue" }), node: Type.String(),
			action: Type.Union([Type.Literal("answer"), Type.Literal("retry"), Type.Literal("redispatch"), Type.Literal("move-out")]),
			target: Type.Optional(Type.String()), message: Type.Optional(Type.String()), note: Type.Optional(Type.String()), summary: Type.Optional(Type.String()),
		}),
		run: (p, ctx) => { const { issue, node, ...resolution } = p; resolveException(ctx.cwd, issue, node, resolution); return { queued: true }; },
	});
	// Reconcilers this session owns come back with it: a stopped process resumes from its state.
	pi.on("session_start", (_event, ctx) => {
		try {
			const me = mailbox(ctx.sessionManager.getSessionId());
			for (const s of campaigns(ctx.cwd)) if (s.owner === me && !s.finished && !s.running) start({ cwd: s.cwd, root: s.root, owner: me, ownerSession: ctx.sessionManager.getSessionId(), budget: s.budget });
		} catch {}
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
