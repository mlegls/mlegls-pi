import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { withFileMutationQueue, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createTwoFilesPatch } from "diff";
import { Type } from "typebox";
import { ANCHOR_LENGTH, ALPHABET, formatRow, stripPastedPrefix } from "./anchors";
import type { Ledger } from "./ledger";

const GRAMMAR = `Hunks separated by one blank line. A hunk is a header line, then the new lines:
  =abcd         replace line abcd
  =abcd wxyz    replace abcd..wxyz inclusive
  -abcd wxyz    delete abcd..wxyz (no body)
  >abcd         insert after abcd
  <abcd         insert before abcd
A header may end with @path to assert which file the anchors belong to; a mismatch rejects the call.`;

const parameters = Type.Object({
	edits: Type.String({ description: GRAMMAR }),
});

export interface EditDeps {
	ledger: Ledger;
	persist: (path: string) => void;
}

export interface Hunk {
	/** Header as written, for messages. */
	header: string;
	from: string;
	to?: string;
	/** `@path` assertion, if given. */
	path?: string;
	mode: "replace" | "delete" | "after" | "before";
	lines: string[];
}

interface ResolvedEdit {
	start: number;
	/** Exclusive. */
	end: number;
	lines: string[];
	header: string;
}

const ANCHOR = new RegExp(`^[${ALPHABET}]{${ANCHOR_LENGTH}}$`);
const SIGILS: Record<string, Hunk["mode"]> = { "=": "replace", "-": "delete", ">": "after", "<": "before" };

/** Parse a header line; `known` decides whether a word is an anchor. A pasted read row `abcd│text` is cut at the bar. */
function parseHeader(line: string, known: (a: string) => boolean): Omit<Hunk, "lines"> | undefined {
	const bar = line.indexOf("│");
	const head = (bar >= 0 ? line.slice(0, bar) : line).trim();
	const mode = SIGILS[head[0]];
	if (!mode) return undefined;
	const tokens = head.slice(1).trim().split(/\s+/).filter(Boolean);
	const path = tokens[tokens.length - 1]?.startsWith("@") ? tokens.pop()!.slice(1) : undefined;
	if (tokens.length === 0 || tokens.length > 2 || !tokens.every((t) => ANCHOR.test(t) && known(t))) return undefined;
	if (tokens.length === 2 && (mode === "after" || mode === "before")) return undefined;
	return { header: head, from: tokens[0], to: tokens[1], mode, path };
}

export function parseHunks(text: string, known: (a: string) => boolean): Hunk[] {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
	const hunks: Hunk[] = [];
	let i = 0;
	while (i < lines.length && lines[i].trim() === "") i++;
	if (i >= lines.length) throw new Error("No edits given.");
	const first = parseHeader(lines[i], known);
	if (!first) throw new Error(`Line 1 is not a hunk header of known anchors: "${lines[i].slice(0, 40)}".\n${GRAMMAR}`);
	let current: Hunk = { ...first, lines: [] };
	for (i++; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "" && i + 1 < lines.length) {
			const next = parseHeader(lines[i + 1], known);
			if (next) {
				hunks.push(current);
				current = { ...next, lines: [] };
				i++;
				continue;
			}
		}
		current.lines.push(line);
	}
	hunks.push(current);
	for (const h of hunks) {
		if (h.mode === "delete" && h.lines.length) throw new Error(`"${h.header}": a delete takes no lines. Nothing was modified.`);
		if (h.mode !== "delete" && h.lines.length === 0) {
			if (h.mode === "after" || h.mode === "before") h.lines = [""];
			else throw new Error(`"${h.header}": no lines given; use -${h.header.slice(1)} to delete. Nothing was modified.`);
		}
	}
	return hunks;
}

export function registerEditTool(pi: ExtensionAPI, deps: EditDeps): void {
	pi.registerTool({
		name: "edit",
		label: "edit",
		description:
			"Edit files by line anchors from read/grep output (`abcd│text`). Anchors are unique across files, so no path is needed; one call may touch several files. A file's anchors share their first character.\n" +
			GRAMMAR +
			"\nAnchors survive your own edits and edits elsewhere in the file; a line that changed on disk gets a new anchor and the old one is rejected.",
		promptSnippet: "Edit files by anchor: replace an anchored line or range, or insert next to one; many hunks and files per call",
		promptGuidelines: [
			"Use edit with anchors copied from read or grep output; do not invent anchors or include the `abcd│` prefix in new lines.",
			"Put every change of a turn in one edit call, separated by blank lines; anchors from an earlier read remain valid after your own edits.",
		],
		parameters,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			return executeEdits(deps, ctx.cwd, params.edits);
		},
	});
}

function splitLines(raw: string): { lines: string[]; trailingNewline: boolean } {
	const trailingNewline = raw.endsWith("\n");
	const lines = raw.split("\n");
	if (lines.length > 1 && trailingNewline) lines.pop();
	return { lines, trailingNewline };
}

async function applyToFile(deps: EditDeps, absolutePath: string, shown: string, hunks: Hunk[]) {
	return withFileMutationQueue(absolutePath, async () => {
		const raw = await readFile(absolutePath, "utf8");
		const { lines, trailingNewline } = splitLines(raw);

		const warnings: string[] = [];
		const { ledger, changed, fresh } = deps.ledger.sync(absolutePath, lines);
		if (changed) {
			deps.persist(absolutePath);
			warnings.push("File changed on disk since it was read; anchors of unchanged lines still apply.");
		}

		const missing = new Set<string>();
		const resolved: ResolvedEdit[] = [];
		const at = (anchor: string) => {
			const index = ledger.lines.findIndex((line) => line.anchor === anchor);
			if (index < 0) missing.add(anchor);
			return index;
		};
		for (const h of hunks) {
			const newLines = h.lines.map((line) => {
				const stripped = stripPastedPrefix(line);
				if (stripped !== line) warnings.push(`Stripped a pasted anchor prefix from "${line.slice(0, 20)}".`);
				return stripped;
			});
			if (h.mode === "after" || h.mode === "before") {
				const index = at(h.from);
				if (index < 0) continue;
				const start = h.mode === "after" ? index + 1 : index;
				resolved.push({ start, end: start, lines: newLines, header: h.header });
			} else {
				let start = at(h.from);
				let end = h.to !== undefined ? at(h.to) : start;
				if (start < 0 || end < 0) continue;
				if (end < start) {
					[start, end] = [end, start];
					warnings.push(`"${h.header}": range was reversed; swapped.`);
				}
				resolved.push({ start, end: end + 1, lines: newLines, header: h.header });
			}
		}
		if (missing.size) {
			const rows = fresh.slice(0, 40).map((i) => formatRow(ledger.lines[i].anchor, ledger.lines[i].text));
			const current = rows.length ? `\nLines changed on disk, with current anchors:\n${rows.join("\n")}${fresh.length > rows.length ? "\n⋯" : ""}` : "";
			throw new Error(
				`${shown}: unknown anchors ${[...missing].join(", ")}; the lines changed since they were read. Nothing was modified.${current}${rows.length ? "" : ` Read ${shown} (or the relevant range) again for current anchors.`}`,
			);
		}

		resolved.sort((a, b) => a.start - b.start || a.end - b.end);
		for (let i = 1; i < resolved.length; i++) {
			if (resolved[i].start < resolved[i - 1].end) throw new Error(`${shown}: "${resolved[i - 1].header}" and "${resolved[i].header}" overlap. Merge them into one hunk. Nothing was modified.`);
		}

		const next = [...lines];
		for (const edit of [...resolved].reverse()) next.splice(edit.start, edit.end - edit.start, ...edit.lines);
		if (next.length === lines.length && next.every((line, i) => line === lines[i])) {
			return { text: `${shown}: no changes; the new lines equal the old ones.` };
		}

		const text = next.join("\n") + (trailingNewline ? "\n" : "");
		await writeFile(absolutePath, text, "utf8");
		const after = deps.ledger.sync(absolutePath, next).ledger;
		deps.persist(absolutePath);

		// Anchored diff: removed lines bare, added and context lines with anchors.
		const CONTEXT = 2;
		const hunkTexts: string[] = [];
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
			hunkTexts.push(`@@ ${span(edit.start, edit.end)} → ${span(newStart, newEnd)} @@\n${rows.join("\n")}`);
			delta += edit.lines.length - (edit.end - edit.start);
		}
		const summary = `${shown}: ${resolved.length} edit${resolved.length === 1 ? "" : "s"} applied (${lines.length} → ${next.length} lines).`;
		return {
			text: [summary, ...warnings.map((w) => `[${w}]`), ...hunkTexts].join("\n"),
			diff: hunkTexts.join("\n"),
			patch: createTwoFilesPatch(shown, shown, lines.join("\n") + "\n", next.join("\n") + "\n", "", "", { context: CONTEXT }),
			firstChangedLine: resolved[0].start + 1,
		};
	});
}

/** Execute the same anchor DSL used by the edit tool. */
export async function executeEdits(deps: EditDeps, cwd: string, text: string) {
	// Make restored (resumed-session) files addressable before parsing.
	for (const path of deps.ledger.pendingPaths()) {
		const raw = await readFile(path, "utf8").catch(() => undefined);
		if (raw !== undefined) deps.ledger.sync(path, splitLines(raw).lines);
	}
	const known = (a: string) => deps.ledger.find(a) !== undefined;
	const hunks = parseHunks(text, known);
	return executeHunks(deps, cwd, hunks);
}

/** Apply structured hunks without interpreting replacement text as DSL headers. */
export async function executeHunks(deps: EditDeps, cwd: string, hunks: Hunk[]) {
	// Validate every file assertion before applying any edits.
	const byFile = new Map<string, Hunk[]>();
	for (const h of hunks) {
		const from = deps.ledger.find(h.from);
		if (!from || (h.to && !deps.ledger.find(h.to))) throw new Error(`"${h.header}": unknown anchors; read the file again. Nothing was modified.`);
		const path = from.path;
		const toPath = h.to && deps.ledger.find(h.to)!.path;
		if (toPath && toPath !== path) throw new Error(`"${h.header}": anchors are in different files. Nothing was modified.`);
		if (h.path !== undefined && resolve(cwd, h.path) !== path) {
			throw new Error(`"${h.header}": anchor ${h.from} is in ${relative(cwd, path)}, not ${h.path}. Nothing was modified.`);
		}
		(byFile.get(path) ?? byFile.set(path, []).get(path)!).push(h);
	}

	const reports: string[] = [];
	const patches: string[] = [];
	const diffs: string[] = [];
	let firstChangedLine: number | undefined;
	for (const [absolutePath, fileHunks] of byFile) {
		const shown = relative(cwd, absolutePath).startsWith("..") ? absolutePath : relative(cwd, absolutePath);
		const r = await applyToFile(deps, absolutePath, shown, fileHunks);
		reports.push(r.text);
		if (r.patch) patches.push(r.patch);
		if (r.diff) diffs.push(r.diff);
		if (r.firstChangedLine !== undefined && firstChangedLine === undefined) firstChangedLine = r.firstChangedLine;
	}
	return {
		content: [{ type: "text" as const, text: reports.join("\n\n") || "No changes." }],
		details: patches.length ? { diff: diffs.join("\n"), patch: patches.join("\n"), firstChangedLine } : undefined,
	};
}
