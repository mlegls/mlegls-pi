// Make pi's session commands usable from bb, which runs pi in RPC mode: there the built-in TUI commands (/reload and
// the rest) do nothing, and ctx.ui.notify never reaches the user. See lib/notice.ts.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { insideBb, notice, withoutNotices } from "../../lib/notice.ts";
import { localCompletions } from "./local-completion.ts";
import { startDoctor } from "../../lib/doctor-start.ts";
import { campaigns, start } from "../../lib/reconcile/main";
import { ensureWatcher, loadPickup } from "../../lib/reconcile/pickup";
import { childSession } from "../../lib/session/jump";

export default function (pi: ExtensionAPI) {
	localCompletions(pi);
	pi.on("context", (event) => {
		const messages = withoutNotices(event.messages);
		return messages ? { messages } : undefined;
	});

	// An extension command runs in RPC mode, unlike the built-in /reload.
	pi.registerCommand("reload-ext", {
		description: "Reload extensions, skills, prompts, themes and context files (works under bb, unlike /reload)",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();
			// The old runtime is stale after this; the new one confirms on session_start.
			await ctx.reload();
		},
	});
	pi.on("session_start", (event, ctx) => {
		startDoctor();
		if (event.reason === "reload" && insideBb()) notice(pi, ctx, "Reloaded extensions, skills, prompts, themes and context files");
	});

	// A missing process resumes with its owner, quietly: a host-daemon restart kills them all and the owner's next session
	// start resumes them together, and each "started" mail cost the owner a turn for nothing it asked for (2026-10-25).
	// An explicit stop owns cleanup and never auto-resumes.
	pi.on("session_start", (_event, ctx) => {
		try {
			const me = process.env.BB_THREAD_ID;
			if (!me) return;
			for (const s of campaigns(ctx.cwd)) if (s.owner === me && !s.finished && !s.stopping && !s.running) start({ cwd: ctx.cwd, root: s.root, owner: me, ownerSession: ctx.sessionManager.getSessionId(), budget: s.budget, land: s.land ?? "local", quiet: true });
		} catch {}
		try { if (loadPickup(ctx.cwd)?.owner === process.env.BB_THREAD_ID) ensureWatcher(ctx.cwd); } catch {}
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
