import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { getAgentDir, truncateHead, truncateLine, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { formatRow } from "./anchors";
import { loadConfig } from "./config";
import type { Ledger } from "./ledger";
import type { OutlineNode, OutlineSource } from "./outline/types";

const parameters = Type.Object({
	pattern: Type.String({ description: "Search pattern (regex or literal string)" }),
	path: Type.Optional(Type.String({ description: "Directory or file to search (default: current directory)" })),
	glob: Type.Optional(Type.String({ description: "Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'" })),
	ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search (default: false)" })),
	literal: Type.Optional(Type.Boolean({ description: "Treat pattern as literal string instead of regex (default: false)" })),
	context: Type.Optional(Type.Number({ description: "Number of lines to show before and after each match (default: 0)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of matches to return (default: 100)" })),
});

const DEFAULT_LIMIT = 100;

export interface GrepDeps {
	ledger: Ledger;
	persist: (path: string) => void;
	/** Structural sources only; grep never calls the model fallback. */
	sources: OutlineSource[];
}

interface Match {
	file: string;
	line: number;
}

function rgPath(): string {
	const local = join(getAgentDir(), "bin", "rg");
	return existsSync(local) ? local : "rg";
}

/** Run ripgrep and collect up to `limit` matches in output order. */
function search(args: string[], limit: number, signal?: AbortSignal): Promise<{ matches: Match[]; limited: boolean }> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(rgPath(), ["--json", "--line-number", "--color=never", "--hidden", ...args], { stdio: ["ignore", "pipe", "pipe"] });
		const matches: Match[] = [];
		let limited = false;
		let stderr = "";
		const onAbort = () => child.kill();
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stderr.on("data", (chunk) => (stderr += chunk));
		createInterface({ input: child.stdout }).on("line", (line) => {
			if (limited) return;
			let event: any;
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}
			if (event.type !== "match") return;
			const file = event.data?.path?.text;
			const lineNumber = event.data?.line_number;
			if (typeof file === "string" && typeof lineNumber === "number") matches.push({ file, line: lineNumber });
			if (matches.length >= limit) {
				limited = true;
				child.kill();
			}
		});
		child.on("error", (error) => reject(new Error(`Failed to run ripgrep: ${error.message}`)));
		child.on("close", (code) => {
			signal?.removeEventListener("abort", onAbort);
			if (signal?.aborted) return reject(new Error("Operation aborted"));
			if (!limited && code !== 0 && code !== 1) return reject(new Error(stderr.trim() || `ripgrep exited with code ${code}`));
			resolvePromise({ matches, limited });
		});
	});
}

/** Innermost definitions containing `line`, outermost first. */
export function enclosing(nodes: OutlineNode[], line: number): OutlineNode[] {
	for (const node of nodes) {
		if (node.startLine <= line && line <= node.endLine) return [node, ...enclosing(node.children, line)];
	}
	return [];
}

/** Merge overlapping or adjacent [start,end] windows, keeping the match lines. */
function blocks(lines: number[], context: number, total: number): Array<{ start: number; end: number; matches: Set<number> }> {
	const out: Array<{ start: number; end: number; matches: Set<number> }> = [];
	for (const line of [...new Set(lines)].sort((a, b) => a - b)) {
		const start = Math.max(1, line - context);
		const end = Math.min(total, line + context);
		const last = out[out.length - 1];
		if (last && start <= last.end + 1) {
			last.end = Math.max(last.end, end);
			last.matches.add(line);
		} else {
			out.push({ start, end, matches: new Set([line]) });
		}
	}
	return out;
}

export function registerGrepTool(pi: ExtensionAPI, deps: GrepDeps): void {
	pi.registerTool({
		name: "grep",
		label: "grep",
		description:
			`Search file contents for a pattern (ripgrep; respects .gitignore). Matches are grouped by file and by the enclosing definition or heading, ` +
			`shown as \`line anchor│text\`; the anchors work directly with edit, so grep → edit needs no read in between. ` +
			`Output is truncated to ${DEFAULT_LIMIT} matches or 50KB.`,
		promptSnippet: "Search file contents for patterns; results carry line anchors usable by edit",
		promptGuidelines: [
			"Grep results show the enclosing definition and its line range; read that range if you need the full body.",
		],
		parameters,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const config = loadConfig(ctx.cwd);
			const searchPath = resolve(ctx.cwd, params.path || ".");
			const info = await stat(searchPath).catch(() => null);
			if (!info) throw new Error(`Path not found: ${searchPath}`);
			const isDirectory = info.isDirectory();
			const display = (file: string) => {
				if (isDirectory) {
					const rel = relative(searchPath, file);
					if (rel && !rel.startsWith("..")) return rel.replace(/\\/g, "/");
				}
				return basename(file);
			};

			const args: string[] = [];
			if (params.ignoreCase) args.push("--ignore-case");
			if (params.literal) args.push("--fixed-strings");
			if (params.glob) args.push("--glob", params.glob);
			args.push("--", params.pattern, searchPath);
			const limit = Math.max(1, params.limit ?? DEFAULT_LIMIT);
			const { matches, limited } = await search(args, limit, signal);
			if (!matches.length) return { content: [{ type: "text" as const, text: "No matches found" }], details: undefined };

			const byFile = new Map<string, number[]>();
			for (const match of matches) {
				const file = resolve(match.file);
				byFile.set(file, [...(byFile.get(file) ?? []), match.line]);
			}

			const context = Math.max(0, params.context ?? 0);
			let linesTruncated = false;
			let unanchored = 0;
			const sections: string[] = [];
			let anchoredFiles = 0;
			for (const [file, matchLines] of byFile) {
				const shown = display(file);
				const raw = await readFile(file, "utf8").catch(() => null);
				if (raw === null || raw.includes("\0") || anchoredFiles >= config.grepAnchorFiles) {
					unanchored++;
					sections.push(matchLines.map((line) => `${shown}:${line}:`).join("\n"));
					continue;
				}
				anchoredFiles++;
				const lines = raw.split("\n");
				if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
				const { ledger, changed } = deps.ledger.sync(file, lines);
				if (changed) deps.persist(file);

				let nodes: OutlineNode[] = [];
				const source = deps.sources.find((s) => s.supports(file));
				if (source) nodes = (await source.outline(file, lines.join("\n"), signal).catch(() => null)) ?? [];

				const out: string[] = [shown];
				let lastHeader: string | undefined;
				let lastEnd = 0;
				for (const block of blocks(matchLines, context, lines.length)) {
					const chain = enclosing(nodes, [...block.matches][0]);
					const inner = chain[chain.length - 1];
					const header = inner ? `  ${chain.map((n) => n.name).join(".")} (${inner.startLine}-${inner.endLine})` : undefined;
					if (header !== lastHeader) {
						if (header) out.push(header);
						lastHeader = header;
					} else if (block.start > lastEnd + 1) {
						out.push("    ⋯");
					}
					for (let n = block.start; n <= block.end; n++) {
						const { text, wasTruncated } = truncateLine(lines[n - 1]);
						if (wasTruncated) linesTruncated = true;
						const marker = context > 0 ? (block.matches.has(n) ? ">" : " ") : " ";
						out.push(`  ${marker} ${String(n).padStart(4)} ${formatRow(ledger.lines[n - 1].anchor, text)}`);
					}
					lastEnd = block.end;
				}
				sections.push(out.join("\n"));
			}

			const truncation = truncateHead(sections.join("\n\n"), { maxLines: Number.MAX_SAFE_INTEGER });
			let output = truncation.content;
			const notices: string[] = [];
			const details: Record<string, unknown> = {};
			if (limited) {
				notices.push(`${limit} matches limit reached. Use limit=${limit * 2} for more, or refine pattern`);
				details.matchLimitReached = limit;
			}
			if (truncation.truncated) {
				notices.push("50KB limit reached");
				details.truncation = truncation;
			}
			if (linesTruncated) {
				notices.push("Some lines truncated. Use read to see full lines");
				details.linesTruncated = true;
			}
			if (unanchored) notices.push(`${unanchored} file(s) listed without anchors (cap ${config.grepAnchorFiles}); read them for anchors`);
			if (notices.length) output += `\n\n[${notices.join(". ")}]`;
			return { content: [{ type: "text" as const, text: output }], details: Object.keys(details).length ? details : undefined };
		},
	});
}
