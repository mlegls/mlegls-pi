import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFragmentEdits, resolveSpan } from "./fragment";
import { tryEdit } from "./fragment.fixture";
import { treeSitterSource } from "./outline/treesitter";

const src = "function a() {\n\treturn 1;\n}\n\nfunction b() {\n\treturn 1;\n}\n";

test("codemode edit accepts field aliases without overriding canonical fields", async () => {
	for (const edit of [
		{ oldText: "hello", new: "world" },
		{ old: "hello", newText: "world" },
		{ oldText: "hello", newText: "world" },
		{ old_string: "hello", new_string: "world" },
		{ old_text: "hello", new_text: "world" },
		{ old: "hello", new: "", oldText: "wrong", newText: "wrong" },
	]) {
		const args = JSON.stringify({ edits: [{ path: "sample.txt", ...edit }] });
		const result = await tryEdit(`text(await tools.edit(${args}));`);
		expect(result.report).toContain("sample.txt: 1 edit at 1");
		expect(result.contents).toBe((edit.new ?? edit.newText ?? edit.new_string ?? edit.new_text) + "\n");
	}
});

test("codemode edit names the supplied and accepted fields when an edit is incomplete", async () => {
	const result = await tryEdit('text(await tools.edit({edits: [{path: "sample.txt", replace: "world", from: "hello"}]}));');
	expect(result.isError).toBe(true);
	expect(result.report).toContain("edits.0 has {path, replace, from}; use {old, new} (or oldText/newText, old_string/new_string, old_text/new_text)");
	expect(result.contents).toBe("hello\n");
});

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
