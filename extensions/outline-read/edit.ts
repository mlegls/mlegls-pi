import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withFileMutationQueue, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createTwoFilesPatch } from "diff";
import { Type } from "typebox";
import { formatRow, isAnchor, stripPastedPrefix } from "./anchors";
import type { Ledger } from "./ledger";

const parameters = Type.Object({
	path: Type.String({ description: "File to edit. It must have been read in this session." }),
	edits: Type.Array(
		Type.Object({
			from: Type.Optional(Type.String({ description: "Anchor of the first line to replace (inclusive)." })),
			to: Type.Optional(Type.String({ description: "Anchor of the last line to replace (inclusive); defaults to `from`." })),
			after: Type.Optional(Type.String({ description: "Insert after this anchor's line instead of replacing." })),
			before: Type.Optional(Type.String({ description: "Insert before this anchor's line instead of replacing." })),
			lines: Type.Array(Type.String(), {
				description: "New lines, one element per line, without anchor prefixes. `[]` with from/to deletes the range.",
			}),
		}),
		{ description: "Edits against the file as last read. They must not overlap; all apply together." },
	),
});

export interface EditDeps {
	ledger: Ledger;
	persist: (path: string) => void;
}

interface ResolvedEdit {
	start: number;
	/** Exclusive. */
	end: number;
	lines: string[];
}

export function registerEditTool(pi: ExtensionAPI, deps: EditDeps): void {
	pi.registerTool({
		name: "edit",
		label: "edit",
		description:
			"Edit a file by line anchors from read output (`abcd│text`). Each edit replaces the inclusive range from..to with lines, or inserts lines after/before an anchor. " +
			"Anchors stay valid across edits made with this tool; a line that changed on disk gets a new anchor and the old one is rejected.",
		promptSnippet: "Edit files by anchor: replace an anchored line range or insert next to an anchored line",
		promptGuidelines: [
			"Use edit with anchors copied from read output; do not invent anchors or include the `abcd│` prefix in new lines.",
			"Put all changes to one file in a single edit call with several entries; anchors from an earlier read remain valid after your own edits.",
		],
		parameters,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const absolutePath = resolve(ctx.cwd, params.path);
			if (!deps.ledger.known(absolutePath)) {
				throw new Error(`No anchors for ${params.path} in this session. Read it first.`);
			}
			return withFileMutationQueue(absolutePath, async () => {
				const raw = await readFile(absolutePath, "utf8");
				const trailingNewline = raw.endsWith("\n");
				const lines = raw.split("\n");
				if (lines.length > 1 && trailingNewline) lines.pop();

				const warnings: string[] = [];
				const { ledger, changed, fresh } = deps.ledger.sync(absolutePath, lines);
				if (changed) {
					deps.persist(absolutePath);
					warnings.push("File changed on disk since it was read; anchors of unchanged lines still apply.");
				}

				const missing = new Set<string>();
				const resolved: ResolvedEdit[] = [];
				for (const [i, edit] of params.edits.entries()) {
					const refs = [edit.from, edit.to, edit.after, edit.before].filter((a): a is string => a !== undefined).map(stripPastedPrefix);
					const modes = [edit.from, edit.after, edit.before].filter((a) => a !== undefined).length;
					if (modes !== 1) throw new Error(`edits[${i}]: give exactly one of from, after, before.`);
					for (const ref of refs) if (!isAnchor(ref)) throw new Error(`edits[${i}]: "${ref}" is not a 4-character anchor.`);
					const at = (anchor: string) => {
						const index = ledger.lines.findIndex((line) => line.anchor === anchor);
						if (index < 0) missing.add(anchor);
						return index;
					};
					const newLines = edit.lines.map((line) => {
						const stripped = stripPastedPrefix(line);
						if (stripped !== line) warnings.push(`Stripped a pasted anchor prefix from "${line.slice(0, 20)}".`);
						return stripped;
					});
					if (edit.after !== undefined || edit.before !== undefined) {
						const index = at(stripPastedPrefix(edit.after ?? edit.before!));
						if (index < 0) continue;
						const start = edit.after !== undefined ? index + 1 : index;
						resolved.push({ start, end: start, lines: newLines });
					} else {
						let start = at(stripPastedPrefix(edit.from!));
						let end = edit.to !== undefined ? at(stripPastedPrefix(edit.to)) : start;
						if (start < 0 || end < 0) continue;
						if (end < start) {
							[start, end] = [end, start];
							warnings.push(`edits[${i}]: from/to were reversed; swapped.`);
						}
						resolved.push({ start, end: end + 1, lines: newLines });
					}
				}
				if (missing.size) {
					const shown = fresh.slice(0, 40).map((i) => formatRow(ledger.lines[i].anchor, ledger.lines[i].text));
					const current = shown.length ? `\nLines changed on disk, with current anchors:\n${shown.join("\n")}${fresh.length > shown.length ? "\n⋯" : ""}` : "";
					throw new Error(
						`Unknown anchors: ${[...missing].join(", ")}. The lines changed or were never read. Nothing was modified.${current}${shown.length ? "" : ` Read ${params.path} (or the relevant range) again for current anchors.`}`,
					);
				}

				resolved.sort((a, b) => a.start - b.start || a.end - b.end);
				for (let i = 1; i < resolved.length; i++) {
					if (resolved[i].start < resolved[i - 1].end) throw new Error("Edits overlap. Merge them into one entry. Nothing was modified.");
				}

				const next = [...lines];
				for (const edit of [...resolved].reverse()) next.splice(edit.start, edit.end - edit.start, ...edit.lines);
				if (next.length === lines.length && next.every((line, i) => line === lines[i])) {
					return { content: [{ type: "text" as const, text: "No changes: the new lines equal the old ones." }], details: undefined };
				}

				const text = next.join("\n") + (trailingNewline ? "\n" : "");
				await writeFile(absolutePath, text, "utf8");
				const after = deps.ledger.sync(absolutePath, next).ledger;
				deps.persist(absolutePath);

				// Anchored diff: removed lines bare, added and context lines with anchors.
				const CONTEXT = 2;
				const hunks: string[] = [];
				let delta = 0;
				for (const edit of resolved) {
					const newStart = edit.start + delta;
					const newEnd = newStart + edit.lines.length;
					const rows: string[] = [];
					for (let i = Math.max(0, newStart - CONTEXT); i < newStart; i++) rows.push(` ${formatRow(after.lines[i].anchor, after.lines[i].text)}`);
					for (let i = edit.start; i < edit.end; i++) rows.push(`-${lines[i]}`);
					for (let i = newStart; i < newEnd; i++) rows.push(`+${formatRow(after.lines[i].anchor, after.lines[i].text)}`);
					for (let i = newEnd; i < Math.min(after.lines.length, newEnd + CONTEXT); i++) rows.push(` ${formatRow(after.lines[i].anchor, after.lines[i].text)}`);
					const span = (start: number, end: number) => (end - start > 1 ? `${start + 1}-${end}` : end > start ? `${start + 1}` : `at ${start + 1}`);
					hunks.push(`@@ ${span(edit.start, edit.end)} → ${span(newStart, newEnd)} @@\n${rows.join("\n")}`);
					delta += edit.lines.length - (edit.end - edit.start);
				}
				const summary = `${params.path}: ${resolved.length} edit${resolved.length === 1 ? "" : "s"} applied (${lines.length} → ${next.length} lines).`;
				const body = [summary, ...warnings.map((w) => `[${w}]`), ...hunks].join("\n");
				return {
					content: [{ type: "text" as const, text: body }],
					details: {
						diff: hunks.join("\n"),
						patch: createTwoFilesPatch(params.path, params.path, lines.join("\n") + "\n", next.join("\n") + "\n", "", "", { context: CONTEXT }),
						firstChangedLine: resolved[0].start + 1,
					},
				};
			});
		},
	});
}
