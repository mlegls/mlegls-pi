/**
 * Tree-sitter outline source driven by each grammar's shipped `queries/tags.scm`,
 * plus small supplementary queries for kinds the tags files leave out.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { Language, Parser, Query, type Node } from "web-tree-sitter";
import { nest, type OutlineNode, type OutlineSource } from "./types";

interface Grammar {
	pkg: string;
	wasm: string;
	/** Packages whose queries/tags.scm apply, in order. */
	tags: string[];
	extra?: string;
}

const JS_EXTRA = `
(method_definition name: (property_identifier) @name) @definition.method
`;

const TS_EXTRA = `${JS_EXTRA}
(type_alias_declaration name: (type_identifier) @name) @definition.type
(enum_declaration name: (identifier) @name) @definition.enum
`;

const GRAMMARS: Record<string, Grammar> = {
	javascript: {
		pkg: "tree-sitter-javascript",
		wasm: "tree-sitter-javascript.wasm",
		tags: ["tree-sitter-javascript"],
		extra: JS_EXTRA,
	},
	typescript: {
		pkg: "tree-sitter-typescript",
		wasm: "tree-sitter-typescript.wasm",
		tags: ["tree-sitter-javascript", "tree-sitter-typescript"],
		extra: TS_EXTRA,
	},
	tsx: {
		pkg: "tree-sitter-typescript",
		wasm: "tree-sitter-tsx.wasm",
		tags: ["tree-sitter-javascript", "tree-sitter-typescript"],
		extra: TS_EXTRA,
	},
	python: { pkg: "tree-sitter-python", wasm: "tree-sitter-python.wasm", tags: ["tree-sitter-python"] },
	go: { pkg: "tree-sitter-go", wasm: "tree-sitter-go.wasm", tags: ["tree-sitter-go"] },
	rust: {
		pkg: "tree-sitter-rust",
		wasm: "tree-sitter-rust.wasm",
		tags: ["tree-sitter-rust"],
		extra: `(impl_item) @definition.impl`,
	},
	java: { pkg: "tree-sitter-java", wasm: "tree-sitter-java.wasm", tags: ["tree-sitter-java"] },
};

const EXTENSIONS: Record<string, string> = {
	".js": "javascript",
	".mjs": "javascript",
	".cjs": "javascript",
	".jsx": "javascript",
	".ts": "typescript",
	".mts": "typescript",
	".cts": "typescript",
	".tsx": "tsx",
	".py": "python",
	".pyi": "python",
	".go": "go",
	".rs": "rust",
	".java": "java",
};

const require = createRequire(import.meta.url);

function packageDir(pkg: string): string {
	return dirname(require.resolve(`${pkg}/package.json`));
}

let parserInit: Promise<void> | undefined;
const languages = new Map<string, Promise<Language>>();
const queries = new Map<string, Promise<Query>>();

async function loadLanguage(key: string): Promise<Language> {
	let loading = languages.get(key);
	if (!loading) {
		const grammar = GRAMMARS[key];
		parserInit ??= Parser.init();
		loading = parserInit.then(() => Language.load(join(packageDir(grammar.pkg), grammar.wasm)));
		languages.set(key, loading);
	}
	return loading;
}

async function loadQuery(key: string): Promise<Query> {
	let loading = queries.get(key);
	if (!loading) {
		loading = (async () => {
			const grammar = GRAMMARS[key];
			const language = await loadLanguage(key);
			const parts = grammar.tags.map((pkg) => readFileSync(join(packageDir(pkg), "queries", "tags.scm"), "utf8"));
			if (grammar.extra) parts.push(grammar.extra);
			// Only definition patterns are needed; drop reference patterns so the
			// query is cheaper and never fails on reference-only node types.
			const source = parts
				.join("\n")
				.split(/\n(?=\()/)
				.filter((pattern) => pattern.includes("@definition."))
				.join("\n");
			return new Query(language, source);
		})();
		queries.set(key, loading);
	}
	return loading;
}

function bodyRange(node: Node): OutlineNode["body"] | undefined {
	const body = node.childForFieldName("body");
	if (!body) return undefined;
	const bodyStart = body.startPosition.row + 1;
	const bodyEnd = body.endPosition.row + 1;
	const braced = body.text.startsWith("{");
	// Braced: elide strictly between the braces. Indented: elide the block,
	// which must start on a later line than the signature.
	const startLine = braced ? bodyStart + 1 : bodyStart;
	const endLine = braced ? bodyEnd - 1 : bodyEnd;
	if (startLine > endLine) return undefined;
	if (!braced && bodyStart <= node.startPosition.row + 1) return undefined;
	return { startLine, endLine };
}

export function languageFor(path: string): string | undefined {
	return EXTENSIONS[extname(path).toLowerCase()];
}

export async function outlineWithTreeSitter(key: string, text: string): Promise<OutlineNode[]> {
	const language = await loadLanguage(key);
	const query = await loadQuery(key);
	const parser = new Parser();
	parser.setLanguage(language);
	const tree = parser.parse(text);
	try {
		if (!tree) return [];
		const flat: OutlineNode[] = [];
		for (const match of query.matches(tree.rootNode)) {
			const definition = match.captures.find((c) => c.name.startsWith("definition."));
			if (!definition) continue;
			const nameCapture = match.captures.find((c) => c.name === "name");
			const node = definition.node;
			const firstLine = node.text.split("\n", 1)[0].trim();
			flat.push({
				name: nameCapture?.node.text ?? firstLine.replace(/\s*\{$/, ""),
				kind: definition.name.slice("definition.".length),
				startLine: node.startPosition.row + 1,
				endLine: node.endPosition.row + 1,
				body: bodyRange(node),
				children: [],
			});
		}
		return nest(flat);
	} finally {
		tree?.delete();
		parser.delete();
	}
}

export const treeSitterSource: OutlineSource = {
	name: "tree-sitter",
	supports: (path) => languageFor(path) !== undefined,
	async outline(path, text) {
		const key = languageFor(path);
		if (!key) return null;
		return outlineWithTreeSitter(key, text);
	},
};
