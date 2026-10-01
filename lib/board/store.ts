// Board messages: records of schema `board` in the shared records store
// (lib/records/store). Every pi session (and any script) on this machine reads and
// writes the same store. Importable from plain bun scripts without the extension.
//
// A message is stored as tags: `topic`; `from` as `session`, `name`, `cwd`;
// each board tag `k:v` as key k, value v (a bare tag has no value); `data`'s
// top-level fields as `board.<field>` (a non-object or empty data is one `board` tag).

import type { Database } from "bun:sqlite";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { compileQuery, type Query } from "./query";
import { db, fieldTags, fieldsOf, lastSeq, select, stamp, storeDir, version, write, type StoredRecord, type Tag } from "../records/store";

export interface Message {
	id: string;
	ts: string;
	topic: string;
	tags: string[];
	from: { session?: string; name?: string; cwd?: string };
	body: string;
	data?: unknown;
}

/** Scripts may omit sender metadata; other malformed records aren't messages. */
function decodeMessage(value: unknown): Message | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return;
	const m = value as Record<string, unknown>;
	if (![m.id, m.ts, m.topic, m.body].every((v) => typeof v === "string")) return;
	if (!Array.isArray(m.tags) || !m.tags.every((v) => typeof v === "string")) return;
	const from = m.from ?? {};
	if (typeof from !== "object" || Array.isArray(from)) return;
	const sender = from as Record<string, unknown>;
	if (![sender.session, sender.name, sender.cwd].every((v) => v === undefined || typeof v === "string")) return;
	return { ...m, from } as Message;
}

/** A message with its position in the store (records seq); stable across reads, so it addresses `range`. */
export type Numbered = Message & { line: number };

/** Compact projection for listing: no data, body sliced to bodyChars (0 drops body). bodyTruncated is set when the snippet is shorter than the original. */
export type Meta = Pick<Numbered, "id" | "line" | "ts" | "topic" | "tags" | "from"> & { body?: string; bodyTruncated?: true };

export function meta(m: Numbered, bodyChars = 120): Meta {
	if (!Number.isInteger(bodyChars) || bodyChars < 0) throw new Error("bodyChars must be a nonnegative integer");
	const out: Meta = { id: m.id, line: m.line, ts: m.ts, topic: m.topic, tags: m.tags, from: m.from };
	if (bodyChars > 0) {
		out.body = m.body.slice(0, bodyChars);
		if (m.body.length > bodyChars) out.bodyTruncated = true;
	}
	return out;
}

export function boardDir(): string {
	return storeDir();
}

/** The JSONL log that preceded the store (see syncLegacy). */
export function legacyLogPath(): string {
	return join(boardDir(), "log.jsonl");
}

const SCHEMA = "board";
const FROM = ["session", "name", "cwd"] as const;
const FIELD_KEYS = new Set<string>(["topic", ...FROM, SCHEMA]);

function toTags(m: Message): Tag[] {
	const tags: Tag[] = [{ key: "topic", value: m.topic }];
	for (const k of FROM) if (m.from[k] !== undefined) tags.push({ key: k, value: m.from[k] });
	for (const t of m.tags) {
		const colon = t.indexOf(":");
		tags.push(colon < 0 ? { key: t } : { key: t.slice(0, colon), value: t.slice(colon + 1) });
	}
	const data = m.data;
	if (data !== undefined) {
		const plain = data !== null && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 0;
		tags.push(...(plain ? fieldTags(SCHEMA, data as Record<string, unknown>) : [{ key: SCHEMA, value: data as Tag["value"] }]));
	}
	return tags;
}

function fromRecord(r: StoredRecord): Numbered {
	const m: Numbered = { id: r.id, line: r.seq, ts: r.ts, topic: "", tags: [], from: {}, body: r.body };
	let data: unknown;
	for (const t of r.tags) {
		if (t.key === "topic") m.topic = String(t.value);
		else if (t.key === SCHEMA) data = t.value;
		else if ((FROM as readonly string[]).includes(t.key)) m.from[t.key as (typeof FROM)[number]] = String(t.value);
		else if (!t.key.startsWith(SCHEMA + ".")) m.tags.push(t.value === undefined ? t.key : `${t.key}:${t.value}`);
	}
	if (data === undefined && r.tags.some((t) => t.key.startsWith(SCHEMA + "."))) data = fieldsOf(SCHEMA, r.tags);
	if (data !== undefined) m.data = data;
	return m;
}

function store(m: Message, d?: Database): number {
	if (m.tags.some((t) => FIELD_KEYS.has(t.split(":")[0]!) || t.startsWith(SCHEMA + ".")))
		throw new TypeError(`Board tags can't use the reserved keys ${[...FIELD_KEYS].join(", ")} or ${SCHEMA}.*`);
	return write({ id: m.id, ts: m.ts, schema: SCHEMA, body: m.body, tags: toTags(m) }, d).seq;
}

// Bridge from the JSONL log that preceded the store, for as long as sessions running the old
// code still read and append it: new lines are imported (skipping ids already stored) before
// every read, and send appends there too. The first sync imports the whole history.
// Remove once no session runs the JSONL board.
function syncLegacy(d: Database = db()): void {
	const path = legacyLogPath();
	if (!existsSync(path)) return;
	d.exec("CREATE TABLE IF NOT EXISTS board_legacy (offset INTEGER NOT NULL)");
	const offset = () => (d.query("SELECT offset FROM board_legacy").get() as { offset: number } | null)?.offset ?? 0;
	if (statSync(path).size <= offset()) return;
	d.transaction(() => {
		// Re-read under the write lock: another process may have imported meanwhile.
		const from = offset();
		const size = statSync(path).size;
		if (size <= from) return;
		const fd = openSync(path, "r");
		const buffer = Buffer.alloc(size - from);
		try {
			readSync(fd, buffer, 0, buffer.length, from);
		} finally {
			closeSync(fd);
		}
		const text = buffer.toString("utf8");
		const cut = text.lastIndexOf("\n");
		if (cut < 0) return;
		const known = d.query("SELECT 1 FROM records WHERE id = ?");
		for (const line of text.slice(0, cut).split("\n")) {
			if (!line) continue;
			let message: Message | undefined;
			try {
				message = decodeMessage(JSON.parse(line));
			} catch {}
			if (!message || known.get(message.id)) continue;
			try {
				store(message, d);
			} catch {}
		}
		d.query("DELETE FROM board_legacy").run();
		d.query("INSERT INTO board_legacy (offset) VALUES (?)").run(from + Buffer.byteLength(text.slice(0, cut + 1)));
	}).immediate();
}

/** A board read or acknowledgment, appended to `reads.jsonl` beside the store so delivery is auditable without grepping sessions. */
export interface ReadEvent {
	ts: string;
	action: "read" | "ack";
	reader: { session?: string; name?: string; cwd?: string };
	ids?: string[];
	topic?: string;
	tags?: string;
	count?: number;
}

export function readsPath(): string {
	return join(boardDir(), "reads.jsonl");
}

export function send(input: Omit<Message, "id" | "ts">): Message {
	const message = decodeMessage({ ...stamp(), ...input });
	if (!message) throw new TypeError("Invalid board message");
	store(message);
	// Legacy bridge (see syncLegacy).
	if (existsSync(legacyLogPath())) appendFileSync(legacyLogPath(), JSON.stringify(message) + "\n");
	return message;
}

/** Log a read or acknowledgment with the reader's identity. */
export function noteRead(event: Omit<ReadEvent, "ts">): ReadEvent {
	const entry: ReadEvent = { ts: stamp().ts, ...event };
	mkdirSync(boardDir(), { recursive: true });
	appendFileSync(readsPath(), JSON.stringify(entry) + "\n");
	return entry;
}

export function readReadEvents(): ReadEvent[] {
	const path = readsPath();
	if (!existsSync(path)) return [];
	const events: ReadEvent[] = [];
	for (const line of readFileSync(path, "utf8").split("\n")) {
		if (!line) continue;
		try {
			events.push(JSON.parse(line));
		} catch {
			// Skip a torn line rather than poisoning the audit.
		}
	}
	return events;
}

/** SQL narrowing for a topic glob: the literal prefix before its first wildcard segment. */
function topicWhere(pattern: string | undefined): { where?: string; params?: (string | number)[] } {
	if (!pattern || pattern === "**") return {};
	const segments = pattern.split("/");
	const wild = segments.findIndex((s) => s === "*" || s === "**");
	const sub = "r.seq IN (SELECT record FROM tags WHERE key = 'topic' AND ";
	if (wild < 0) return { where: sub + "value = ?)", params: [pattern] };
	if (wild === 0) return {};
	// `a/**` also matches `a` itself; `a/` ≤ value < `a0` is an index range for the `a/` prefix.
	const prefix = segments.slice(0, wild).join("/");
	return { where: sub + "(value = ? OR (value >= ? AND value < ?)))", params: [prefix, prefix + "/", prefix + "0"] };
}

function messages(options: { after?: number; topic?: string } = {}): Numbered[] {
	syncLegacy();
	return select(SCHEMA, { after: options.after, ...topicWhere(options.topic) }).map(fromRecord);
}

/** Messages stored after cursor `offset` (a records seq; 0 reads everything) and the new cursor. */
export function readFrom(offset: number): { messages: Message[]; offset: number } {
	syncLegacy();
	const end = lastSeq();
	// A cursor past the end predates the store (a JSONL byte offset): resume at the tail.
	if (offset >= end) return { messages: [], offset: end };
	const found = messages({ after: offset });
	return { messages: found.map(({ line: _, ...m }) => m), offset: Math.max(end, found.at(-1)?.line ?? 0) };
}

export function readAll(): Numbered[] {
	return messages();
}

/** The current cursor: pass it to readFrom / waitFor to see only later messages. */
export function logSize(): number {
	return lastSeq();
}

export interface ReadOptions extends Query {
	/** Newest kept. Default 20. */
	limit?: number;
}

/** Filter the store; `omitted` is how many older matches the limit dropped; `total` is the match count before limit. */
export function read(options: ReadOptions): { messages: Numbered[]; omitted: number; total: number } {
	const match = compileQuery(options);
	const limit = options.limit ?? 20;
	if (limit !== Infinity && (!Number.isInteger(limit) || limit < 0)) throw new Error("limit must be a nonnegative integer or Infinity");
	const found = messages({ topic: options.topic }).filter((m) => match(m.topic, m.tags));
	const total = found.length;
	const kept = limit === Infinity || limit >= total ? found : found.slice(total - limit);
	return { messages: kept, omitted: total - kept.length, total };
}

export interface TopicSummary {
	topic: string;
	count: number;
	lastTs: string;
	lastTags: string[];
	lastFrom?: string;
}

export function topics(pattern?: string): TopicSummary[] {
	const match = compileQuery({ topic: pattern });
	const summary = new Map<string, TopicSummary>();
	for (const m of messages({ topic: pattern })) {
		if (!match(m.topic, m.tags)) continue;
		const entry = summary.get(m.topic);
		if (entry) {
			entry.count++;
			entry.lastTs = m.ts;
			entry.lastTags = m.tags;
			entry.lastFrom = m.from.name;
		} else {
			summary.set(m.topic, { topic: m.topic, count: 1, lastTs: m.ts, lastTags: m.tags, lastFrom: m.from.name });
		}
	}
	return [...summary.values()].sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
}

/** Block until a matching message is stored after cursor `fromOffset`. Default is logSize() at call time, so snapshot before spawn and pass that cursor or mid-spawn reports are missed. */
export async function waitFor(query: Query, options: { timeoutMs?: number; fromOffset?: number; signal?: AbortSignal } = {}): Promise<Message | undefined> {
	const match = compileQuery(query);
	let offset = options.fromOffset ?? logSize();
	let seen: string | undefined;
	const deadline = options.timeoutMs === undefined ? Infinity : Date.now() + options.timeoutMs;
	while (Date.now() < deadline && !options.signal?.aborted) {
		const now = version();
		if (now !== seen) {
			seen = now;
			const result = readFrom(offset);
			offset = result.offset;
			const hit = result.messages.find((m) => match(m.topic, m.tags));
			if (hit) return hit;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return undefined;
}

