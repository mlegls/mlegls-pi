// The program as a graph: definitions at statement grain and the references
// between them, resolved by the TypeScript checker. Read a definition with
// def.body; edit it through anchors: (await read(d.path)).lines(d.line, d.endLine).
import path from "node:path";
import type ts from "typescript";
import { analyze, load, type Analysis, type Def, type Ref, type RefKind } from "./outline-read/program";

export type { Def, Ref, RefKind, Kind } from "./outline-read/program";

export interface Filter {
	/** Exact name, or a pattern. */
	name?: string | RegExp | ((name: string) => boolean);
	/** Relative path, or a pattern. */
	file?: string | RegExp;
	kind?: Def["kind"] | Def["kind"][];
	exported?: boolean;
}
export interface Edge { def: Def; kind: RefKind }

const TEST_FILE = /[._](test|spec)\.|(^|\/)(tests?|__tests__|spec)\//;
const NAMED: Def["kind"][] = ["interface", "type", "enum", "function", "class", "method", "const", "let", "var"];
/** Kinds compared by similar(): callables against callables, types against types. */
const FAMILY: Def["kind"][][] = [["function", "method", "const", "let", "var"], ["interface", "type", "enum", "class"]];
const match = (v: string, p: string | RegExp | ((v: string) => boolean)) => typeof p === "string" ? v === p : typeof p === "function" ? p(v) : p.test(v);

/** A snapshot of one program. */
export class Index {
	readonly byId: ReadonlyMap<string, Def>;
	readonly root: string;
	readonly files: string[];
	readonly refs: readonly Ref[];
	constructor(private readonly analysis: Analysis) {
		this.root = analysis.root;
		this.files = analysis.files.map(f => f.file);
		this.refs = analysis.refs;
		this.byId = new Map(analysis.defs.map(d => [d.id, d]));
	}
	defs(filter: Filter = {}): Def[] {
		const kinds = filter.kind === undefined ? undefined : new Set(Array.isArray(filter.kind) ? filter.kind : [filter.kind]);
		return this.analysis.defs.filter(d =>
			(filter.name === undefined || match(d.name, filter.name))
			&& (filter.file === undefined || match(d.file, filter.file))
			&& (kinds === undefined || kinds.has(d.kind))
			&& (filter.exported === undefined || d.exported === filter.exported));
	}
	/** The one named definition (not an import, export, or bare statement); a nested one by its dotted name or its last segment. */
	def(name: string | RegExp, file?: string | RegExp): Def {
		const pattern = typeof name === "string" ? (v: string) => v === name || v.endsWith("." + name) : name;
		const hits = this.defs({ name: pattern, file, kind: NAMED });
		if (hits.length !== 1) throw new Error(hits.length + " definitions named " + String(name) + (hits.length ? ": " + hits.map(d => d.file + ":" + d.line).join(", ") : ""));
		return hits[0];
	}
	/** Definitions that reference this one. */
	callers(d: Def): Edge[] {
		return this.refs.filter(r => r.to === d.id).map(r => ({ def: this.byId.get(r.from)!, kind: r.kind }));
	}
	/** Definitions this one references. */
	callees(d: Def): Edge[] {
		return this.refs.filter(r => r.from === d.id).map(r => ({ def: this.byId.get(r.to)!, kind: r.kind }));
	}
	/** Callers that live in test files. */
	tests(d: Def): Def[] {
		return this.callers(d).map(e => e.def).filter(t => TEST_FILE.test(t.file));
	}
	/** Named definitions nothing references. */
	dead(): Def[] {
		const referenced = new Set(this.refs.map(r => r.to));
		return this.defs({ kind: NAMED }).filter(d => !referenced.has(d.id));
	}
	/** Definitions of a file in order. */
	file(file: string): Def[] { return this.defs({ file }); }
	/** Definitions nested directly in d. */
	children(d: Def): Def[] { return this.defs().filter(x => x.parent === d.id); }
	/** d and the definitions enclosing it, outermost first. */
	lineage(d: Def): Def[] { const out = [d]; for (let p = d.parent; p; p = this.byId.get(p)?.parent) out.unshift(this.byId.get(p)!); return out; }
	/** Definitions most like d: sharing its callees (bibliographic coupling) or its callers (co-citation), by Jaccard. */
	similar(d: Def, { by = "callees", kinds = ["call"], n = 10 }: { by?: "callees" | "callers"; kinds?: RefKind[]; n?: number } = {}): { def: Def; score: number; shared: Def[] }[] {
		const refs = this.refs.filter(r => kinds.includes(r.kind));
		const side = by === "callees" ? (id: string) => refs.filter(r => r.from === id).map(r => r.to) : (id: string) => refs.filter(r => r.to === id).map(r => r.from);
		const mine = new Set(side(d.id));
		if (!mine.size) return [];
		const out = [];
		for (const other of this.defs({ kind: FAMILY.find(f => f.includes(d.kind)) ?? [d.kind] })) {
			if (other.id === d.id) continue;
			const theirs = new Set(side(other.id));
			const shared = [...mine].filter(id => theirs.has(id));
			if (!shared.length) continue;
			out.push({ def: other, score: shared.length / new Set([...mine, ...theirs]).size, shared: shared.map(id => this.byId.get(id)!) });
		}
		return out.sort((a, b) => b.score - a.score).slice(0, n);
	}
	/** d in full, its neighbors by signature, and the files one hop beyond by count: a fisheye (Furnas 1986) with graph distance as the degree of interest. */
	around(d: Def, { hops = 2 }: { hops?: number } = {}): string {
		const dist = new Map([[d.id, 0]]);
		const queue = [d];
		for (let i = 0; i < queue.length; i++) {
			const at = dist.get(queue[i].id)!;
			if (at >= hops) continue;
			for (const { def } of [...this.callers(queue[i]), ...this.callees(queue[i])])
				if (!dist.has(def.id)) { dist.set(def.id, at + 1); queue.push(def); }
		}
		const loc = (x: Def) => x.file + ":" + x.line;
		const lines = d.body.split("\n");
		const out = [loc(d), ...lines.slice(0, 40), ...(lines.length > 40 ? ["⋯ " + (lines.length - 40) + " more lines"] : []), ""];
		const at = (n: number) => queue.filter(x => dist.get(x.id) === n);
		for (const x of at(1)) {
			const edges = [...this.callers(d).filter(e => e.def.id === x.id).map(e => "← " + e.kind), ...this.callees(d).filter(e => e.def.id === x.id).map(e => "→ " + e.kind)];
			out.push(edges.join(" ") + " " + loc(x) + "  " + x.signature.split("\n")[0]);
		}
		for (let n = 2; n <= hops; n++) {
			const counts = new Map<string, number>();
			for (const x of at(n)) counts.set(x.file, (counts.get(x.file) ?? 0) + 1);
			if (counts.size) out.push("", "hop " + n + ": " + [...counts].map(([f, c]) => f + " ×" + c).join(", "));
		}
		return out.join("\n");
	}
	/** The definition's anchored rows, for edit/replace. */
	async rows(d: Def) {
		if (!api) throw new Error("code.rows needs the exec cell API; outside a cell, use read(d.path).lines(d.line, d.endLine)");
		return (await api.read(d.path)).lines(d.line, d.endLine);
	}

	/** Callers transitively, nearest first, excluding d. */
	impact(d: Def): Def[] {
		const seen = new Set([d.id]), out: Def[] = [], queue = [d];
		for (let i = 0; i < queue.length; i++)
			for (const { def } of this.callers(queue[i])) if (!seen.has(def.id)) { seen.add(def.id); out.push(def); queue.push(def); }
		return out;
	}
	render(): string {
		return this.files.length + " files, " + this.analysis.defs.length + " definitions, " + this.refs.length + " references under " + this.root;
	}
}

let api: { read(path: string): Promise<{ lines(start: number, end: number): unknown }> } | undefined;
/** Called once by the exec kernel with the cell API. */
export function attach(capabilities: typeof api) { api = capabilities; }


const held = new Map<string, { program?: ts.Program; analysis?: Analysis }>();

/**
 * The program at root (cwd) per its tsconfig. Each call re-reads the tree and
 * re-resolves only files that changed and their referrers, so calling it after
 * an edit is cheap and the snapshot is never behind the tree.
 */
export function index(root = process.cwd(), tsconfig = "tsconfig.json"): Index {
	root = path.resolve(root);
	const key = root + "\0" + tsconfig;
	const h = held.get(key) ?? {};
	h.program = load(path.resolve(root, tsconfig), h.program);
	h.analysis = analyze(h.program, root, h.analysis);
	held.set(key, h);
	return new Index(h.analysis);
}

export const defs = (filter?: Filter) => index().defs(filter);
export const def = (name: string | RegExp, file?: string | RegExp) => index().def(name, file);
export const callers = (d: Def) => index().callers(d);
export const callees = (d: Def) => index().callees(d);
export const tests = (d: Def) => index().tests(d);
export const dead = () => index().dead();
export const similar = (d: Def, options?: Parameters<Index["similar"]>[1]) => index().similar(d, options);
export const around = (d: Def, options?: Parameters<Index["around"]>[1]) => index().around(d, options);
export const rows = (d: Def) => index().rows(d);
