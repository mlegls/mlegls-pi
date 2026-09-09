/**
 * Outline-first `read` and anchor-based `edit`: large files come back as
 * definitions and headings with line ranges; every served line carries a
 * 4-character anchor that stays valid across edits in the session.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerEditTool } from "./edit";
import { registerGrepTool } from "./grep";
import { Ledger, type LedgerEntry } from "./ledger";
import { markdownSource } from "./outline/markdown";
import { outlineWithModel } from "./outline/model";
import { treeSitterSource } from "./outline/treesitter";
import { registerReadTool } from "./read";

const ENTRY_TYPE = "outline-read";

export default function (pi: ExtensionAPI) {
	const ledger = new Ledger();

	pi.on("session_start", (_event, ctx) => {
		ledger.reset();
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) ledger.restore(entry.data as LedgerEntry);
		}
	});

	const persist = (path: string) => {
		const entry = ledger.entry(path);
		if (entry) pi.appendEntry(ENTRY_TYPE, entry);
	};

	registerReadTool(pi, {
		ledger,
		persist,
		sources: [treeSitterSource, markdownSource],
		fallback: (path, text, config, signal) => (config.fallback.enabled ? outlineWithModel(path, text, config.fallback, signal) : Promise.resolve(null)),
	});
	registerEditTool(pi, { ledger, persist });
	registerGrepTool(pi, { ledger, persist, sources: [treeSitterSource, markdownSource] });
}
