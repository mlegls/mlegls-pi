/**
 * Outline-first `read`: large files come back as definitions and headings with
 * line ranges; bodies are read explicitly by range.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { markdownSource } from "./outline/markdown";
import { treeSitterSource } from "./outline/treesitter";
import { registerReadTool } from "./read";

export default function (pi: ExtensionAPI) {
	registerReadTool(pi, { sources: [treeSitterSource, markdownSource] });
}
