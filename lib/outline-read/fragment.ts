import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { withFileMutationQueue, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createTwoFilesPatch } from "diff";
import { Type } from "typebox";
import type { OutlineNode, OutlineSource } from "./outline/types";

// Edit by quoting: a hunk names its file and the text it replaces. Exact text that occurs once in the file is
// its own address; `until` extends it to a block without copying the middle; `near` (a line or @definition)
// breaks ties. Nothing to copy from read output, so read and grep can serve bare text.

export interface FragmentEdit {
	path: string;
	old?: string;
	until?: string;
	new: string;
	near?: number | string;
}

const DESCRIPTION = "Edit files by quoting the text to replace. Each edit names a path, the exact current text `old`, and its replacement `new`; one call may hold many edits across files, applied together (nothing is written if any edit fails).\n" +
	"- `old` must match exactly once (whitespace included). Quote the shortest fragment that is unique; to change a few words, quote just them.\n" +
	"- `until`: replace from the start of `old` through the end of the next occurrence of `until`, so a block needs only its first and last lines quoted.\n" +
	"- `near`: a line number (approximate is fine: the nearest match wins) or @name / @Class.method to search only inside that definition. With @name and no `old`, the whole definition is replaced.\n" +
	"- Insert by quoting a neighbor and repeating it in `new`. Delete with `new`: \"\".";

const parameters = Type.Object({
	edits: Type.Array(Type.Object({
		path: Type.String(),
		old: Type.Optional(Type.String({ description: "Exact current text; must occur once (within near's scope)" })),
		until: Type.Optional(Type.String({ description: "End fragment: the replaced span runs from old's start through this" })),
		new: Type.String({ description: "Replacement text, verbatim" }),
		near: Type.Optional(Type.Union([Type.Number(), Type.String()], { description: "Line hint, or @definition scope" })),
	})),
});

export interface Span { start: number; end: number }

const lineAt = (text: string, offset: number) => text.slice(0, offset).split("\n").length;
const lineStart = (text: string, line: number) => { let o = 0; for (let l = 1; l < line && o >= 0; l++) o = text.indexOf("\n", o) + 1; return Math.max(0, o); };

function occurrences(text: string, needle: string, from = 0, to = text.length): number[] {
	const out: number[] = [];
	if (!needle) return out;
	for (let i = text.indexOf(needle, from); i >= 0 && i + needle.length <= to; i = text.indexOf(needle, i + 1)) out.push(i);
	return out;
}

function findDefinition(nodes: OutlineNode[], path: string[]): OutlineNode[] {
	const [head, ...rest] = path;
	const hits: OutlineNode[] = [];
	const walk = (ns: OutlineNode[]) => {
		for (const n of ns) {
			if (n.name === head || n.name.endsWith("." + head)) hits.push(...(rest.length ? findDefinition(n.children, rest) : [n]));
			else walk(n.children);
		}
	};
	walk(nodes);
	return hits;
}

/** Resolve one edit to a character span of `text`; throws with what to change. */
export function resolveSpan(text: string, e: FragmentEdit, outline?: OutlineNode[] | null): Span {
	let from = 0, to = text.length, hint: number | undefined;
	if (typeof e.near === "string" && e.near.startsWith("@")) {
		if (!outline) throw new Error("no outline for this file, so @definitions are unavailable; use a line number");
		const defs = findDefinition(outline, e.near.slice(1).split("."));
		if (defs.length !== 1) throw new Error(e.near + (defs.length ? " is ambiguous: lines " + defs.map(d => d.startLine).join(", ") : " not found"));
		from = lineStart(text, defs[0].startLine);
		const endLine = lineStart(text, defs[0].endLine + 1);
		to = endLine > from ? endLine : text.length;
		if (e.old === undefined) {
			const end = text[to - 1] === "\n" ? to - 1 : to;
			return { start: from, end };
		}
	} else if (e.near !== undefined) {
		hint = Number(e.near);
		if (!Number.isFinite(hint)) throw new Error("near must be a line number or @definition");
	}
	if (e.old === undefined || e.old === "") throw new Error("old is required (or near: @definition to replace a whole definition)");
	let spans = occurrences(text, e.old, from, to).map(start => {
		if (e.until === undefined) return { start, end: start + e.old!.length };
		const u = text.indexOf(e.until, start + e.old!.length);
		return u < 0 || u + e.until.length > to ? undefined : { start, end: u + e.until.length };
	}).filter((s): s is Span => !!s);
	if (!spans.length) {
		const first = e.old.split("\n").find(l => l.trim())?.trim() ?? "";
		const near = first ? text.split("\n").flatMap((l, i) => (l.includes(first) ? [i + 1] : [])).slice(0, 8) : [];
		const missing = occurrences(text, e.old, from, to).length ? "until " + JSON.stringify((e.until ?? "").slice(0, 60)) + " not found after old" : "old not found" + (e.near ? " in " + e.near : "");
		throw new Error(missing + (near.length ? "; its first line (trimmed) is on lines " + near.join(", ") + ": check whitespace" : ""));
	}
	if (spans.length > 1 && hint !== undefined) {
		const dist = (s: Span) => Math.abs(lineAt(text, s.start) - hint!);
		spans.sort((a, b) => dist(a) - dist(b));
		if (dist(spans[0]) === dist(spans[1])) throw new Error("two matches equally near line " + hint + ": lines " + spans.slice(0, 2).map(s => lineAt(text, s.start)).join(", "));
		spans = [spans[0]];
	}
	if (spans.length > 1) throw new Error("old matches " + spans.length + " times (lines " + spans.slice(0, 10).map(s => lineAt(text, s.start)).join(", ") + "); quote more, or add near: a line or @definition");
	return spans[0];
}

/** Apply resolved edits to one file's text. */
export function applySpans(text: string, edits: Array<Span & { new: string }>): string {
	const sorted = [...edits].sort((a, b) => a.start - b.start);
	for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) throw new Error("edits overlap at line " + lineAt(text, sorted[i].start) + "; merge them");
	let out = text;
	for (const e of sorted.reverse()) out = out.slice(0, e.start) + e.new + out.slice(e.end);
	return out;
}

export function registerFragmentEditTool(pi: ExtensionAPI, deps: { sources: OutlineSource[] }): void {
	pi.registerTool({
		name: "edit",
		label: "edit",
		description: DESCRIPTION,
		promptSnippet: "Edit files by quoting the text to replace; many edits and files per call",
		promptGuidelines: [
			"Use edit for file changes; quote the shortest unique fragment as old, not whole functions. Put every change of a turn in one edit call.",
		],
		parameters,
		async execute(_id, params, _signal, _onUpdate, ctx) {
			return applyFragmentEdits(ctx.cwd, params.edits as FragmentEdit[], deps.sources);
		},
	});
}

export async function applyFragmentEdits(cwd: string, edits: FragmentEdit[], sources: OutlineSource[] = []) {
	if (!edits.length) throw new Error("No edits given.");
	const byFile = new Map<string, Array<FragmentEdit & { i: number }>>();
	edits.forEach((e, i) => { const p = resolve(cwd, e.path); (byFile.get(p) ?? byFile.set(p, []).get(p)!).push({ ...e, i }); });
	const shown = (p: string) => (relative(cwd, p).startsWith("..") ? p : relative(cwd, p));
	// Resolve everything before writing anything.
	const plans: Array<{ path: string; before: string; after: string; lines: number[] }> = [];
	const errors: string[] = [];
	for (const [path, fileEdits] of byFile) {
		const before = await readFile(path, "utf8").catch(() => undefined);
		if (before === undefined) { errors.push(shown(path) + ": no such file (create files with write)"); continue; }
		let outline: OutlineNode[] | null | undefined;
		const spans: Array<Span & { new: string }> = [];
		for (const e of fileEdits) {
			if (typeof e.near === "string" && e.near.startsWith("@") && outline === undefined) {
				const source = sources.find(s => s.supports(path));
				outline = source ? await source.outline(path, before).catch(() => null) : null;
			}
			try { spans.push({ ...resolveSpan(before, e, outline), new: e.new }); }
			catch (err) { errors.push("edit " + (e.i + 1) + " (" + shown(path) + "): " + (err as Error).message); }
		}
		if (spans.length < fileEdits.length) continue;
		try { plans.push({ path, before, after: applySpans(before, spans), lines: spans.map(s => lineAt(before, s.start)).sort((a, b) => a - b) }); }
		catch (err) { errors.push(shown(path) + ": " + (err as Error).message); }
	}
	if (errors.length) throw new Error(errors.join("\n") + "\nNothing was modified.");
	const reports: string[] = [], patches: string[] = [];
	for (const p of plans) {
		await withFileMutationQueue(p.path, async () => {
			if ((await readFile(p.path, "utf8")) !== p.before) throw new Error(shown(p.path) + " changed during the edit; retry. Files already written: " + reports.length);
			await writeFile(p.path, p.after, "utf8");
		});
		const n = (s: string) => s.split("\n").length - (s.endsWith("\n") ? 1 : 0);
		reports.push(shown(p.path) + ": " + p.lines.length + " edit" + (p.lines.length === 1 ? "" : "s") + " at " + p.lines.join(", ") + " (" + n(p.before) + " → " + n(p.after) + " lines)");
		patches.push(createTwoFilesPatch(shown(p.path), shown(p.path), p.before, p.after, "", "", { context: 2 }));
	}
	return {
		content: [{ type: "text" as const, text: reports.join("\n") }],
		details: { diff: patches.join("\n"), patch: patches.join("\n"), firstChangedLine: plans[0]?.lines[0] },
	};
}
