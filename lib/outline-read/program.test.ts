import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Index, index } from "../code";

const fixture = () => {
	const dir = mkdtempSync(join(tmpdir(), "program-"));
	cpSync(join(import.meta.dir, "fixtures/program"), dir, { recursive: true });
	return dir;
};
const names = (ds: { name: string }[]) => ds.map(d => d.name);
const rewrite = (file: string, from: string, to: string) => writeFileSync(file, readFileSync(file, "utf8").replace(from, to));

describe("program index", () => {
	test("definitions at statement grain, with docs and trailing comments", () => {
		const ix = index(fixture());
		expect(ix).toBeInstanceOf(Index);
		expect(ix.defs({ file: "shapes.ts" }).map(d => [d.kind, d.name, d.line, d.endLine])).toEqual([
			["type", "Circle", 3, 3], ["type", "Rect", 4, 4], ["type", "Shape", 5, 5],
			["function", "area", 7, 9], ["function", "perimeter", 11, 14], ["const", "unit", 16, 16],
		]);
		expect(ix.def("Shape").body).toBe('export type Shape = Circle | Rect; // sum');
		expect(ix.def("perimeter").body.startsWith("/** Perimeter")).toBe(true);
		expect(ix.def("area").signature).toBe("export function area(s: Shape): number");
		expect(ix.defs({ kind: "import" }).map(d => d.name)).toEqual(["../shapes.ts"]);
		expect(() => ix.def("nope")).toThrow("0 definitions");
	});
	test("references are resolved by the checker", () => {
		const ix = index(fixture());
		const area = ix.def("area");
		expect(ix.callers(area)).toEqual([{ def: ix.def("ok"), kind: "call" }]);
		expect(ix.callees(area).map(e => e.def.name + ":" + e.kind)).toEqual(["Shape:type", "Circle:member", "Rect:member"]);
		expect(names(ix.tests(area))).toEqual(["ok"]);
		expect(names(ix.dead())).toEqual(["perimeter", "ok"]);
		expect(names(ix.impact(ix.def("Rect")))).toEqual(["Shape", "area", "perimeter", "unit", "ok"]);
	});
	test("each call re-reads the tree and re-resolves what changed", () => {
		const dir = fixture();
		expect(names(index(dir).callers(index(dir).def("perimeter")).map(e => e.def))).toEqual([]);
		rewrite(join(dir, "test/shapes.ts"), "{ area, unit }", "{ area, perimeter, unit }");
		writeFileSync(join(dir, "test/shapes.ts"), readFileSync(join(dir, "test/shapes.ts"), "utf8") + "export const p = perimeter(unit);\n");
		let ix = index(dir);
		expect(names(ix.callers(ix.def("perimeter")).map(e => e.def))).toEqual(["p"]);
		rewrite(join(dir, "shapes.ts"), "perimeter(s", "perim(s");
		ix = index(dir);
		expect(names(ix.defs({ file: "shapes.ts", kind: "function" }))).toEqual(["area", "perim"]);
		expect(names(ix.dead())).toEqual(["perim", "ok", "p"]);
	});
});
