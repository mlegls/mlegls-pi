import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";

// Compiler-resolved definitions and references for a TypeScript program.
// Top-level statements are the definitions; references between them come from
// the checker, so a caller is a fact rather than a name match (tree-sitter's
// outline gives shape per file; this gives the graph across files).

export type Kind =
	| "import" | "interface" | "type" | "enum" | "function" | "class"
	| "const" | "let" | "var" | "export" | "statement";

export interface Def {
	/** Hash of file, name, kind, and text: stable while the definition is unchanged. */
	id: string;
	name: string;
	kind: Kind;
	/** Relative to the program root. */
	file: string;
	/** Absolute. */
	path: string;
	/** One-based inclusive line range of the statement plus its trailing same-line comment. */
	line: number;
	endLine: number;
	exported: boolean;
	/** The head: a function up to its body, a class up to its brace, otherwise the first line. */
	signature: string;
	body: string;
	start: number;
	end: number;
}

export type RefKind = "call" | "type" | "member" | "value";
export interface Ref { from: string; to: string; kind: RefKind }

export interface Analysis {
	root: string;
	files: { file: string; path: string; hash: string; text: string }[];
	defs: Def[];
	refs: Ref[];
}

/** Parsed source files by path, reused while their text is unchanged, so a new program re-parses only what changed. */
const parsed = new Map<string, { text: string; source: ts.SourceFile }>();

function host(options: ts.CompilerOptions): ts.CompilerHost {
	const h = ts.createCompilerHost(options);
	const read = h.getSourceFile.bind(h);
	h.getSourceFile = (name, lang, onError, create) => {
		const text = h.readFile(name);
		const hit = parsed.get(name);
		if (hit && hit.text === text) return hit.source;
		const source = read(name, lang, onError, create);
		if (source && text !== undefined) parsed.set(name, { text, source });
		return source;
	};
	return h;
}

/** The program at a tsconfig; given the previous program, unchanged files keep their parse and binding. */
export function load(tsconfig: string, old?: ts.Program): ts.Program {
	const file = ts.findConfigFile(path.dirname(tsconfig), f => ts.sys.fileExists(f), path.basename(tsconfig));
	if (!file) throw new Error("no tsconfig at " + tsconfig);
	const json = ts.readConfigFile(file, f => ts.sys.readFile(f));
	if (json.error) throw new Error(ts.flattenDiagnosticMessageText(json.error.messageText, "\n"));
	const config = ts.parseJsonConfigFileContent(json.config, ts.sys, path.dirname(file));
	return ts.createProgram(config.fileNames, config.options, host(config.options), old);
}

function declaration(checker: ts.TypeChecker, n: ts.Identifier): ts.Node | undefined {
	let sym = checker.getSymbolAtLocation(n);
	if (!sym) return undefined;
	if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
	const d = sym.declarations?.[0];
	if (!d || d.getSourceFile().isDeclarationFile) return undefined;
	return d;
}

function refKind(n: ts.Identifier): RefKind {
	const p = n.parent;
	if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.expression === n) return "call";
	if (ts.isPropertyAccessExpression(p) && p.name === n) return "member";
	for (let a: ts.Node = p; !ts.isSourceFile(a); a = a.parent) {
		if (ts.isTypeNode(a) || ts.isHeritageClause(a)) return "type";
		if (ts.isStatement(a) || ts.isExpression(a)) break;
	}
	return "value";
}

function nameAndKind(st: ts.Statement): [string, Kind] {
	if (ts.isImportDeclaration(st)) return [st.moduleSpecifier.getText().slice(1, -1), "import"];
	if (ts.isFunctionDeclaration(st)) return [st.name?.text ?? "default", "function"];
	if (ts.isClassDeclaration(st)) return [st.name?.text ?? "default", "class"];
	if (ts.isInterfaceDeclaration(st)) return [st.name.text, "interface"];
	if (ts.isTypeAliasDeclaration(st)) return [st.name.text, "type"];
	if (ts.isEnumDeclaration(st)) return [st.name.text, "enum"];
	if (ts.isVariableStatement(st)) {
		const decl = st.declarationList.declarations[0];
		const name = decl ? decl.name.getText() : "";
		const flags = st.declarationList.flags;
		const kind = flags & ts.NodeFlags.Const ? "const" : flags & ts.NodeFlags.Let ? "let" : "var";
		return [name, kind];
	}
	if (ts.isExportAssignment(st) || ts.isExportDeclaration(st)) return ["export", "export"];
	if (ts.isExpressionStatement(st)) {
		// describe('x', …), test.each(rows)('x %s', …), app.get('/x', …): named by string arguments, so tests are definitions by name.
		let e: ts.Expression = st.expression;
		while (ts.isAwaitExpression(e) || ts.isVoidExpression(e)) e = e.expression;
		const strings: string[] = [];
		for (let c = e; ts.isCallExpression(c); c = c.expression) {
			const s = c.arguments.find(a => ts.isStringLiteralLike(a));
			if (s && ts.isStringLiteralLike(s)) strings.unshift(s.text);
		}
		if (strings.length) return [strings.join(" "), "statement"];
	}
	return ["", "statement"];
}

function signature(st: ts.Statement, text: string): string {
	if (ts.isFunctionDeclaration(st) && st.body) return text.slice(0, st.body.getStart() - st.getStart()).trim();
	if (ts.isClassDeclaration(st)) {
		const brace = text.indexOf("{");
		return brace > 0 ? text.slice(0, brace).trim() : text;
	}
	const line = text.split("\n")[0] ?? text;
	return text.length <= 160 ? text : line;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** The statement's start, or that of a comment directly above it (no blank line between). */
function docStart(st: ts.Statement, s: ts.SourceFile): number {
	const start = st.getStart(s);
	const doc = (ts.getLeadingCommentRanges(s.text, st.getFullStart()) ?? []).at(-1);
	if (!doc || /\n\s*\n/.test(s.text.slice(doc.end, start))) return start;
	return doc.pos;
}
function merged(a: Def, b: Def, s: ts.SourceFile): Def {
	const body = s.text.slice(a.start, b.end);
	return { ...a, id: sha(a.file + "\0" + a.name + "\0" + a.kind + "\0" + body).slice(0, 10), end: b.end, endLine: b.endLine, body };
}

function definition(st: ts.Statement, s: ts.SourceFile, root: string): Def {
	const [name, kind] = nameAndKind(st);
	const start = docStart(st, s);
	const trailing = ts.getTrailingCommentRanges(s.text, st.getEnd()) ?? [];
	const end = trailing.at(-1)?.end ?? st.getEnd();
	const body = s.text.slice(start, end);
	const exported = ts.canHaveModifiers(st)
		? (ts.getModifiers(st)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
		: ts.isExportAssignment(st) || ts.isExportDeclaration(st);
	const file = path.relative(root, s.fileName);
	return {
		id: sha(file + "\0" + name + "\0" + kind + "\0" + body).slice(0, 10),
		name, kind, file, path: s.fileName,
		line: s.getLineAndCharacterOfPosition(start).line + 1,
		endLine: s.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line + 1,
		exported, signature: signature(st, body), body, start, end,
	};
}

/**
 * The program's definitions and references. Given the previous analysis, only
 * files whose text changed, plus files with references into them, are
 * re-resolved; everything else is carried over. A file that newly resolves a
 * name it could not before, through a file it has no other reference into,
 * is caught by the next full analysis.
 */
export function analyze(program: ts.Program, root: string, old?: Analysis): Analysis {
	const checker = program.getTypeChecker(); // binding sets parent pointers, which definition() needs
	const sources = program.getSourceFiles().filter(s => !s.isDeclarationFile && !s.fileName.includes("/node_modules/"));
	const files = sources.map(s => ({ file: path.relative(root, s.fileName), path: s.fileName, hash: sha(s.text), text: s.text }));
	const oldHash = new Map(old?.files.map(f => [f.file, f.hash]) ?? []);
	const changed = new Set(files.filter(f => oldHash.get(f.file) !== f.hash).map(f => f.file));
	for (const p of oldHash.keys()) if (!files.some(f => f.file === p)) changed.add(p);
	const defs: Def[] = [];
	const byFile = new Map<string, Def[]>();
	for (const s of sources) {
		const rel = path.relative(root, s.fileName);
		const own: Def[] = changed.has(rel) || !old ? [] : old.defs.filter(d => d.file === rel);
		if (own.length === 0) for (const st of s.statements) {
			const d = definition(st, s, root);
			const prev = own.at(-1);
			// Overload signatures and their implementation are one definition.
			if (prev && prev.kind === "function" && d.kind === "function" && prev.name === d.name) own[own.length - 1] = merged(prev, d, s);
			else own.push(d);
		}
		defs.push(...own);
		byFile.set(s.fileName, own);
	}
	const fileOf = new Map(defs.map(d => [d.id, d.file]));
	const oldFileOf = new Map(old?.defs.map(d => [d.id, d.file]) ?? []);
	const affected = new Set(changed);
	for (const r of old?.refs ?? []) {
		const to = oldFileOf.get(r.to);
		const from = oldFileOf.get(r.from);
		if (to !== undefined && from !== undefined && changed.has(to)) affected.add(from);
	}
	const refs = new Map<string, Ref>();
	for (const r of old?.refs ?? []) {
		const from = oldFileOf.get(r.from);
		if (from === undefined || affected.has(from) || !fileOf.has(r.to)) continue;
		refs.set(r.from + "\0" + r.to + "\0" + r.kind, r);
	}
	const owner = (node: ts.Node): Def | undefined => {
		const pos = node.getStart();
		return byFile.get(node.getSourceFile().fileName)?.find(d => d.start <= pos && pos < d.end);
	};
	for (const s of sources) {
		if (old && !affected.has(path.relative(root, s.fileName))) continue;
		const own = byFile.get(s.fileName) ?? [];
		for (const st of s.statements) {
			const from = own.find(d => d.start <= st.getStart(s) && st.getStart(s) < d.end);
			if (!from || from.kind === "import") continue;
			const visit = (n: ts.Node) => {
				if (ts.isIdentifier(n)) {
					const target = declaration(checker, n);
					const to = target && owner(target);
					if (to && to.id !== from.id) {
						const kind = refKind(n);
						refs.set(from.id + "\0" + to.id + "\0" + kind, { from: from.id, to: to.id, kind });
					}
				}
				ts.forEachChild(n, visit);
			};
			visit(st);
		}
	}
	return { root, files, defs, refs: [...refs.values()] };
}
