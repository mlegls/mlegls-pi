import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "memo-"));
const m = await import("./notes.ts");

test("cover tiles [0,T) with aligned blocks, within budget, finest at the present", () => {
	for (const T of [1, 5, 96, 97, 200, 1000, 12345]) {
		const c = m.cover(T, 96);
		expect(c.length).toBeLessThanOrEqual(96);
		let at = 0;
		for (const [lo, hi] of c) { const n = hi - lo; expect(lo).toBe(at); expect(n & (n - 1)).toBe(0); expect(lo % n).toBe(0); at = hi; }
		expect(at).toBe(T);
		expect(c.at(-1)![1] - c.at(-1)![0]).toBe(1);
	}
	expect(m.cover(50, 96).every(([lo, hi]) => hi - lo === 1)).toBe(true);
});

test("notes, summaries, forgetting, wake and zoom", () => {
	for (let i = 0; i < 40; i++) m.note("global", "fact " + i, "s", "/tmp");
	m.note("local:x", "elsewhere", "s", "/tmp");
	expect(m.load("local:x").notes.map((n) => [n.i, n.text])).toEqual([[0, "elsewhere"]]);
	let s = m.load("global");
	expect(s.notes.map((n) => n.i)).toEqual([...Array(40).keys()]);
	const todo = m.pending(40, (b) => s.summary(b) !== undefined);
	expect(todo[0]).toEqual([0, 2]);
	expect(todo.length).toBe(20 + 10 + 5 + 2 + 1);
	for (const b of todo) m.writeSummary("global", b, "sum " + m.blockName(b), "s");
	expect(m.load("local:x").summary([0, 2])).toBeUndefined();
	s = m.load("global");
	const w = m.wake(s, 8);
	expect(w.length).toBe(8);
	expect(w[0]).toBe("#0-15 sum 0-15");
	expect(w.at(-1)).toContain("fact 39");
	expect(m.zoom(s, [0, 32])).toBe("#0-15 sum 0-15\n#16-31 sum 16-31");
	m.forget("global", [4, 6], "s");
	s = m.load("global");
	expect(s.summary([4, 6])).toBeUndefined();
	expect(s.summary([0, 32])).toBeUndefined();
	expect(s.summary([32, 40])).toBe("sum 32-39");
	expect(m.pending(40, (b) => s.summary(b) !== undefined)).toEqual([[4, 6], [4, 8], [0, 8], [0, 16], [0, 32]]);
	// an unwritten summary renders as its halves
	expect(m.wake(s, 8)[0]).toStartWith("#0-3 ");
	expect(() => m.note("global", "x".repeat(281), "s", "/tmp")).toThrow(/Too long/);
	expect(m.parseBlock("4-5")).toEqual([4, 6]);
	expect(m.parseBlock("5-6")).toBeUndefined();
});

test("replacing and removing notes", () => {
	const log = "replace";
	for (let i = 0; i < 8; i++) m.note(log, "fact " + i, "s", "/tmp");
	let s = m.load(log);
	for (const b of m.todo(s)) m.writeSummary(log, b, "sum " + m.blockName(b), "s");
	expect(m.replace(log, [2], "fact 2, corrected", "s", "/tmp")).toBe(8);
	expect(m.replace(log, [5], undefined, "s", "/tmp")).toBeUndefined();
	expect(() => m.replace(log, [5], "again", "s", "/tmp")).toThrow(/already removed/);
	expect(() => m.replace(log, [99], "x", "s", "/tmp")).toThrow(/No note #99/);
	expect(m.load(log).notes.length).toBe(9); // the failed calls wrote nothing
	s = m.load(log);
	expect(s.notes[2]!.dropped).toEqual({ by: 8 });
	expect(s.notes[5]!.dropped).toEqual({});
	// summaries over a dropped note are forgotten; the others stay
	expect(s.summary([0, 8])).toBeUndefined();
	expect(s.summary([2, 4])).toBeUndefined();
	expect(s.summary([0, 2])).toBe("sum 0-1");
	const all = m.wake(s, 20).join("\n");
	expect(all).not.toContain("fact 2 ");
	expect(all).not.toContain("fact 5");
	expect(all).toContain("fact 2, corrected");
	expect(m.wake(s, 20).length).toBe(7);
	// a block of only dropped notes needs no summary and renders nothing
	m.replace(log, [4], undefined, "s", "/tmp");
	s = m.load(log);
	expect(m.todo(s)).toEqual([[2, 4], [0, 4], [4, 8], [0, 8]]);
	expect(m.zoom(s, [4, 6])).toContain("(removed) fact 4");
	expect(m.zoom(s, [0, 4])).toContain("#2-3 (not compressed");
	// dropped notes free lines for finer blocks
	for (const b of m.todo(s)) m.writeSummary(log, b, "sum " + m.blockName(b), "s");
	expect(m.render(m.load(log), 3).length).toBeLessThanOrEqual(3);
});
