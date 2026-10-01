/**
 * Hashline read/grep/edit over pi's built-ins: large files come back as an outline of
 * definitions and headings with line ranges; every served line carries a 4-character
 * anchor that edit addresses without a path, valid across edits and resume on the branch.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerEditTool } from "../../lib/outline-read/edit";
import { registerGrepTool } from "../../lib/outline-read/grep";
import { Ledger, type LedgerEntry } from "../../lib/outline-read/ledger";
import { markdownSource } from "../../lib/outline-read/outline/markdown";
import { outlineWithModel } from "../../lib/outline-read/outline/model";
import { treeSitterSource } from "../../lib/outline-read/outline/treesitter";
import { registerReadTool } from "../../lib/outline-read/read";

const ENTRY_TYPE = "outline-read";

export default function (pi: ExtensionAPI) {
	const ledger = new Ledger();
	const restore = (_event: unknown, ctx: ExtensionContext) => {
		ledger.reset();
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) ledger.restore(entry.data as LedgerEntry);
		}
	};
	pi.on("session_start", restore);
	pi.on("session_tree", restore);

	const persist = (path: string) => {
		const entry = ledger.entry(path);
		if (entry) pi.appendEntry(ENTRY_TYPE, entry);
	};
	const sources = [treeSitterSource, markdownSource];

	registerReadTool(pi, {
		ledger, persist, sources,
		fallback: (path, text, config, signal) => (config.fallback.enabled ? outlineWithModel(path, text, config.fallback, signal) : Promise.resolve(null)),
	});
	registerEditTool(pi, { ledger, persist });
	registerGrepTool(pi, { ledger, persist, sources });
}
