/**
 * Outline-first `read`: large files come back as definitions and headings with
 * line ranges; bodies are read explicitly by range.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { markdownSource } from "./outline/markdown";
import { outlineWithModel } from "./outline/model";
import { treeSitterSource } from "./outline/treesitter";
import { registerReadTool } from "./read";

export default function (pi: ExtensionAPI) {
	registerReadTool(pi, {
		sources: [treeSitterSource, markdownSource],
		fallback: (path, text, config, signal) => outlineWithModel(path, text, config.fallbackModel, signal),
	});
}
