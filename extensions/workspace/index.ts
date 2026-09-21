import { rm } from "node:fs/promises";
import { Type } from "typebox";
import { SessionManager, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { resolveWorkspacePath } from "./workspace";

async function switchWorkspace(target: string, ctx: ExtensionCommandContext): Promise<void> {
	const sourceSession = ctx.sessionManager.getSessionFile();
	if (!sourceSession) throw new Error("Workspace switching requires a persisted session");
	if (target === ctx.cwd) {
		ctx.ui.notify(`Already in workspace: ${target}`, "info");
		return;
	}

	await ctx.waitForIdle();
	const fork = SessionManager.forkFrom(sourceSession, target);
	const targetSession = fork.getSessionFile();
	if (!targetSession) throw new Error("Failed to create the replacement session");

	const result = await ctx.switchSession(targetSession, {
		withSession: async (replacementCtx) => {
			replacementCtx.ui.notify(`Switched workspace to ${replacementCtx.cwd}`, "info");
		},
	});
	if (result.cancelled) {
		await rm(targetSession, { force: true });
		ctx.ui.notify("Workspace switch cancelled", "info");
		return;
	}
}

export default function (pi: ExtensionAPI) {
	let pendingWorkspace: string | undefined;

	pi.registerTool({
		name: "workspace_request",
		label: "Request Workspace Switch",
		description: "Request switching the session to another workspace directory. The user must approve with /workspace accept.",
		promptSnippet: "Request a user-approved switch to another workspace directory",
		promptGuidelines: [
			"Use workspace_request when work should continue in a different project directory.",
			"A request does not switch workspaces; tell the user to run /workspace accept.",
		],
		parameters: Type.Object({
			path: Type.String({ description: "Target directory, absolute or relative to the current workspace" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const target = await resolveWorkspacePath(params.path, ctx.cwd);
			if (target === ctx.cwd) {
				return {
					content: [{ type: "text" as const, text: `Already in workspace: ${target}` }],
					details: { current: ctx.cwd },
				};
			}
			pendingWorkspace = target;
			return {
				content: [{ type: "text" as const, text: `Workspace switch requested: ${target}\nThe user must run /workspace accept to approve it.` }],
				details: { current: ctx.cwd, pending: target },
			};
		},
	});

	pi.registerCommand("workspace", {
		description: "Switch workspace or approve a model request: /workspace [path|accept|cancel|status]",
		handler: async (args, ctx) => {
			const argument = args?.trim() ?? "";
			if (!argument || argument === "status") {
				const pending = pendingWorkspace ? `\nPending: ${pendingWorkspace}` : "\nPending: none";
				ctx.ui.notify(`Workspace: ${ctx.cwd}${pending}\nUsage: /workspace <path> | accept | cancel`, "info");
				return;
			}
			if (argument === "cancel" || argument === "reject") {
				if (!pendingWorkspace) {
					ctx.ui.notify("No workspace switch is pending", "info");
					return;
				}
				const cancelled = pendingWorkspace;
				pendingWorkspace = undefined;
				ctx.ui.notify(`Cancelled workspace switch to ${cancelled}`, "info");
				return;
			}
			if (argument === "accept") {
				if (!pendingWorkspace) {
					ctx.ui.notify("No workspace switch is pending", "error");
					return;
				}
				await switchWorkspace(pendingWorkspace, ctx);
				return;
			}

			const target = await resolveWorkspacePath(argument, ctx.cwd);
			await switchWorkspace(target, ctx);
		},
	});
}
