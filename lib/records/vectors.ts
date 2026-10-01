// Embeddings of the records store, for similarity recall. A derived index in its own file (records-vec.db next to
// records.db): rebuildable, so the append-only log stays the only source of truth. Vectors are Qwen3-Embedding-8B
// via OpenRouter at 512 dimensions (MRL; key from OPENROUTER_API_KEY or pi's auth.json), queries carrying Qwen's
// instruction prefix, documents bare; unit-normalized and int8-quantized. Changing MODEL or DIMS rebuilds. Search is a
// brute-force dot product over an in-memory copy, which at ~100k records is ~50MB and tens of milliseconds.
// Catch-up is lazy: each search first embeds records written since the last embedded seq.
//
//   bun lib/records/vectors.ts backfill    embed everything not yet embedded
//   bun lib/records/vectors.ts "query"     search from the shell
import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { db as recordsDb, storeDir } from "./store.ts";

const MODEL = "qwen/qwen3-embedding-8b", DIMS = 512;
const QUERY = "Instruct: Given a question about earlier agent work, retrieve the memories, notes or messages that answer it\nQuery: ";
/** Schemas worth searching; cursor records are bookkeeping. */
export const EMBEDDED = ["om", "journal", "board", "elided"];
const MIN_CHARS = 20, MAX_CHARS = 6000, BATCH = 128, PARALLEL = 8;

let cached: Database | undefined;
function vdb(): Database {
	if (cached) return cached;
	const d = new Database(join(storeDir(), "records-vec.db"), { create: true });
	d.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL");
	d.exec("CREATE TABLE IF NOT EXISTS vec (seq INTEGER PRIMARY KEY, schema TEXT NOT NULL, v BLOB NOT NULL)");
	d.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value)");
	const space = MODEL + "@" + DIMS;
	if ((d.query("SELECT value FROM meta WHERE key = 'space'").get() as { value: string } | null)?.value !== space) {
		d.exec("DELETE FROM vec; DELETE FROM meta");
		d.query("INSERT INTO meta (key, value) VALUES ('space', ?)").run(space);
	}
	return (cached = d);
}

const cursor = (d: Database) => ((d.query("SELECT value FROM meta WHERE key = 'cursor'").get() as { value: number } | null)?.value ?? 0);

function apiKey(): string | undefined {
	if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
	const auth = join(homedir(), ".pi", "agent", "auth.json");
	try { return existsSync(auth) ? JSON.parse(readFileSync(auth, "utf8")).openrouter?.key : undefined; } catch { return undefined; }
}

async function embed(texts: string[]): Promise<Float32Array[]> {
	const key = apiKey();
	if (!key) throw new Error("no OpenRouter key (OPENROUTER_API_KEY or ~/.pi/agent/auth.json); similarity recall needs it");
	for (let attempt = 0; ; attempt++) {
		const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
			method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
			body: JSON.stringify({ model: MODEL, dimensions: DIMS, input: texts }),
		});
		if (res.ok) return ((await res.json()) as any).data.map((x: any) => Float32Array.from(x.embedding));
		if (attempt < 4 && (res.status === 429 || res.status >= 500)) { await Bun.sleep(1000 * 2 ** attempt); continue; }
		throw new Error("embeddings " + res.status + ": " + (await res.text()).slice(0, 300));
	}
}

function quantize(v: Float32Array): Uint8Array {
	let n = 0;
	for (const x of v) n += x * x;
	n = Math.sqrt(n) || 1;
	const q = new Int8Array(v.length);
	for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round((v[i] / n) * 127)));
	return new Uint8Array(q.buffer);
}

const textOf = (schema: string, body: string, topic?: string) => (topic ? topic + ": " : "") + body.slice(0, MAX_CHARS);

/** Embed records written since the last catch-up, at most `limit`; returns how many are still pending. */
export async function catchUp(limit = Infinity, log?: (s: string) => void): Promise<number> {
	const d = vdb(), r = recordsDb();
	const ph = EMBEDDED.map(() => "?").join(",");
	let done = 0;
	for (;;) {
		const after = cursor(d);
		const rows = r.query("SELECT r.seq, r.schema, r.body, (SELECT value FROM tags WHERE record = r.seq AND key = 'topic') AS topic FROM records r WHERE r.seq > ? AND r.schema IN (" + ph + ") ORDER BY r.seq LIMIT ?")
			.all(after, ...EMBEDDED, BATCH * PARALLEL) as { seq: number; schema: string; body: string; topic?: string }[];
		if (!rows.length) return 0;
		const keep = rows.filter((x) => x.body.trim().length >= MIN_CHARS);
		const chunks: typeof keep[] = [];
		for (let i = 0; i < keep.length; i += BATCH) chunks.push(keep.slice(i, i + BATCH));
		const vs = (await Promise.all(chunks.map((c) => embed(c.map((x) => textOf(x.schema, x.body, x.topic)))))).flat();
		const ins = d.query("INSERT OR REPLACE INTO vec (seq, schema, v) VALUES (?, ?, ?)");
		d.transaction(() => {
			keep.forEach((x, i) => ins.run(x.seq, x.schema, quantize(vs[i])));
			d.query("INSERT OR REPLACE INTO meta (key, value) VALUES ('cursor', ?)").run(rows[rows.length - 1].seq);
		})();
		done += rows.length;
		log?.("embedded through seq " + rows[rows.length - 1].seq + " (" + done + " records)");
		if (done >= limit) {
			const left = r.query("SELECT count(*) AS n FROM records WHERE seq > ? AND schema IN (" + ph + ")").get(cursor(d), ...EMBEDDED) as { n: number };
			return left.n;
		}
	}
}

// In-memory copy of the vectors, extended as new ones are embedded.
let mem = { seqs: [] as number[], schemas: [] as string[], v: new Int8Array(0), top: 0 };
const row = new Map<number, number>();
function load() {
	const rows = vdb().query("SELECT seq, schema, v FROM vec WHERE seq > ? ORDER BY seq").all(mem.top) as { seq: number; schema: string; v: Uint8Array }[];
	if (!rows.length) return;
	const v = new Int8Array(mem.v.length + rows.length * DIMS);
	v.set(mem.v);
	rows.forEach((x, i) => v.set(new Int8Array(x.v.buffer, x.v.byteOffset, DIMS), mem.v.length + i * DIMS));
	rows.forEach((x, i) => row.set(x.seq, mem.seqs.length + i));
	mem = { seqs: [...mem.seqs, ...rows.map((x) => x.seq)], schemas: [...mem.schemas, ...rows.map((x) => x.schema)], v, top: rows[rows.length - 1].seq };
}

export interface Hit { seq: number; score: number }

/** Records most similar to `text`, best first; catches up on at most `catchUpLimit` new records first. */
export async function nearest(text: string, o: { k?: number; schema?: string; seqs?: Set<number>; catchUpLimit?: number } = {}): Promise<{ hits: Hit[]; pending: number }> {
	const pending = await catchUp(o.catchUpLimit ?? 2000);
	load();
	const q = new Int8Array(quantize((await embed([QUERY + text]))[0]).buffer);
	const k = o.k ?? 10, hits: Hit[] = [];
	for (let i = 0; i < mem.seqs.length; i++) {
		if (o.schema && mem.schemas[i] !== o.schema) continue;
		if (o.seqs && !o.seqs.has(mem.seqs[i])) continue;
		let s = 0;
		const base = i * DIMS;
		for (let j = 0; j < DIMS; j++) s += q[j] * mem.v[base + j];
		if (hits.length < k || s > hits[hits.length - 1].score) {
			hits.push({ seq: mem.seqs[i], score: s });
			hits.sort((a, b) => b.score - a.score);
			if (hits.length > k) hits.pop();
		}
	}
	return { hits: hits.map((h) => ({ seq: h.seq, score: h.score / (127 * 127) })), pending };
}

/** `seqs` in order, dropping any whose cosine with an already kept one exceeds `threshold` (restated memories). */
export function dedupe(seqs: number[], threshold = 0.95): number[] {
	load();
	const kept: number[] = [], rows: number[] = [];
	for (const seq of seqs) {
		const i = row.get(seq);
		if (i !== undefined && rows.some((j) => {
			let s = 0;
			for (let d = 0; d < DIMS; d++) s += mem.v[i * DIMS + d] * mem.v[j * DIMS + d];
			return s / (127 * 127) > threshold;
		})) continue;
		kept.push(seq);
		if (i !== undefined) rows.push(i);
	}
	return kept;
}

if (import.meta.main) {
	const arg = process.argv[2];
	if (arg === "backfill") console.log("pending: " + (await catchUp(Infinity, (s) => console.error(s))));
	else if (arg) {
		const { hits } = await nearest(arg, { catchUpLimit: 0 });
		const r = recordsDb();
		for (const h of hits) {
			const x = r.query("SELECT schema, id, substr(body, 1, 160) AS body FROM records WHERE seq = ?").get(h.seq) as any;
			console.log(h.score.toFixed(3), x.schema, x.id, x.body.replace(/\n/g, " "));
		}
	}
}
