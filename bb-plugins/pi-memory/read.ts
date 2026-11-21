// Read-only views of the records store for the Pi Memory plugin: notes logs (../../extensions/context/notes.ts)
// and lives (../../extensions/context/life). Run with bun from this checkout; prints one JSON value.
//
//   bun read.ts index
//   bun read.ts notes <log>
//   bun read.ts notes-zoom <log> <lo-hi>
//   bun read.ts life <id>
//   bun read.ts life-zoom <id> <first> <n>
import { db, fieldsOf } from "../../lib/records/store.ts";
import { blockName, load, parseBlock, render, settings as notesSettings, zoomLines } from "../../extensions/context/notes.ts";
import { lifeLog, ofLife, source } from "../../extensions/context/life/log.ts";
import { children, emptyView, NODE_BYTES, nodeAt, nodesAt, span, bytes, type Pair, type View } from "../../extensions/context/life/tree.ts";
import type { LifeMessage } from "../../extensions/context/life/contracts.ts";

const label = (log: string) => log.startsWith("project:") ? log.slice(8).replace(/\/\.git$/, "") : log;

function index() {
	const notes = db().query(
		"SELECT g.value AS log, count(*) AS count, max(r.ts) AS last FROM records r " +
		"JOIN tags g ON g.record = r.seq AND g.key = 'memo.log' JOIN tags k ON k.record = r.seq AND k.key = 'memo.kind' AND k.value = 'note' " +
		"WHERE r.schema = 'memo' GROUP BY g.value ORDER BY last DESC").all() as { log: string; count: number; last: string }[];
	const lives = db().query(
		"SELECT t.value AS id, count(*) AS messages, max(r.ts) AS last FROM records r JOIN tags t ON t.record = r.seq AND t.key = 'life.id' " +
		"WHERE r.schema = 'life' GROUP BY t.value ORDER BY last DESC").all() as { id: string; messages: number; last: string }[];
	return {
		notes: notes.map((n) => ({ ...n, label: label(n.log) })),
		lives: lives.map((l) => ({ ...l, label: l.id.startsWith("/") ? l.id : l.id.replace(/^(.*)\/\.git:/, (_, p) => p.split("/").at(-1) + ":") })),
	};
}

function notes(log: string) {
	const s = load(log), w = notesSettings(process.cwd()).wakeLines;
	const budget = log === "global" ? w.global : w.project;
	return {
		log, label: label(log), count: s.notes.length, budget,
		wake: render(s, budget),
		notes: s.notes.map((n) => ({ lo: n.i, hi: n.i + 1, text: n.text, ts: n.ts, summarized: false, ...(n.dropped ? { dropped: n.dropped } : {}) })),
	};
}

function notesZoom(log: string, block: string) {
	const b = parseBlock(block);
	if (!b) throw new Error("not a block: " + block);
	return { block: blockName(b), lines: zoomLines(load(log), b) };
}

/** A life's messages and node texts, resolved as life/build.ts's Chat does, without its compactor. */
function lifeState(id: string) {
	const msgs: LifeMessage[] = lifeLog(id).read();
	const saved = ofLife("life.view", id).at(-1);
	const view: View = saved ? JSON.parse(saved.body) : emptyView(2);
	const b = view.b;
	const stored = new Map<string, string>();
	for (const r of ofLife("life.node", id)) {
		const f = fieldsOf("life", r.tags);
		if (typeof f.key === "string" && f.b === b && !stored.has(f.key)) stored.set(f.key, r.body);
	}
	const T = msgs.length, memo = new Map<string, string | undefined>();
	const resolve = (p: Pair): string | undefined => {
		const [s, n] = span(b, p);
		if (s + n > T) return;
		const k = JSON.stringify([id, b, ...p]);
		if (memo.has(k)) return memo.get(k);
		let out = stored.get(k);
		if (out === undefined) {
			if (p[0] === 0) { const src = source(msgs[s]!); if (bytes(src) <= NODE_BYTES) out = src; }
			else {
				const kids = children(b, p).map(resolve);
				if (kids.every((t) => t !== undefined)) { const j = kids.join("\n"); if (bytes(j) <= NODE_BYTES) out = j; }
			}
		}
		memo.set(k, out);
		return out;
	};
	const node = (p: Pair) => { const [first, n] = span(b, p), t = resolve(p); return { first, n, text: t ?? "(not summarized yet: open it)", built: t !== undefined, date: msgs[first]?.date }; };
	return { msgs, view, b, T, node };
}

function life(id: string) {
	const { view, b, T, node } = lifeState(id);
	const stubs = new Set(view.stubs ?? []);
	const places = new Map<string, { session: string; thread?: string; time: string; ended: boolean; hold: string }>();
	const ended = new Set(ofLife("life.end", id).map((r) => fieldsOf("life", r.tags).run));
	for (const r of ofLife("life.run", id)) {
		const f = fieldsOf("life", r.tags);
		places.set(String(f.thread ?? f.session), { session: String(f.session), ...(f.thread ? { thread: String(f.thread) } : {}), time: String(f.time), ended: ended.has(r.id), hold: "" });
	}
	for (const r of ofLife("life.hold", id)) {
		const s = fieldsOf("life", r.tags).session;
		for (const p of places.values()) if (p.session === s) p.hold = r.body;
	}
	return {
		id, T, b, savedUpTo: view.upTo,
		view: nodesAt(view, T).map((p) => ({ ...node(p), stub: stubs.has(span(b, p).join("+")) })),
		places: [...places.values()].reverse(),
	};
}

function lifeZoom(id: string, first: number, n: number) {
	const { msgs, b, T, node } = lifeState(id);
	const p = nodeAt(b, first, n, T);
	if (typeof p === "string") throw new Error(p);
	if (p[0] === 0) { const m = msgs[first]!; return { message: { ...m } }; }
	return { lines: children(b, p).map((q) => ({ ...node(q), stub: false })) };
}

const [cmd, ...args] = process.argv.slice(2);
const out = cmd === "index" ? index()
	: cmd === "notes" ? notes(args[0]!)
	: cmd === "notes-zoom" ? notesZoom(args[0]!, args[1]!)
	: cmd === "life" ? life(args[0]!)
	: cmd === "life-zoom" ? lifeZoom(args[0]!, Number(args[1]), Number(args[2]))
	: (() => { throw new Error("unknown command: " + cmd); })();
process.stdout.write(JSON.stringify(out));
