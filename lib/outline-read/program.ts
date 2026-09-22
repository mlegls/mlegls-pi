import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";

// Compiler-resolved definitions and references for a TypeScript program.
// Top-level statements are the definitions, with named functions, classes,
// members, and function-valued variables nested under them; references
// between them come from the checker, so a caller is a fact rather than a
// name match (tree-sitter's outline gives shape per file; this gives the
// graph across files).

export type Kind =
	| "import" | "interface" | "type" | "enum" | "function" | "class" | "method"
	| "const" | "let" | "var" | "export" | "statement";

export interface Def {
	/** Hash of file, name, kind, and text: stable while the definition is unchanged. */
	id: string;
	name: string;
	kind: Kind;
	/** Dotted through enclosing definitions: "createSourceAPI.read", "Index.similar". */
	parent?: string;
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

/** The declaration an identifier resolves to. An object property that forwards a local ({ read } or { read: read }) resolves through to that local. */
function declaration(checker: ts.TypeChecker, n: ts.Identifier): ts.Node | undefined {
	let sym = checker.getSymbolAtLocation(n);
	if (!sym) return undefined;
	if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
	let d = sym.declarations?.[0];
	for (let hops = 0; d && hops < 4; hops++) {
		let forwarded: ts.Symbol | undefined;
		if (ts.isShorthandPropertyAssignment(d)) forwarded = checker.getShorthandAssignmentValueSymbol(d);
		else if (ts.isPropertyAssignment(d) && ts.isIdentifier(d.initializer)) forwarded = checker.getSymbolAtLocation(d.initializer);
		else break;
		if (forwarded && forwarded.flags & ts.SymbolFlags.Alias) forwarded = checker.getAliasedSymbol(forwarded);
		if (!forwarded?.declarations?.[0]) break;
		d = forwarded.declarations[0];
	}
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

function signature(st: ts.Node, text: string): string {
	if (ts.isFunctionLike(st) && st.body) return text.slice(0, st.body.getStart() - st.getStart()).trim();
	if (ts.isVariableStatement(st)) {
		const init = st.declarationList.declarations[0]?.initializer;
		if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isBlock(init.body))
			return text.slice(0, init.body.getStart() - st.getStart()).trim();
	}
	if (ts.isClassDeclaration(st)) {
		const brace = text.indexOf("{");
		return brace > 0 ? text.slice(0, brace).trim() : text;
	}
	const line = text.split("\n")[0] ?? text;
	return text.length <= 160 ? text : line;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** The statement's start, or that of a comment directly above it (no blank line between). */
function docStart(st: ts.Node, s: ts.SourceFile): number {
	const start = st.getStart(s);
	const doc = (ts.getLeadingCommentRanges(s.text, st.getFullStart()) ?? []).at(-1);
	if (!doc || /\n\s*\n/.test(s.text.slice(doc.end, start))) return start;
	return doc.pos;
}
function merged(a: Def, b: Def, s: ts.SourceFile): Def {
	const body = s.text.slice(a.start, b.end);
	return { ...a, id: sha(a.file + "\0" + a.name + "\0" + a.kind + "\0" + body).slice(0, 10), end: b.end, endLine: b.endLine, body };
}

/** Named declarations nested in node, each under parent: functions, classes and their members, and function-valued variables. */
function nested(node: ts.Node, s: ts.SourceFile, root: string, parent: Def, out: Def[]): void {
	const visit = (n: ts.Node) => {
		let d: Def | undefined;
		const fnValued = (init?: ts.Expression) => !!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
		if (ts.isFunctionDeclaration(n) && n.name) d = definition(n, n.name.text, "function", s, root, parent);
		else if (ts.isClassDeclaration(n) && n.name) d = definition(n, n.name.text, "class", s, root, parent);
		else if ((ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)) && n.body) d = definition(n, n.name.getText(s), "method", s, root, parent);
		else if (ts.isConstructorDeclaration(n) && n.body) d = definition(n, "constructor", "method", s, root, parent);
		else if (ts.isPropertyDeclaration(n) && fnValued(n.initializer)) d = definition(n, n.name.getText(s), "method", s, root, parent);
		else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && fnValued(n.initializer) && !ts.isSourceFile(n.parent.parent.parent))
			d = definition(n.parent.parent, n.name.text, n.parent.flags & ts.NodeFlags.Const ? "const" : "let", s, root, parent);
		if (d) { out.push(d); nested(n, s, root, d, out); }
		else ts.forEachChild(n, visit);
	};
	ts.forEachChild(node, visit);
}

function definition(node: ts.Node, name: string, kind: Kind, s: ts.SourceFile, root: string, parent?: Def): Def {
	const start = docStart(node, s);
	const trailing = ts.getTrailingCommentRanges(s.text, node.getEnd()) ?? [];
	const end = trailing.at(-1)?.end ?? node.getEnd();
	const body = s.text.slice(start, end);
	const exported = ts.canHaveModifiers(node)
		? (ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
		: ts.isExportAssignment(node) || ts.isExportDeclaration(node);
	const file = path.relative(root, s.fileName);
	if (parent) name = parent.name + "." + name;
	return {
		id: sha(file + "\0" + name + "\0" + kind + "\0" + body).slice(0, 10),
		name, kind, file, path: s.fileName, parent: parent?.id,
		line: s.getLineAndCharacterOfPosition(start).line + 1,
		endLine: s.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line + 1,
		exported, signature: signature(node, s.text.slice(node.getStart(s), end)), body, start, end,
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
			const [name, kind] = nameAndKind(st);
			const d = definition(st, name, kind, s, root);
			const prev = own.at(-1);
			// Overload signatures and their implementation are one definition.
			if (prev && prev.kind === "function" && d.kind === "function" && prev.name === d.name) own[own.length - 1] = merged(prev, d, s);
			else own.push(d);
			if (kind !== "import") nested(st, s, root, own.at(-1)!, own);
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
	/** The innermost definition containing node: the last by start among those enclosing its position. */
	const owner = (node: ts.Node): Def | undefined => {
		const pos = node.getStart();
		return byFile.get(node.getSourceFile().fileName)?.findLast(d => d.start <= pos && pos < d.end);
	};
	for (const s of sources) {
		if (old && !affected.has(path.relative(root, s.fileName))) continue;
		const own = byFile.get(s.fileName) ?? [];
		const visit = (n: ts.Node) => {
			if (ts.isIdentifier(n)) {
				const from = owner(n);
				const target = from && from.kind !== "import" ? declaration(checker, n) : undefined;
				const to = target && owner(target);
				if (from && to && to.id !== from.id) {
					const kind = refKind(n);
					refs.set(from.id + "\0" + to.id + "\0" + kind, { from: from.id, to: to.id, kind });
				}
			}
			ts.forEachChild(n, visit);
		};
		visit(s);
	}
	return { root, files, defs, refs: [...refs.values()] };
}
