import { expect, test } from "bun:test";
import { advance, emptyView, line, lines, nodeAt, nodesAt, PLACEHOLDER, span, viewBytes, type Pair, type Texts, type View } from "./tree.ts";

// Every node built, every line the same length, so bytes count lines.
const uniform = (b: number): Texts => ({ text: ([l, i]) => "x".repeat(20), built: () => true });

test("spans and names", () => {
	expect(span(2, [3, 5])).toEqual([40, 8]);
	expect(line(2, [3, 5], "a\n b")).toBe("40+8|a b");
	expect(nodeAt(2, 40, 8, 100)).toEqual([3, 5]);
	expect(nodeAt(2, 41, 8, 100)).toBe("id must be a multiple of n");
	expect(nodeAt(2, 40, 6, 100)).toBe("n must be a power of 2");
	expect(nodeAt(4, 32, 16, 100)).toEqual([2, 2]);
	expect(nodeAt(2, 96, 8, 100)).toContain("isn't complete");
});

test("between batches the view only grows at its end; a batch lands at or under low", () => {
	const t = uniform(2);
	let v: View = emptyView(2), prev: string[] = [], batches = 0;
	for (let T = 1; T <= 3000; T++) {
		const r = advance(v, T, t, 4000, 2000);
		const now = lines(r.view, T, t);
		if (r.merged) { batches++; expect(viewBytes(now)).toBeLessThanOrEqual(2000); }
		else expect(now.slice(0, prev.length)).toEqual(prev);
		expect(viewBytes(now)).toBeLessThanOrEqual(4000 + 30);
		v = r.view; prev = now;
	}
	expect(batches).toBeGreaterThan(10);
});

test("the view covers the chat once, oldest first, coarser with age", () => {
	const t = uniform(2);
	let v = emptyView(2);
	for (let T = 1; T <= 5000; T++) v = advance(v, T, t, 4000, 2000).view;
	const ns = nodesAt(v, 5000);
	let at = 0;
	for (const p of ns) { const [s, n] = span(2, p); expect(s).toBe(at); at += n; }
	expect(at).toBe(5000);
	for (let k = 1; k < ns.length; k++) expect(ns[k]![0]).toBeLessThanOrEqual(ns[k - 1]![0] + 1);
	expect(ns[0]![0]).toBeGreaterThan(ns.at(-1)![0]);
});

test("a batch merges only built parents, and resumes when more are built", () => {
	let builtUpTo = 0, rest = false; // level-1 parents built: i < builtUpTo; higher levels once rest
	const t: Texts = { text: () => "x".repeat(20), built: ([l, i]) => l === 1 ? i < builtUpTo : rest };
	let r = advance(emptyView(2), 400, t, 4000, 2000);
	expect(r.merged).toBe(0);
	expect(r.view.shrinking).toBe(true);
	builtUpTo = 50;
	r = advance(r.view, 401, t, 4000, 2000);
	expect(r.merged).toBe(50);
	expect(r.view.shrinking).toBe(true);
	builtUpTo = 200; rest = true;
	r = advance(r.view, 402, t, 4000, 2000);
	expect(r.view.shrinking).toBe(false);
});

test("fanout 4 merges groups of four", () => {
	const t = uniform(4);
	let v = emptyView(4);
	for (let T = 1; T <= 2000; T++) v = advance(v, T, t, 4000, 2000).view;
	const ns = nodesAt(v, 2000);
	for (const p of ns) { const [s, n] = span(4, p); expect(s % n).toBe(0); expect(Math.log(n) / Math.log(4) % 1).toBe(0); }
});

test("an unbuilt leaf shows the placeholder", () => {
	const t: Texts = { text: ([l, i]: Pair) => i === 2 ? PLACEHOLDER : "m" + i, built: () => false };
	expect(lines(emptyView(2), 3, t)).toEqual(["0+1|m0", "1+1|m1", "2+1|" + PLACEHOLDER]);
});

test("scored: lossless merges fold before lossy ones of the same age and level", () => {
	// pairs whose first leaf is a multiple of 4 merge losslessly; the rest lose everything
	const t: Texts = { ...uniform(2), loss: ([l, i]) => l === 1 ? (i % 2 ? 1 : 0) : 0.5 };
	const v = advance(emptyView(2), 400, t, 4000, 2000, "scored").view;
	const level1 = v.nodes.filter(([l]) => l === 1).map(([, i]) => i);
	const even = level1.filter((i) => i % 2 === 0).length, odd = level1.length - even;
	expect(even).toBeGreaterThan(odd);
	// due alone treats them alike
	const d = advance(emptyView(2), 400, t, 4000, 2000, "due").view.nodes.filter(([l]) => l === 1).map(([, i]) => i);
	expect(Math.abs(d.filter((i) => i % 2 === 0).length - d.filter((i) => i % 2).length)).toBeLessThanOrEqual(1);
});

test("scored: between batches the view only grows at its end, stubs included", () => {
	// message 3k obsoletes message 3k-1 (an overlay known as soon as message 3k exists)
	const t: Texts = { ...uniform(2), loss: ([l, i]) => (i * 7 % 10) / 10, stub: ([l, i], T) => l === 0 && i % 3 === 2 && i + 1 < T ? "(obsolete)" : undefined };
	let v: View = emptyView(2), prev: string[] = [], batches = 0;
	for (let T = 1; T <= 3000; T++) {
		const r = advance(v, T, t, 4000, 2000, "scored");
		const now = lines(r.view, T, t);
		if (r.merged) { batches++; expect(viewBytes(now)).toBeLessThanOrEqual(2000); }
		else expect(now.slice(0, prev.length)).toEqual(prev);
		v = r.view; prev = now;
	}
	expect(batches).toBeGreaterThan(5);
	// a batch stubs what it can: an overlaid leaf still showing is newer than the last batch
	const stubbed = new Set(v.stubs);
	for (const p of nodesAt(v, 3000)) if (p[0] === 0 && p[1] < v.upTo - 1 && t.stub!(p, v.upTo)) expect(stubbed.has(span(2, p).join("+"))).toBe(true);
	expect(stubbed.size).toBeGreaterThan(0);
});
