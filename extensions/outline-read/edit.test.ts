import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocateAnchor, isAnchor, scent, stripPastedPrefix } from "./anchors";
import { parseHunks, registerEditTool } from "./edit";
import { Ledger } from "./ledger";
import { registerReadTool } from "./read";

describe("anchors", () => {
	test("deterministic, unique within a file", () => {
		const taken = new Set<string>();
		const a = allocateAnchor("}", taken);
		const b = allocateAnchor("}", taken);
		expect(a).not.toBe(b);
		expect(isAnchor(a)).toBe(true);
		expect(allocateAnchor("}", new Set())).toBe(a);
	});
	test("anchors of one file share its scent", () => {
		const taken = new Set<string>();
		const xs = ["a", "b", "c"].map((t) => allocateAnchor(t, taken, "/x.ts"));
		expect(new Set(xs.map((a) => a[0])).size).toBe(1);
		expect(xs[0]![0]).toBe(scent("/x.ts"));
	});
	test("strip pasted prefixes", () => {
		expect(stripPastedPrefix("ab3f│x")).toBe("x");
		expect(stripPastedPrefix("+ab3f│x")).toBe("x");
		expect(stripPastedPrefix("plain")).toBe("plain");
	});
});

describe("ledger", () => {
	test("unchanged lines keep anchors across edits; removed anchors are freed; unique across files", () => {
		const ledger = new Ledger();
		const first = ledger.sync("/f", ["a", "b", "c"]).ledger.lines.map((l) => l.anchor);
		const other = ledger.sync("/g", ["a", "b"]).ledger.lines.map((l) => l.anchor);
		expect(new Set([...first, ...other]).size).toBe(5);
		expect(ledger.find(other[1])).toEqual({ path: "/g", index: 1 });
		const { ledger: after, fresh } = ledger.sync("/f", ["a", "new", "c", "d"]);
		expect(after.lines.map((l) => l.anchor)[0]).toBe(first[0]);
		expect(after.lines.map((l) => l.anchor)[2]).toBe(first[2]);
		expect(fresh).toEqual([1, 3]);
		expect(ledger.find(first[1])).toBeUndefined();
	});
	test("restore from entry only when content hash matches", () => {
		const ledger = new Ledger();
		const entry = ledger.sync("/f", ["x", "y"]).ledger && ledger.entry("/f")!;
		const restored = new Ledger();
		restored.restore(entry);
		expect(restored.known("/f")).toBe(true);
		expect(restored.sync("/f", ["x", "y"]).ledger.lines.map((l) => l.anchor)).toEqual(entry.anchors);
		const stale = new Ledger();
		stale.restore(entry);
		expect(stale.sync("/f", ["x", "z"]).changed).toBe(true);
	});
});

describe("parseHunks", () => {
	const known = (a: string) => ["aaaa", "bbbb", "cccc"].includes(a);
	test("forms", () => {
		expect(parseHunks("=aaaa\nx", known)).toEqual([{ header: "=aaaa", from: "aaaa", to: undefined, mode: "replace", path: undefined, lines: ["x"] }]);
		expect(parseHunks("=aaaa @src/a.ts\nx", known)[0]).toMatchObject({ from: "aaaa", path: "src/a.ts" });
		expect(parseHunks("=aaaa bbbb\nx\ny", known)[0]).toMatchObject({ from: "aaaa", to: "bbbb", lines: ["x", "y"] });
		expect(parseHunks("-aaaa bbbb", known)[0]).toMatchObject({ mode: "delete", lines: [] });
		expect(parseHunks(">aaaa\nx", known)[0]).toMatchObject({ mode: "after" });
		expect(parseHunks("<aaaa\nx", known)[0]).toMatchObject({ mode: "before" });
		expect(parseHunks("=aaaa│old text\nx", known)[0]).toMatchObject({ from: "aaaa", lines: ["x"] });
	});
	test("blank lines: separator before a header, content otherwise", () => {
		const h = parseHunks("-aaaa\n\n=bbbb\nx\n\nnot a header\n\n>cccc\ny\n", known);
		expect(h.map((x) => x.header)).toEqual(["-aaaa", "=bbbb", ">cccc"]);
		expect(h[1].lines).toEqual(["x", "", "not a header"]);
	});
	test("empty insert is a blank line", () => {
		expect(parseHunks(">aaaa", known)[0].lines).toEqual([""]);
		expect(parseHunks(">aaaa\n\n=bbbb\nx", known).map(h => h.lines)).toEqual([[""], ["x"]]);
		expect(() => parseHunks("=aaaa", known)).toThrow(/use -aaaa to delete/);
	});

	test("bare words and unknown anchors are text; bodies must fit the sigil", () => {
		expect(parseHunks("=aaaa\nbbbb\n\nzzzz\n\n=zzzz", known)[0].lines).toEqual(["bbbb", "", "zzzz", "", "=zzzz"]);
		expect(() => parseHunks("aaaa\nx", known)).toThrow(/not a hunk header/);
		expect(() => parseHunks("=aaaa", known)).toThrow(/use -aaaa to delete/);
		expect(() => parseHunks("-aaaa\nx", known)).toThrow(/takes no lines/);
		expect(() => parseHunks(">aaaa bbbb\nx", known)).toThrow(/not a hunk header/);
	});
});

describe("edit tool", () => {
	const setup = () => {
		const dir = mkdtempSync(join(tmpdir(), "outline-read-"));
		const file = join(dir, "f.ts");
		writeFileSync(file, "function a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}\n");
		const tools: Record<string, any> = {};
		const pi = { registerTool: (t: any) => (tools[t.name] = t) } as any;
		const ledger = new Ledger();
		const persisted: string[] = [];
		const deps = { ledger, persist: (p: string) => persisted.push(p) };
		registerReadTool(pi, { ...deps, sources: [] });
		registerEditTool(pi, deps);
		const ctx = { cwd: dir };
		const read = async (path = "f.ts") => {
			const r = await tools.read.execute("r", { path }, undefined, undefined, ctx);
			return r.content[0].text.split("\n").slice(1).map((l: string) => l.slice(0, 4));
		};
		const edit = (edits: string) => tools.edit.execute("e", { edits }, undefined, undefined, ctx);
		return { dir, file, read, edit, persisted };
	};

	test("insert a blank line after an anchor", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		await edit(">" + rows[2]);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 1;\n}\n\n\nfunction b() {\n  return 2;\n}\n");
	});

	test("replace, insert, and anchors surviving earlier edits", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		await edit(`=${rows[5]}\n  return 22;\n  // more\n\n>${rows[2]}\n\nconst X = 1;`);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 1;\n}\n\nconst X = 1;\n\nfunction b() {\n  return 22;\n  // more\n}\n");
		const r = await edit(`=${rows[1]}\n  return 11;`);
		expect(r.content[0].text).toContain("-  return 1;");
		expect(readFileSync(file, "utf8")).toContain("  return 11;\n}");
	});

	test("delete and no-op", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		await edit(`-${rows[3]} ${rows[6]}`);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 1;\n}\n");
		const r = await edit(`=${rows[1]}\n  return 1;`);
		expect(r.content[0].text).toContain("no changes");
	});

	test("two files in one call", async () => {
		const { dir, file, read, edit } = setup();
		writeFileSync(join(dir, "g.ts"), "const g = 1;\n");
		const f = await read();
		const g = await read("g.ts");
		const r = await edit(`=${g[0]}\nconst g = 2;\n\n=${f[1]}\n  return g;`);
		expect(r.content[0].text).toContain("g.ts: 1 edit");
		expect(r.content[0].text).toContain("f.ts: 1 edit");
		expect(readFileSync(join(dir, "g.ts"), "utf8")).toBe("const g = 2;\n");
		expect(readFileSync(file, "utf8")).toContain("  return g;");
		const g2 = await read("g.ts");
		await expect(edit(`-${f[0]} ${g2[0]}`)).rejects.toThrow(/different files/);
	});

	test("rejects unknown anchors, overlaps; strips pasted prefixes", async () => {
		const { file, read, edit } = setup();
		await expect(edit("=abcd\nx")).rejects.toThrow(/not a hunk header/);
		const rows = await read();
		await expect(edit(`-${rows[0]} ${rows[2]}\n\n-${rows[1]}`)).rejects.toThrow(/overlap/);
		await edit(`=${rows[1]}\n${rows[1]}│  return 3;`);
		expect(readFileSync(file, "utf8")).toContain("  return 3;");
	});

	test("external change: unchanged anchors still work, changed ones are reported with fresh anchors", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		writeFileSync(file, readFileSync(file, "utf8").replace("return 2", "return 9"));
		const r = await edit(`=${rows[1]}\n  return 0;`);
		expect(r.content[0].text).toContain("File changed on disk");
		await expect(edit(`=${rows[5]}\nx`)).rejects.toThrow(/not a hunk header/);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 0;\n}\n\nfunction b() {\n  return 9;\n}\n");
	});
});
