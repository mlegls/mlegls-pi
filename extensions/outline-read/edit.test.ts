import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocateAnchor, isAnchor, stripPastedPrefix } from "./anchors";
import { registerEditTool } from "./edit";
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
	test("strip pasted prefixes", () => {
		expect(stripPastedPrefix("ab3f│x")).toBe("x");
		expect(stripPastedPrefix("+ab3f│x")).toBe("x");
		expect(stripPastedPrefix("plain")).toBe("plain");
	});
});

describe("ledger", () => {
	test("unchanged lines keep anchors across edits; removed anchors are freed", () => {
		const ledger = new Ledger();
		const first = ledger.sync("/f", ["a", "b", "c"]).ledger.lines.map((l) => l.anchor);
		const { ledger: after, fresh } = ledger.sync("/f", ["a", "new", "c", "d"]);
		expect(after.lines.map((l) => l.anchor)[0]).toBe(first[0]);
		expect(after.lines.map((l) => l.anchor)[2]).toBe(first[2]);
		expect(fresh).toEqual([1, 3]);
		expect(after.taken.has(first[1])).toBe(false);
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
		const edit = (edits: any[]) => tools.edit.execute("e", { path: "f.ts", edits }, undefined, undefined, ctx);
		return { file, read, edit, persisted };
	};

	test("replace, insert, and anchors surviving earlier edits", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		await edit([{ from: rows[5], lines: ["  return 22;", "  // more"] }, { after: rows[2], lines: ["", "const X = 1;"] }]);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 1;\n}\n\nconst X = 1;\n\nfunction b() {\n  return 22;\n  // more\n}\n");
		const r = await edit([{ from: rows[1], lines: ["  return 11;"] }]);
		expect(r.content[0].text).toContain("-  return 1;");
		expect(readFileSync(file, "utf8")).toContain("  return 11;\n}");
	});

	test("delete and no-op", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		await edit([{ from: rows[3], to: rows[6], lines: [] }]);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 1;\n}\n");
		const r = await edit([{ from: rows[1], lines: ["  return 1;"] }]);
		expect(r.content[0].text).toStartWith("No changes");
	});

	test("rejects unread files, unknown anchors, overlaps; strips pasted prefixes", async () => {
		const { file, read, edit } = setup();
		await expect(edit([{ from: "abcd", lines: [] }])).rejects.toThrow(/Read it first/);
		const rows = await read();
		await expect(edit([{ from: "zzzz", lines: [] }])).rejects.toThrow(/Unknown anchors: zzzz/);
		await expect(edit([{ from: rows[0], to: rows[2], lines: [] }, { from: rows[1], lines: [] }])).rejects.toThrow(/overlap/);
		await edit([{ from: rows[1], lines: [`${rows[1]}│  return 3;`] }]);
		expect(readFileSync(file, "utf8")).toContain("  return 3;");
	});

	test("external change: unchanged anchors still work, changed ones are reported with fresh anchors", async () => {
		const { file, read, edit } = setup();
		const rows = await read();
		writeFileSync(file, readFileSync(file, "utf8").replace("return 2", "return 9"));
		const r = await edit([{ from: rows[1], lines: ["  return 0;"] }]);
		expect(r.content[0].text).toContain("File changed on disk");
		await expect(edit([{ from: rows[5], lines: ["x"] }])).rejects.toThrow(/Unknown anchors: [a-z2-9]{4}\./);
		writeFileSync(file, readFileSync(file, "utf8").replace("return 9", "return 8"));
		await expect(edit([{ from: rows[5], lines: ["x"] }])).rejects.toThrow(/current anchors:\n[a-z2-9]{4}│  return 8;/);
		expect(readFileSync(file, "utf8")).toBe("function a() {\n  return 0;\n}\n\nfunction b() {\n  return 8;\n}\n");
	});
});
