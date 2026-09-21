import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerEditTool } from "./edit";
import { enclosing, registerGrepTool } from "./grep";
import { Ledger } from "./ledger";
import { treeSitterSource } from "./outline/treesitter";

describe("grep", () => {
	test("enclosing returns the chain outermost first", () => {
		const nodes = [{ name: "A", kind: "class", startLine: 1, endLine: 10, children: [{ name: "m", kind: "method", startLine: 3, endLine: 6, children: [] }] }];
		expect(enclosing(nodes, 4).map((n) => n.name)).toEqual(["A", "m"]);
		expect(enclosing(nodes, 8).map((n) => n.name)).toEqual(["A"]);
		expect(enclosing(nodes, 12)).toEqual([]);
	});

	test("results carry definition context and anchors that edit accepts", async () => {
		const dir = mkdtempSync(join(tmpdir(), "outline-grep-"));
		const file = join(dir, "f.ts");
		writeFileSync(file, "class A {\n  m() {\n    return this.x;\n  }\n}\n\nfunction g() {\n  return this.x;\n}\n");
		const tools: Record<string, any> = {};
		const pi = { registerTool: (t: any) => (tools[t.name] = t) } as any;
		const ledger = new Ledger();
		const deps = { ledger, persist: () => {} };
		registerGrepTool(pi, { ...deps, sources: [treeSitterSource] });
		registerEditTool(pi, deps);
		const ctx = { cwd: dir };
		const r = await tools.grep.execute("g", { pattern: "this\\.x", context: 1 }, undefined, undefined, ctx);
		const text: string = r.content[0].text;
		expect(text).toContain("f.ts\n  A.m (2-4)\n");
		expect(text).toContain("\n  g (7-9)\n");
		const anchor = text.match(/>\s+3 ([a-z2-9]{4})│/)![1];
		await tools.edit.execute("e", { edits: `=${anchor}\n    return this.y;` }, undefined, undefined, ctx);
		expect(readFileSync(file, "utf8")).toContain("  m() {\n    return this.y;\n  }");
		const none = await tools.grep.execute("g", { pattern: "nothing-here" }, undefined, undefined, ctx);
		expect(none.content[0].text).toBe("No matches found");
	});
});
