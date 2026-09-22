// The program as a graph: definitions at statement grain and the references
// between them, resolved by the TypeScript checker. Read a definition with
// def.body; edit it through anchors: (await read(d.path)).lines(d.line, d.endLine).
import path from "node:path";
import type ts from "typescript";
import { analyze, load, type Analysis, type Def, type Ref, type RefKind } from "./outline-read/program";

export type { Def, Ref, RefKind, Kind } from "./outline-read/program";

export interface Filter {
	/** Exact name, or a pattern. */
	name?: string | RegExp;
	/** Relative path, or a pattern. */
	file?: string | RegExp;
	kind?: Def["kind"] | Def["kind"][];
	exported?: boolean;
}
export interface Edge { def: Def; kind: RefKind }

const TEST_FILE = /[._](test|spec)\.|(^|\/)(tests?|__tests__|spec)\//;
const NAMED: Def["kind"][] = ["interface", "type", "enum", "function", "class", "const", "let", "var"];
const match = (v: string, p: string | RegExp) => typeof p === "string" ? v === p : p.test(v);

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
	/** The one named definition (not an import, export, or bare statement). */
	def(name: string | RegExp, file?: string | RegExp): Def {
		const hits = this.defs({ name, file, kind: NAMED });
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
