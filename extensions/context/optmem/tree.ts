// optmem's tree and view, pure (VictorTaelin's UniiChat design, gist 91837951, §2–3).
//
// node(0, i) is message i in at most NODE_BYTES; node(l, i) merges node(l-1, b·i … b·i+b-1). It
// covers the b^l messages from i·b^l on and is named id+n (first message, count). The view is a
// list of nodes covering the chat oldest first, one line each. Between batches it only grows at its
// end (each new message appends its leaf); once past high bytes, one batch merges the most due
// sibling groups whose parent is built until it is at most low bytes (a sawtooth, so the prompt
// cache is rewritten once per batch instead of at every message). Due is how long ago the group
// ended, in its own line size: (T - last) / b^l, oldest first on ties. With b = 2 and a budget of
// log2(T) lines this is Taelin's rollback push (a binary counter); a bigger budget keeps its order
// with more lines per level.
//
// The view is kept, never rebuilt from the log: a rebuilt view differs from the live one and every
// cache entry dies. Only merges are stored (leaves past upTo are implicit), so it is saved once per batch.

export const NODE_BYTES = 512;
export const PLACEHOLDER = "(not summarized yet: zoom it)";

export type Pair = [l: number, i: number];

export interface View {
	b: number;
	/** Nodes covering messages [0, upTo), oldest first. */
	nodes: Pair[];
	upTo: number;
	/** A batch that couldn't reach low yet (parents unbuilt) continues at the next advance. */
	shrinking: boolean;
}

export const emptyView = (b: number): View => ({ b, nodes: [], upTo: 0, shrinking: false });

export const size = (b: number, l: number) => b ** l;
/** First message and count of node (l, i). */
export const span = (b: number, [l, i]: Pair): [start: number, n: number] => [i * b ** l, b ** l];
export const children = (b: number, [l, i]: Pair): Pair[] => Array.from({ length: b }, (_, k) => [l - 1, i * b + k] as Pair);
export const parent = (b: number, [l, i]: Pair): Pair => [l + 1, Math.floor(i / b)];

export const flat = (text: string) => text.replace(/\s*\n\s*/g, " ").trim();
export const line = (b: number, p: Pair, text: string) => { const [s, n] = span(b, p); return s + "+" + n + "|" + flat(text); };
export const bytes = (s: string) => Buffer.byteLength(s);

/** The node for zoom(id, n), or why there is none. */
export function nodeAt(b: number, id: number, n: number, T: number): Pair | string {
	if (!Number.isInteger(id) || !Number.isInteger(n) || id < 0 || n < 1) return "id and n must be whole numbers, n at least 1";
	const l = Math.round(Math.log(n) / Math.log(b));
	if (b ** l !== n) return "n must be a power of " + b;
	if (id % n) return "id must be a multiple of n";
	if (id + n > T) return "the chat has " + T + " messages; " + id + "+" + n + " isn't complete";
	return [l, id / n];
}

/** The view's nodes at T messages (stored ones plus implicit leaves). */
export const nodesAt = (v: View, T: number): Pair[] => [...v.nodes, ...Array.from({ length: Math.max(0, T - v.upTo) }, (_, k) => [0, v.upTo + k] as Pair)];

export interface Texts {
	/** A node's line text, or PLACEHOLDER when it isn't built. */
	text(p: Pair): string;
	/** Whether a merge into this node is possible (it is built). */
	built(p: Pair): boolean;
}

/** The view advanced to T messages, merging a batch when it passes high bytes. Returns the same view when nothing merged. */
export function advance(v: View, T: number, t: Texts, high: number, low: number): { view: View; merged: number } {
	const b = v.b;
	const nodes = nodesAt(v, T);
	const lens = nodes.map((p) => bytes(line(b, p, t.text(p))) + 1);
	let total = lens.reduce((a, x) => a + x, 0);
	let shrinking = v.shrinking || total > high;
	let merged = 0;
	while (shrinking && total > low) {
		let best = -1, bestDue = -Infinity;
		for (let k = 0; k + b <= nodes.length; k++) {
			const [l, i] = nodes[k]!;
			if (i % b) continue;
			let ok = true;
			for (let j = 1; j < b && ok; j++) { const q = nodes[k + j]!; ok = q[0] === l && q[1] === i + j; }
			if (!ok) continue;
			const up = parent(b, [l, i]);
			if (!t.built(up)) continue;
			const last = (i + b) * b ** l - 1;
			const due = (T - last) / b ** l;
			if (due > bestDue) { bestDue = due; best = k; } // strict: the oldest of equals wins
		}
		if (best < 0) break;
		const up = parent(b, nodes[best]!);
		const len = bytes(line(b, up, t.text(up))) + 1;
		const freed = lens.slice(best, best + b).reduce((a, x) => a + x, 0);
		nodes.splice(best, b, up);
		lens.splice(best, b, len);
		total += len - freed;
		merged++;
	}
	if (total <= low) shrinking = false;
	if (!merged && shrinking === v.shrinking) return { view: v, merged };
	return { view: { b, nodes, upTo: T, shrinking }, merged };
}

/** The view's lines at T messages. */
export function lines(v: View, T: number, t: Texts): string[] {
	return nodesAt(v, T).map((p) => line(v.b, p, t.text(p)));
}

export const viewBytes = (ls: string[]) => ls.reduce((a, l) => a + bytes(l) + 1, 0);
