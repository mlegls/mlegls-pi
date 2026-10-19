// Make pi's session commands usable from bb, which runs pi in RPC mode: there the built-in TUI commands (/reload and
// the rest) do nothing, and ctx.ui.notify never reaches the user. See lib/notice.ts.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { insideBb, notice, withoutNotices } from "../../lib/notice.ts";
import { localCompletions } from "./local-completion.ts";

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
		if (event.reason === "reload" && insideBb()) notice(pi, ctx, "Reloaded extensions, skills, prompts, themes and context files");
	});
}
