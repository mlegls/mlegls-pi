// Shared records store: an append-only SQLite log of records, their tags and edges.
// Schema is what a record means (board, om, ...); tags and edges are relational and
// written in the same transaction as their record. Nothing is updated or deleted:
// a later judgment about a record is a new record (often just an edge).
//
// Importable from plain bun scripts without any extension.

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** A tag value: a string or number is stored as itself (numbers compare as numbers); anything else is JSON. */
export type TagValue = string | number | boolean | null | object;

/** One tag row. `value` undefined is a bare tag. `ord` is the element index when the value came from an array. */
export interface Tag {
	key: string;
	value?: TagValue;
	ord?: number;
}

export interface Edge {
	/** Defaults to the record being written. */
	src?: string;
	rel: string;
	/** A record id, or an external ref such as `entry:<session>/<entry>`. */
	dst: string;
}

export interface RecordInput {
	id?: string;
	ts?: string;
	schema: string;
	body?: string;
	tags?: Tag[];
	edges?: Edge[];
}

export interface StoredRecord {
	seq: number;
	id: string;
	ts: string;
	schema: string;
	body: string;
	tags: Tag[];
}

/** Directory of the shared store (and the board's audit files). PI_BOARD_DIR overrides. */
export function storeDir(): string {
	return process.env.PI_BOARD_DIR
		?? join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "pi-board");
}

export function storePath(): string {
	return join(storeDir(), "records.db");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
	seq INTEGER PRIMARY KEY AUTOINCREMENT,
	id TEXT NOT NULL UNIQUE,
	ts TEXT NOT NULL,
	schema TEXT NOT NULL,
	body TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS records_schema ON records(schema, seq);
-- value has no type affinity: text, integer/real, or a BLOB holding JSON.
CREATE TABLE IF NOT EXISTS tags (
	record INTEGER NOT NULL REFERENCES records(seq),
	key TEXT NOT NULL,
	value,
	ord INTEGER
);
CREATE INDEX IF NOT EXISTS tags_kv ON tags(key, value, record);
CREATE INDEX IF NOT EXISTS tags_record ON tags(record);
CREATE TABLE IF NOT EXISTS edges (
	record INTEGER NOT NULL REFERENCES records(seq),
	src TEXT NOT NULL,
	rel TEXT NOT NULL,
	dst TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS edges_src ON edges(src, rel);
CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst, rel);
`;

let cached: { path: string; db: Database } | undefined;

/** The store at storePath(), opened once per path per process. */
export function db(): Database {
	const path = storePath();
	if (cached?.path === path) return cached.db;
	cached?.db.close();
	mkdirSync(dirname(path), { recursive: true });
	const d = new Database(path, { create: true });
	d.exec("PRAGMA busy_timeout = 5000");
	d.exec("PRAGMA journal_mode = WAL");
	d.exec("PRAGMA synchronous = NORMAL");
	d.exec(SCHEMA);
	cached = { path, db: d };
	return d;
}

let lastMs = 0;
/** A fresh id and timestamp, monotonic within the process; the random suffix disambiguates across processes. */
export function stamp(): { id: string; ts: string } {
	let ms = Date.now();
	if (ms <= lastMs) ms = lastMs + 1;
	lastMs = ms;
	return { id: `${ms.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, ts: new Date(ms).toISOString() };
}

function encode(value: TagValue | undefined): string | number | Uint8Array | null {
	if (value === undefined) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	return new TextEncoder().encode(JSON.stringify(value));
}

function decode(value: unknown): TagValue | undefined {
	if (value === null) return undefined;
	if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value));
	return value as string | number;
}

/** Tags for a schema's flat top-level fields: `prefix.field`; a scalar array becomes one row per element. */
export function fieldTags(prefix: string, fields: Record<string, unknown>): Tag[] {
	const out: Tag[] = [];
	for (const [field, value] of Object.entries(fields)) {
		if (value === undefined) continue;
		const key = prefix ? `${prefix}.${field}` : field;
		const scalars = Array.isArray(value) && value.length > 0
			&& value.every((v) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)));
		if (scalars) (value as (string | number)[]).forEach((v, ord) => out.push({ key, value: v, ord }));
		else out.push({ key, value: value as TagValue });
	}
	return out;
}

/** Inverse of fieldTags for one prefix. */
export function fieldsOf(prefix: string, tags: readonly Tag[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const head = prefix ? prefix + "." : "";
	for (const tag of tags) {
		if (!tag.key.startsWith(head) || tag.key === prefix) continue;
		const field = tag.key.slice(head.length);
		if (tag.ord === undefined) out[field] = tag.value;
		else ((out[field] ??= []) as unknown[])[tag.ord] = tag.value;
	}
	return out;
}

/** Append a record with its tags and edges in one transaction. Returns the stored record. */
export function write(input: RecordInput, d: Database = db()): StoredRecord {
	const fresh = stamp();
	const id = input.id ?? fresh.id;
	const ts = input.ts ?? fresh.ts;
	const body = input.body ?? "";
	const tags = input.tags ?? [];
	let seq = 0;
	d.transaction(() => {
		const row = d.query("INSERT INTO records (id, ts, schema, body) VALUES (?, ?, ?, ?) RETURNING seq").get(id, ts, input.schema, body) as { seq: number };
		seq = row.seq;
		const tag = d.query("INSERT INTO tags (record, key, value, ord) VALUES (?, ?, ?, ?)");
		for (const t of tags) tag.run(seq, t.key, encode(t.value), t.ord ?? null);
		const edge = d.query("INSERT INTO edges (record, src, rel, dst) VALUES (?, ?, ?, ?)");
		for (const e of input.edges ?? []) edge.run(seq, e.src ?? id, e.rel, e.dst);
	})();
	return { seq, id, ts, schema: input.schema, body, tags };
}

/** Records of a schema with seq > after (and optional extra SQL condition on `r`), in seq order, tags attached. */
export function select(schema: string, options: { after?: number; where?: string; params?: (string | number)[] } = {}, d: Database = db()): StoredRecord[] {
	const where = `r.schema = ? AND r.seq > ?${options.where ? ` AND (${options.where})` : ""}`;
	const params = [schema, options.after ?? 0, ...(options.params ?? [])];
	const rows = d.query(`SELECT seq, id, ts, schema, body FROM records r WHERE ${where} ORDER BY seq`).all(...params) as Omit<StoredRecord, "tags">[];
	if (!rows.length) return [];
	const bySeq = new Map<number, StoredRecord>();
	for (const r of rows) bySeq.set(r.seq, { ...r, tags: [] });
	const tagRows = d.query(`SELECT t.record, t.key, t.value, t.ord FROM tags t JOIN records r ON r.seq = t.record WHERE ${where} ORDER BY t.rowid`).all(...params) as { record: number; key: string; value: unknown; ord: number | null }[];
	for (const t of tagRows) {
		const tag: Tag = { key: t.key };
		const value = decode(t.value);
		if (value !== undefined) tag.value = value;
		if (t.ord !== null) tag.ord = t.ord;
		bySeq.get(t.record)?.tags.push(tag);
	}
	return [...bySeq.values()];
}

/** Highest seq in the store (any schema); 0 when empty. A cursor for `select({ after })`. */
export function lastSeq(d: Database = db()): number {
	return (d.query("SELECT coalesce(max(seq), 0) AS n FROM records").get() as { n: number }).n;
}

/** Changes whenever any connection (this one included) commits; cheap to poll. */
export function version(d: Database = db()): string {
	const dv = d.query("PRAGMA data_version").values()[0]![0];
	const own = d.query("SELECT total_changes()").values()[0]![0];
	return `${dv}:${own}`;
}
