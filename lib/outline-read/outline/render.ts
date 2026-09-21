/**
 * Render a file as kept source lines plus elision markers, omp-style.
 *
 * Level 0 elides leaf bodies (functions, methods, markdown sections) and keeps
 * container bodies (classes, impls) so fields and signatures stay visible.
 * Level 1 also elides container bodies except nested definitions' own kept
 * lines. Level 2 keeps only top-level signatures with child counts. The level
 * rises until the output fits the token budget.
 */
import type { OutlineNode } from "./types";

export interface RenderOptions {
	/** Bodies shorter than this stay inline. */
	minBodyLines: number;
	/** Approximate token budget; level rises until met. */
	budgetTokens: number;
}

export interface Elision {
	startLine: number;
	endLine: number;
	children?: number;
}

const CONTAINER_KINDS = new Set(["class", "interface", "impl", "module", "type", "enum", "struct", "trait"]);

function isContainer(kind: string): boolean {
	return CONTAINER_KINDS.has(kind);
}

function countNodes(nodes: OutlineNode[]): number {
	return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

export function planElisions(roots: OutlineNode[], level: number, minBodyLines: number): Elision[] {
	const out: Elision[] = [];
	const push = (startLine: number, endLine: number, children?: number) => {
		if (endLine - startLine + 1 >= minBodyLines) out.push({ startLine, endLine, children });
	};
	const visit = (node: OutlineNode) => {
		const children = [...node.children].sort((a, b) => a.startLine - b.startLine);
		if (!node.body || (isContainer(node.kind) && level === 0)) {
			for (const child of children) visit(child);
			return;
		}
		if (level >= 2 && children.length) {
			push(node.body.startLine, node.body.endLine, countNodes(children));
			return;
		}
		let cursor = node.body.startLine;
		for (const child of children) {
			if (child.startLine > cursor) push(cursor, Math.min(child.startLine - 1, node.body.endLine));
			visit(child);
			cursor = Math.max(cursor, child.endLine + 1);
		}
		if (cursor <= node.body.endLine) push(cursor, node.body.endLine);
	};
	for (const root of roots) visit(root);
	return out.sort((a, b) => a.startLine - b.startLine);
}

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export interface Rendered {
	text: string;
	level: number;
	elisions: Elision[];
	elidedLines: number;
}

export function renderOutline(
	lines: string[],
	roots: OutlineNode[],
	options: RenderOptions,
	formatLine: (lineNumber: number, text: string) => string,
	formatElision: (elision: Elision) => string,
): Rendered {
	let result: Rendered | undefined;
	for (let level = 0; level <= 2; level++) {
		const elisions = planElisions(roots, level, options.minBodyLines);
		const parts: string[] = [];
		let elidedLines = 0;
		let next = 0;
		for (let i = 0; i < lines.length; i++) {
			const elision = elisions[next];
			if (elision && i + 1 === elision.startLine) {
				parts.push(formatElision(elision));
				elidedLines += elision.endLine - elision.startLine + 1;
				i = elision.endLine - 1;
				next++;
				continue;
			}
			parts.push(formatLine(i + 1, lines[i]));
		}
		result = { text: parts.join("\n"), level, elisions, elidedLines };
		if (estimateTokens(result.text) <= options.budgetTokens) break;
	}
	return result!;
}
