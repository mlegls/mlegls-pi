import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { BranchSession } from "../../../../lib/records/branch.ts";
import { readCursor, writeCursor } from "../../../../lib/records/cursor.ts";
import { resolveCompactAfterTokens, type CompactAt } from "../config.js";
import type { Runtime } from "../runtime.js";

const KEY = "om.compactAt";
const USAGE = "Usage: /om:compact-at [150k | 150000 | 0.2 | 20% | default]";

/** This session's own compaction threshold, set by /om:compact-at; forks and tree navigation follow it. */
export function sessionCompactAt(ctx: Pick<ExtensionContext, "sessionManager">): CompactAt | undefined {
	return ctx.sessionManager ? readCursor<CompactAt | null>(ctx.sessionManager as unknown as BranchSession, KEY) ?? undefined : undefined;
}

/** "150k"/"150000" are tokens, "0.2"/"20%" a fraction of the context window, "default" clears; undefined is invalid. */
export function parseCompactAt(arg: string): CompactAt | null | undefined {
	const s = arg.trim().toLowerCase();
	if (s === "default" || s === "reset" || s === "off") return null;
	const m = /^(\d+(?:\.\d+)?)\s*(k|%)?$/.exec(s);
	if (!m) return undefined;
	const n = Number(m[1]);
	if (m[2] === "%") return n > 0 && n < 100 ? { ratio: n / 100 } : undefined;
	if (m[2] === "k") return n >= 1 ? { tokens: Math.round(n * 1000) } : undefined;
	if (n > 0 && n < 1) return { ratio: n };
	return Number.isInteger(n) && n >= 1000 ? { tokens: n } : undefined;
}

export function registerCompactAtCommand(pi: ExtensionAPI, runtime: Runtime): void {
	pi.registerCommand("om:compact-at", {
		description: "Set this session's auto-compaction threshold (tokens or a fraction of the context window), overriding settings",
		handler: async (args, ctx) => {
			runtime.ensureConfig(ctx.cwd);
			const arg = (args ?? "").trim();
			if (arg) {
				const parsed = parseCompactAt(arg);
				if (parsed === undefined) { ctx.ui.notify(USAGE, "info"); return; }
				writeCursor(ctx.sessionManager as unknown as BranchSession, KEY, parsed);
			}
			const at = sessionCompactAt(ctx);
			const window = typeof ctx.model?.contextWindow === "number" ? ctx.model.contextWindow : undefined;
			const tokens = resolveCompactAfterTokens(runtime.config, window, at);
			const source = !at ? "settings" : "tokens" in at ? "this session" : "this session, " + Math.round(at.ratio * 100) + "% of " + (window?.toLocaleString() ?? "an unknown") + " tokens";
			ctx.ui.notify("Auto-compaction at ~" + tokens.toLocaleString() + " tokens (" + source + ")", "info");
		},
	});
}
