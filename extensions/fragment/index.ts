/**
 * Read/grep/edit with edits addressed by quoting instead of hashline anchors: read and grep serve bare
 * lines (outlines and definition ranges as with hashline), edit replaces a quoted fragment that must be
 * unique, optionally extended to a block by an end fragment and scoped by a line hint or @definition.
 * An alternative to extensions/hashline; enable one of the two in package.json.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFragmentEditTool } from "../../lib/outline-read/fragment";
import { registerGrepTool } from "../../lib/outline-read/grep";
import { Ledger } from "../../lib/outline-read/ledger";
import { markdownSource } from "../../lib/outline-read/outline/markdown";
import { outlineWithModel } from "../../lib/outline-read/outline/model";
import { treeSitterSource } from "../../lib/outline-read/outline/treesitter";
import { registerReadTool } from "../../lib/outline-read/read";

export default function (pi: ExtensionAPI) {
	// read and grep still sync a ledger; with plain output its anchors are never shown or persisted.
	const ledger = new Ledger();
	const persist = () => {};
	const sources = [treeSitterSource, markdownSource];
	registerReadTool(pi, {
		ledger, persist, sources, plain: true,
		fallback: (path, text, config, signal) => (config.fallback.enabled ? outlineWithModel(path, text, config.fallback, signal) : Promise.resolve(null)),
	});
	registerFragmentEditTool(pi, { sources });
	registerGrepTool(pi, { ledger, persist, sources, plain: true });
}
