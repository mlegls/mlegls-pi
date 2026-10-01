import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFragmentEdits, resolveSpan } from "./fragment";
import { treeSitterSource } from "./outline/treesitter";

const src = "function a() {\n\treturn 1;\n}\n\nfunction b() {\n\treturn 1;\n}\n";

test("unique fragment, ambiguity, near line, @definition, until", async () => {
	expect(() => resolveSpan(src, { path: "x", old: "return 1;", new: "" })).toThrow(/2 times \(lines 2, 6\)/);
	const s = resolveSpan(src, { path: "x", old: "return 1;", new: "", near: 7 });
	expect(src.slice(0, s.start).split("\n").length).toBe(6);
	const outline = await treeSitterSource.outline("x.ts", src);
	const d = resolveSpan(src, { path: "x", old: "1", new: "", near: "@b" }, outline);
	expect(src.slice(0, d.start).split("\n").length).toBe(6);
	const whole = resolveSpan(src, { path: "x", near: "@a", new: "" }, outline);
	expect(src.slice(whole.start, whole.end)).toBe("function a() {\n\treturn 1;\n}");
	const block = resolveSpan(src, { path: "x", old: "function b", until: "}", new: "" });
	expect(src.slice(block.start, block.end)).toBe("function b() {\n\treturn 1;\n}");
	expect(() => resolveSpan(src, { path: "x", old: "  return 1;", new: "" })).toThrow(/lines 2, 6: check whitespace/);
});

test("all-or-nothing across files", async () => {
	const dir = await mkdtemp(join(tmpdir(), "frag-"));
	await writeFile(join(dir, "a.ts"), src);
	await writeFile(join(dir, "b.ts"), "x\n");
	await expect(applyFragmentEdits(dir, [{ path: "a.ts", old: "function a", new: "function c" }, { path: "b.ts", old: "nope", new: "" }])).rejects.toThrow(/Nothing was modified/);
	expect(await readFile(join(dir, "a.ts"), "utf8")).toBe(src);
	const r = await applyFragmentEdits(dir, [{ path: "a.ts", old: "function a", new: "function c" }, { path: "a.ts", old: "return 1;", near: 6, new: "return 2;" }]);
	expect(r.content[0].text).toBe("a.ts: 2 edits at 1, 6 (7 → 7 lines)");
	expect(await readFile(join(dir, "a.ts"), "utf8")).toContain("function c() {\n\treturn 1;\n}\n\nfunction b() {\n\treturn 2;");
});
