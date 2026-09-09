import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createReadToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { loadConfig, type OutlineReadConfig } from "./config";
import { renderOutline, type Elision } from "./outline/render";
import type { OutlineNode, OutlineSource } from "./outline/types";
import { formatRow } from "./anchors";
import type { Ledger } from "./ledger";
import { formatRanges, normalizeRanges, splitSelector, type Selector } from "./selector";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

const parameters = Type.Object({
	path: Type.String({
		description:
			"File path, optionally with a line selector: `src/a.ts:50-200`, `:50+30`, `:5-16,40-80` (several ranges), `:all` (whole file).",
	}),
	offset: Type.Optional(Type.Number({ description: "Alternative to a selector: 1-indexed start line." })),
	limit: Type.Optional(Type.Number({ description: "Alternative to a selector: number of lines from offset." })),
});

export interface ReadDeps {
	ledger: Ledger;
	persist: (path: string) => void;
	sources: OutlineSource[];
	/** Outline for files no source supports; null to give up and return the file. */
	fallback?: (path: string, text: string, config: OutlineReadConfig, signal?: AbortSignal) => Promise<OutlineNode[] | null>;
}

function formatElision(elision: Elision): string {
	const range = elision.startLine === elision.endLine ? `${elision.startLine}` : `${elision.startLine}-${elision.endLine}`;
	const children = elision.children ? ` (${elision.children} definitions)` : "";
	return `    ⋯ ${range}${children}`;
}


/** Emit anchored rows for ranges, stopping at the line/byte caps. */
function renderRanges(
	rows: (lineNumber: number) => string,
	ranges: Array<{ start: number; end: number }>,
	config: OutlineReadConfig,
): { text: string; truncatedAt?: number } {
	const parts: string[] = [];
	let bytes = 0;
	let count = 0;
	for (let r = 0; r < ranges.length; r++) {
		const range = ranges[r];
		if (r > 0) parts.push("    ⋯");
		for (let n = range.start; n <= range.end; n++) {
			const line = rows(n);
			bytes += Buffer.byteLength(line) + 1;
			count++;
			if (count > config.maxLines || bytes > config.maxBytes) {
				return { text: parts.join("\n"), truncatedAt: n };
			}
			parts.push(line);
		}
	}
	return { text: parts.join("\n") };
}

export function registerReadTool(pi: ExtensionAPI, deps: ReadDeps): void {
	pi.registerTool({
		name: "read",
		label: "read",
		description:
			"Read a file. Files over a size threshold come back as an outline: definitions and headings are shown with their line numbers, bodies are replaced by `⋯ start-end` markers. " +
			"Re-read only the ranges you need by appending a selector to the path (`file:50-200`, `file:5-16,40-80`), or `file:all` for the whole file. " +
			"Small files are returned in full. Every line is prefixed with its anchor as `abcd│`; anchors are what the edit tool takes.",
		promptSnippet: "Read files; large files return an outline with line ranges to read on demand",
		promptGuidelines: [
			"Use read to examine files instead of cat or sed.",
			"When read returns an outline, read only the ranges you need with `path:start-end` (several: `path:5-16,40-80`); do not guess at elided content and do not use `path:all` unless you need the whole file.",
		],
		parameters,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const config = loadConfig(ctx.cwd);
			const { path, selector: pathSelector } = splitSelector(params.path);
			let shown = path;
			let absolutePath = resolve(ctx.cwd, path);
			let selector: Selector | undefined = pathSelector;

			// `a.ts:10` could be a literal filename; prefer it when it exists.
			const literal = resolve(ctx.cwd, params.path);
			if (pathSelector && (await stat(literal).catch(() => null))) {
				shown = params.path;
				absolutePath = literal;
				selector = undefined;
			}
			if (!selector && (params.offset !== undefined || params.limit !== undefined)) {
				const start = params.offset ?? 1;
				selector = { kind: "ranges", ranges: [params.limit !== undefined ? { start, end: start + params.limit - 1 } : { start }] };
			}

			const builtin = () =>
				createReadToolDefinition(ctx.cwd).execute(
					toolCallId,
					{ path: absolutePath, offset: params.offset, limit: params.limit },
					signal,
					onUpdate,
					ctx,
				);

			const info = await stat(absolutePath).catch(() => null);
			if (!info?.isFile() || IMAGE_EXTENSIONS.has(extname(absolutePath).toLowerCase())) return builtin();
			const raw = await readFile(absolutePath, "utf8");
			if (raw.includes("\0")) return builtin();

			const lines = raw.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			const text = lines.join("\n");
			const total = lines.length;
			const { ledger, changed } = deps.ledger.sync(absolutePath, lines);
			if (changed) deps.persist(absolutePath);
			const row = (n: number) => formatRow(ledger.lines[n - 1].anchor, lines[n - 1]);

			const header = (note: string) => `${shown} (${total} lines)${note ? ` ${note}` : ""}`;

			const emitRanges = (ranges: Array<{ start: number; end: number }>) => {
				const { text: body, truncatedAt } = renderRanges(row, ranges, config);
				const notes: string[] = [];
				if (truncatedAt !== undefined) notes.push(`[output capped; continue with ${shown}:${truncatedAt}-]`);
				const label = ranges.length === 1 && ranges[0].start === 1 && ranges[0].end === total ? "" : `lines ${formatRanges(ranges)}`;
				return { content: [{ type: "text" as const, text: [header(label), body, ...notes].join("\n") }], details: undefined };
			};

			if (selector?.kind === "all") return emitRanges([{ start: 1, end: total }]);
			if (selector?.kind === "ranges") {
				const ranges = normalizeRanges(selector.ranges, total);
				if (!ranges.length) {
					return { content: [{ type: "text" as const, text: `${shown}: requested lines are beyond the end of the file (${total} lines).` }], details: undefined };
				}
				return emitRanges(ranges);
			}
			if (total <= config.thresholdLines) return emitRanges([{ start: 1, end: total }]);

			let nodes: OutlineNode[] | null = null;
			let sourceName = "";
			for (const source of deps.sources) {
				if (!source.supports(absolutePath)) continue;
				try {
					nodes = await source.outline(absolutePath, text, signal);
				} catch (error) {
					console.warn(`[outline-read] ${source.name} failed on ${shown}: ${error instanceof Error ? error.message : error}`);
				}
				if (nodes) {
					sourceName = source.name;
					break;
				}
			}
			if (!nodes && deps.fallback) {
				nodes = await deps.fallback(absolutePath, text, config, signal);
				if (nodes) sourceName = "model";
			}
			if (!nodes || !nodes.length) return emitRanges([{ start: 1, end: total }]);

			const rendered = renderOutline(lines, nodes, { minBodyLines: config.minBodyLines, budgetTokens: config.budgetTokens }, row, formatElision);
			if (!rendered.elisions.length) return emitRanges([{ start: 1, end: total }]);

			const example = formatRanges(rendered.elisions.slice(0, 2).map((e) => ({ start: e.startLine, end: e.endLine })));
			const footer = `[${rendered.elidedLines} lines elided (${sourceName} outline${rendered.level ? `, level ${rendered.level}` : ""}). Read what you need: ${shown}:${example}]`;
			return {
				content: [{ type: "text" as const, text: [header("outline"), rendered.text, footer].join("\n") }],
				details: undefined,
			};
		},
	});
}
