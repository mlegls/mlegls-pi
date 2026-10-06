import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "memo-"));
const m = await import("./memo.ts");

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
	for (let i = 0; i < 40; i++) m.note("fact " + i, "s", "/tmp");
	let s = m.load();
	expect(s.notes.map((n) => n.i)).toEqual([...Array(40).keys()]);
	const todo = m.pending(40, (b) => s.summary(b) !== undefined);
	expect(todo[0]).toEqual([0, 2]);
	expect(todo.length).toBe(20 + 10 + 5 + 2 + 1);
	for (const b of todo) m.writeSummary(b, "sum " + m.blockName(b), "s");
	s = m.load();
	const w = m.wake(s, 8);
	expect(w.length).toBe(8);
	expect(w[0]).toBe("#0-15 sum 0-15");
	expect(w.at(-1)).toContain("fact 39");
	expect(m.zoom(s, [0, 32])).toBe("#0-15 sum 0-15\n#16-31 sum 16-31");
	m.forget([4, 6], "s");
	s = m.load();
	expect(s.summary([4, 6])).toBeUndefined();
	expect(s.summary([0, 32])).toBeUndefined();
	expect(s.summary([32, 40])).toBe("sum 32-39");
	expect(m.pending(40, (b) => s.summary(b) !== undefined)).toEqual([[4, 6], [4, 8], [0, 8], [0, 16], [0, 32]]);
	// an unwritten summary renders as its halves
	expect(m.wake(s, 8)[0]).toStartWith("#0-3 ");
	expect(() => m.note("x".repeat(281), "s", "/tmp")).toThrow(/Too long/);
	expect(m.parseBlock("4-5")).toEqual([4, 6]);
	expect(m.parseBlock("5-6")).toBeUndefined();
});
