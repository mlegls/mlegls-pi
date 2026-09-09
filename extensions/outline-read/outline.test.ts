import { describe, expect, test } from "bun:test";
import { outlineMarkdown } from "./outline/markdown";
import { planElisions, renderOutline } from "./outline/render";
import { outlineWithTreeSitter } from "./outline/treesitter";
import { nest, type OutlineNode } from "./outline/types";
import { normalizeRanges, parseRange, splitSelector } from "./selector";

const node = (kind: string, startLine: number, endLine: number, body?: [number, number]): OutlineNode => ({
	name: kind,
	kind,
	startLine,
	endLine,
	body: body && { startLine: body[0], endLine: body[1] },
	children: [],
});

describe("selector", () => {
	test("range forms", () => {
		expect(parseRange("50")).toEqual({ start: 50, end: 50 });
		expect(parseRange("50-")).toEqual({ start: 50 });
		expect(parseRange("50-200")).toEqual({ start: 50, end: 200 });
		expect(parseRange("50+3")).toEqual({ start: 50, end: 52 });
		expect(parseRange("0")).toBeUndefined();
	});
	test("split path and selector", () => {
		expect(splitSelector("a.ts")).toEqual({ path: "a.ts" });
		expect(splitSelector("a.ts:all")).toEqual({ path: "a.ts", selector: { kind: "all" } });
		expect(splitSelector("dir/a.ts:5-16,40-80")).toEqual({
			path: "dir/a.ts",
			selector: { kind: "ranges", ranges: [{ start: 5, end: 16 }, { start: 40, end: 80 }] },
		});
		expect(splitSelector("C:\\x\\a.ts")).toEqual({ path: "C:\\x\\a.ts" });
	});
	test("normalize merges and clamps", () => {
		expect(normalizeRanges([{ start: 40, end: 80 }, { start: 5, end: 16 }, { start: 17, end: 20 }, { start: 100 }], 120)).toEqual([
			{ start: 5, end: 20 },
			{ start: 40, end: 80 },
			{ start: 100, end: 120 },
		]);
		expect(normalizeRanges([{ start: 500 }], 120)).toEqual([]);
	});
});

describe("nest", () => {
	test("by containment, widest first, duplicates dropped", () => {
		const roots = nest([node("method", 3, 5), node("class", 1, 10), node("class", 1, 10), node("function", 12, 14)]);
		expect(roots.map((n) => n.kind)).toEqual(["class", "function"]);
		expect(roots[0].children.map((n) => n.kind)).toEqual(["method"]);
	});
});

describe("markdown", () => {
	test("headings nest by level and ignore fenced code", () => {
		const text = ["# A", "intro", "## B", "```", "# not a heading", "```", "text", "### C", "x", "## D", "y", "z"].join("\n");
		const roots = outlineMarkdown(text);
		expect(roots.map((n) => [n.name, n.startLine, n.endLine])).toEqual([["A", 1, 12]]);
		expect(roots[0].children.map((n) => [n.name, n.startLine, n.endLine])).toEqual([
			["B", 3, 9],
			["D", 10, 12],
		]);
		expect(roots[0].children[0].children[0]).toMatchObject({ name: "C", startLine: 8, endLine: 9, body: { startLine: 9, endLine: 9 } });
	});
	test("heading directly followed by a sibling heading has no body", () => {
		const [a, b] = outlineMarkdown("# A\n# B\ntext");
		expect(a.body).toBeUndefined();
		expect(b.body).toEqual({ startLine: 3, endLine: 3 });
	});
	test("parent body spans its children", () => {
		const [a] = outlineMarkdown("# A\n## B\ntext");
		expect(a.body).toEqual({ startLine: 2, endLine: 3 });
	});
});

describe("render", () => {
	const cls = node("class", 1, 12, [2, 11]);
	cls.children = [node("method", 3, 6, [4, 5]), node("method", 8, 11, [9, 10])];
	const roots = [cls, node("function", 14, 20, [15, 19])];

	test("level 0 elides leaf bodies only", () => {
		expect(planElisions(roots, 0, 1)).toEqual([
			{ startLine: 4, endLine: 5 },
			{ startLine: 9, endLine: 10 },
			{ startLine: 15, endLine: 19 },
		]);
	});
	test("level 1 elides container body between children", () => {
		expect(planElisions(roots, 1, 1).map((e) => [e.startLine, e.endLine])).toEqual([
			[2, 2],
			[4, 5],
			[7, 7],
			[9, 10],
			[15, 19],
		]);
	});
	test("level 2 collapses containers with a child count", () => {
		expect(planElisions(roots, 2, 1)[0]).toEqual({ startLine: 2, endLine: 11, children: 2 });
	});
	test("minBodyLines keeps short bodies", () => {
		expect(planElisions(roots, 0, 3)).toEqual([{ startLine: 15, endLine: 19 }]);
	});
	test("rises level to fit budget", () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
		const rendered = renderOutline(lines, roots, { minBodyLines: 1, budgetTokens: 20 }, (n, t) => `${n}|${t}`, (e) => `~${e.startLine}-${e.endLine}`);
		expect(rendered.level).toBe(2);
		expect(rendered.text.split("\n")[1]).toBe("~2-11");
	});
});

describe("tree-sitter", () => {
	test("typescript definitions with bodies", async () => {
		const text = ["export class A {", "  x = 1;", "  m(): void {", "    return;", "  }", "}", "export const f = () => {", "  return 1;", "};", "type T = { a: 1 };"].join("\n");
		const roots = await outlineWithTreeSitter("typescript", text);
		expect(roots.map((n) => [n.kind, n.name, n.startLine, n.endLine])).toEqual([
			["class", "A", 1, 6],
			["function", "f", 7, 9],
			["type", "T", 10, 10],
		]);
		expect(roots[0].children[0]).toMatchObject({ kind: "method", name: "m", body: { startLine: 4, endLine: 4 } });
	});
	test("python indented bodies", async () => {
		const roots = await outlineWithTreeSitter("python", "def f(a):\n    return a\n\ndef g(): return 1\n");
		expect(roots[0].body).toEqual({ startLine: 2, endLine: 2 });
		expect(roots[1].body).toBeUndefined();
	});
});
