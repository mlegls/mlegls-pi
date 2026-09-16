import { register, format } from "./passive.cjs";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute, join, matchesGlob, relative, resolve } from "node:path";
import { types } from "node:util";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { formatRow } from "../outline-read/anchors";
import { executeEdits, executeHunks, type Hunk } from "../outline-read/edit";
import type { Ledger } from "../outline-read/ledger";
import { markdownSource } from "../outline-read/outline/markdown";
import { treeSitterSource } from "../outline-read/outline/treesitter";
import { renderOutline } from "../outline-read/outline/render";
import type { OutlineNode } from "../outline-read/outline/types";
import { createImageFile, detectImageMimeType, looksLikeImageFile, type ImageFile } from "./image";

function sourceLines(raw: string): string[] {
	const lines = raw.split("\n");
	if (lines.length > 1 && lines.at(-1) === "") lines.pop();
	return lines;
}

function shownPath(path: string): string {
	if (path.length <= 160) return path;
	return path.slice(0, 96) + "…[" + path.length + " chars]";
}
function fsError(path: string, err: unknown): Error {
	const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : undefined;
	const shown = shownPath(path);
	if (code === "EISDIR") return new Error(shown + " is a directory; use find() or read a file");
	if (code === "ENAMETOOLONG") return new Error(shown + ": ENAMETOOLONG; pass a file path or a read() result, not file contents");
	if (code === "ENOENT") return new Error(shown + ": not found");
	const raw = err instanceof Error ? err.message : String(err);
	const detail = raw.length > 240 ? raw.slice(0, 160) + "…[" + raw.length + " chars]" : raw;
	return new Error(shown + ": " + detail);
}

export interface SourceDeps {
	cwd: string;
	ledger: Ledger;
	persist(path: string): void;
	signal?: AbortSignal;
}
export interface SourceRow {
	readonly anchor: string;
	readonly text: string;
	readonly path: string;
	/** One-based line in the captured snapshot. */
	readonly line: number;
}
export interface GrepOptions {
	glob?: string;
	ignoreCase?: boolean;
	literal?: boolean;
	/** Maximum matching lines; complete=false if more exist. No implicit limit. */
	limit?: number;
}
export interface FindOptions {
	paths?: string | string[];
	hidden?: boolean;
}

export class SourceFile {
	readonly rows: readonly SourceRow[];
	constructor(readonly path: string, readonly text: string, anchors: readonly { anchor: string; text: string }[]) {
		this.rows = Object.freeze(anchors.map((row, i) => Object.freeze({ ...row, path, line: i + 1 })));
		register(this, "source");
	}
	lines(start = 1, end = this.rows.length): SourceSelection {
		if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw new Error("Expected a one-based inclusive line range");
		return new SourceSelection(this.rows.slice(start - 1, end), new Map([[this.path, this]]));
	}
	async nodes(): Promise<OutlineNode[]> {
		for (const source of [treeSitterSource, markdownSource]) {
			if (!source.supports(this.path)) continue;
			const nodes = await source.outline(this.path, this.text);
			if (nodes) return nodes;
		}
		return [];
	}
	async outline() {
		const nodes = await this.nodes();
		const rendered = renderOutline(this.rows.map(r => r.text), nodes,
			{ minBodyLines: 3, budgetTokens: Infinity },
			n => `${n} ${formatRow(this.rows[n - 1].anchor, this.rows[n - 1].text)}`,
			e => `    ⋯ ${e.startLine}-${e.endLine}`);
		return { path: this.path, nodes, ...rendered, render: () => `${this.path} (${this.rows.length} lines) outline\n${rendered.text}` };
	}
	render(): string { return format(this, Infinity)!.text; }
}

/** Rows and expansions refer to captured file snapshots, never to a later disk read. */
export class SourceSelection implements Iterable<SourceRow> {
	readonly rows: readonly SourceRow[];
	constructor(rows: readonly SourceRow[], private readonly files: ReadonlyMap<string, SourceFile>, readonly complete = true) {
		this.rows = Object.freeze([...new Map(rows.map(r => [`${r.path}\0${r.anchor}`, r])).values()]);
		register(this, "source");
	}
	[Symbol.iterator]() { return this.rows[Symbol.iterator](); }
	filter(predicate: (row: SourceRow, index: number) => boolean): SourceSelection {
		return new SourceSelection(this.rows.filter(predicate), this.files, this.complete);
	}
	slice(start?: number, end?: number): SourceSelection {
		return new SourceSelection(this.rows.slice(start, end), this.files, this.complete);
	}
	map<T>(fn: (row: SourceRow, index: number) => T): T[] { return this.rows.map(fn); }
	join(separator = "\n"): string { return this.rows.map(row => row.text).join(separator); }
	context(n: number): SourceSelection {
		if (!Number.isInteger(n) || n < 0) throw new Error("Context must be a nonnegative integer");
		const rows = this.rows.flatMap(r => this.files.get(r.path)!.rows.slice(Math.max(0, r.line - n - 1), r.line + n));
		return this.expanded(rows);
	}
	async enclosing(): Promise<SourceSelection> {
		const rows: SourceRow[] = [];
		for (const [path, file] of this.files) {
			const nodes = await file.nodes();
			const innermost = (nodes: OutlineNode[], line: number): OutlineNode | undefined => {
				const node = nodes.find(n => n.startLine <= line && line <= n.endLine);
				return node && (innermost(node.children, line) ?? node);
			};
			for (const row of this.rows.filter(r => r.path === path)) {
				const node = innermost(nodes, row.line);
				for (const selected of node ? file.rows.slice(node.startLine - 1, node.endLine) : [row]) rows.push(selected);
			}
		}
		return this.expanded(rows);
	}
	private expanded(rows: SourceRow[]): SourceSelection {
		const order = [...this.files.keys()];
		rows.sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path) || a.line - b.line);
		return new SourceSelection(rows, this.files, this.complete);
	}
	render(): string { return format(this, Infinity)!.text; }
}

function isGrepOptions(value: unknown): value is GrepOptions {
	return !!value && typeof value === "object" && !Array.isArray(value)
		&& !(value instanceof SourceFile)
		&& !(value instanceof SourceSelection)
		&& typeof (value as { path?: unknown }).path !== "string";
}
function grepPaths(value: unknown): string[] | undefined {
	if (value == null) return undefined;
	if (typeof value === "string") return [value];
	if (value instanceof SourceFile) return [value.path];
	if (value instanceof SourceSelection) return [...new Set(value.rows.map(row => row.path))];
	if (Array.isArray(value)) {
		const out: string[] = [];
		for (const item of value) {
			const part = grepPaths(item);
			if (!part) throw new Error("grep paths must be strings or read results");
			out.push(...part);
		}
		return out;
	}
	if (typeof value === "object" && typeof (value as { path?: unknown }).path === "string") return [(value as { path: string }).path];
	return undefined;
}

export type EditTarget = string | SourceRow;
export type EditRange = EditTarget | [EditTarget, EditTarget];
export type SourceEdit =
	| { replace: EditRange; text: string }
	| { delete: EditRange }
	| { before: EditTarget; text: string }
	| { after: EditTarget; text: string };

function structuredHunks(edits: SourceEdit[]): Hunk[] {
	const anchor = (target: EditTarget): string => {
		const value = typeof target === "string" ? target : target?.anchor;
		if (typeof value !== "string") throw new Error("Edit targets must be anchors or source rows, not line numbers or selections.");
		return value;
	};
	return edits.map(edit => {
		const modes = ["replace", "delete", "before", "after"] as const;
		const keys = Object.keys(edit);
		const mode = modes.find(mode => Object.hasOwn(edit, mode));
		if (!mode || keys.some(key => key !== mode && key !== "text") || modes.filter(mode => Object.hasOwn(edit, mode)).length !== 1)
			throw new Error("Each edit needs exactly one of replace, delete, before, after, plus text except for delete.");
		const target = (edit as unknown as Record<string, EditRange>)[mode];
		if (Array.isArray(target) && (target.length !== 2 || mode === "before" || mode === "after"))
			throw new Error("Only replace and delete accept [first, last] ranges.");
		const from = anchor(Array.isArray(target) ? target[0] : target);
		const to = Array.isArray(target) ? anchor(target[1]) : undefined;
		if (mode === "delete" ? "text" in edit : !("text" in edit) || typeof edit.text !== "string")
			throw new Error("replace/before/after require text; delete takes no text.");
		return { header: `${mode} ${from}${to ? " " + to : ""}`, mode, from, to, literal: true,
			lines: "text" in edit ? edit.text.split("\n") : [] };
	});
}

export interface SourceEditResult {
	text: string;
	details: Awaited<ReturnType<typeof executeEdits>>["details"];
	render(): string;
}
function editResult(result: Awaited<ReturnType<typeof executeEdits>>): SourceEditResult {
	const text = result.content.map(c => c.text).join("\n");
	return register({ text, details: result.details, render: () => text }, "text");
}

/** All anchors originate from file bytes reconciled through the session ledger. */
export function createSourceAPI(deps: SourceDeps) {
	const cwd = resolve(deps.cwd);
	const check = () => deps.signal?.throwIfAborted();
	async function read(path: string): Promise<SourceFile | ImageFile> {
		check();
		path = resolve(cwd, path);
		let bytes: Buffer;
		try {
			const info = await stat(path);
			if (info.isDirectory()) throw fsError(path, { code: "EISDIR" });
			bytes = await readFile(path, { signal: deps.signal });
		} catch (err) {
			if (err && typeof err === "object" && (err as { name?: string }).name === "AbortError") throw err;
			if (err && typeof err === "object" && "code" in err) throw fsError(path, err);
			throw err;
		}
		if (looksLikeImageFile(bytes)) {
			check();
			const mimeType = await detectImageMimeType(path);
			if (!mimeType) throw new Error(shownPath(path) + ": unsupported image format (animated or unrecognized image containers are not readable)");
			return createImageFile(path, bytes, mimeType);
		}
		const raw = bytes.toString("utf8");
		if (raw.includes("\0")) throw new Error(shownPath(path) + ": binary files are not source");
		return capture(path, raw);
	}
	function capture(path: string, raw: string): SourceFile {
		const lines = sourceLines(raw);
		check();
		const { ledger, changed } = deps.ledger.sync(path, lines);
		if (changed) deps.persist(path);
		return new SourceFile(path, raw, ledger.lines);
	}
	async function find(glob?: string, options: FindOptions = {}): Promise<string[]> {
		check();
		const pattern = glob && (isAbsolute(glob) ? relative(cwd, glob) : glob.replace(/^\.\//, ""));
		const local = join(getAgentDir(), "bin", "rg");
		const paths = typeof options.paths === "string" ? [options.paths] : options.paths ?? ["."];
		if (!paths.length) return [];
		const args = ["--files", "--null", "--sort", "path"];
		if (options.hidden) args.push("--hidden");
		args.push("--", ...paths.map(p => resolve(cwd, p)));
		return new Promise((yes, no) => {
			const child = spawn(existsSync(local) ? local : "rg", args, { cwd, signal: deps.signal, stdio: ["ignore", "pipe", "pipe"] });
			const out: Buffer[] = [], err: Buffer[] = [];
			child.stdout.on("data", chunk => out.push(chunk));
			child.stderr.on("data", chunk => err.push(chunk));
			child.on("error", no);
			child.on("close", code => {
				try { check(); } catch (e) { no(e); return; }
				if (code !== 0 && code !== 1) { no(new Error(Buffer.concat(err).toString() || `rg exited ${code}`)); return; }
				const files = Buffer.concat(out).toString().split("\0").filter(Boolean).map(p => resolve(cwd, p));
				// rg --glob overrides ignore rules; filter only after ignore-aware enumeration.
				yes(pattern ? files.filter(path => matchesGlob(pattern.includes("/") ? relative(cwd, path) : basename(path), pattern)) : files);
			});
		});
	}
	async function grep(pattern: string | RegExp, paths?: string | string[] | SourceFile | SourceSelection | GrepOptions, options: GrepOptions = {}): Promise<SourceSelection> {
		check();
		let requested = grepPaths(paths);
		if (!requested) {
			if (isGrepOptions(paths)) options = { ...paths, ...options };
			else if (paths != null) throw new Error("grep paths must be strings or read results");
			requested = ["."];
		}
		if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 0)) throw new Error("Limit must be a nonnegative integer");
		const isRegex = types.isRegExp(pattern);
		const flags = isRegex ? pattern.flags.replace(/[gy]/g, "") : "";
		const source = isRegex ? pattern.source : options.literal ? pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : pattern;
		const regex = new RegExp(source, flags + (options.ignoreCase && !flags.includes("i") ? "i" : ""));
		// rg --files does not enumerate explicit file arguments on every rg version.
		const candidates: string[] = [];
		for (const path of requested) {
			const absolute = resolve(cwd, path);
			try {
				if (!options.glob && (await stat(absolute)).isFile()) candidates.push(absolute);
				else for (const candidate of await find(options.glob, { paths: [path] })) candidates.push(candidate);
			} catch (err) {
				if (err && typeof err === "object" && "code" in err) throw fsError(absolute, err);
				throw err;
			}
		}
		const files = new Map<string, SourceFile>(), rows: SourceRow[] = [];
		for (const path of new Set(candidates)) {
			check();
			// Binary files are omitted, just as in ordinary textual grep.
			const raw = await readFile(path, { encoding: "utf8", signal: deps.signal });
			if (raw.includes("\0")) continue;
			const matches = sourceLines(raw).flatMap((text, index) => regex.test(text) ? [index] : []);
			if (!matches.length) continue;
			const remaining = options.limit === undefined ? matches.length : options.limit - rows.length;
			if (remaining > 0) {
				const file = capture(path, raw);
				files.set(path, file);
				for (const index of matches.slice(0, remaining)) rows.push(file.rows[index]);
			}
			if (matches.length > remaining) return new SourceSelection(rows, files, false);
		}
		return new SourceSelection(rows, files);
	}
	async function edit(input: string | TemplateStringsArray | SourceEdit[], ...values: unknown[]): Promise<SourceEditResult> {
		check();
		if (Array.isArray(input) && !("raw" in input)) return editResult(await executeHunks(deps, cwd, structuredHunks(input)));
		const text = typeof input === "string" ? input : (input as TemplateStringsArray).reduce((s, part, i) => s + part + (i < values.length ? String(values[i]) : ""), "");
		return editResult(await executeEdits(deps, cwd, text));
	}
	async function replace(selection: SourceSelection, fn: (text: string, row: SourceRow) => string | Promise<string>): Promise<SourceEditResult> {
		check();
		const hunks: Hunk[] = [];
		for (const row of selection) {
			const text = await fn(row.text, row);
			check();
			if (typeof text !== "string") throw new Error("Replacement must be a string");
			if (text === row.text) continue;
			hunks.push({ header: `=${row.anchor}`, from: row.anchor, path: row.path, mode: "replace", lines: text.split("\n") });
		}
		return editResult(await executeHunks(deps, cwd, hunks));
	}
	return { read, grep, find, edit, replace };
}
