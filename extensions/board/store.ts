// Append-only JSONL message log shared by every pi session (and any script)
// on this machine. Importable from plain bun scripts without the extension.

import { appendFileSync, existsSync, mkdirSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { compileQuery, type Query } from "./query";

export interface Message {
	id: string;
	ts: string;
	topic: string;
	tags: string[];
	from: { session?: string; name?: string; cwd?: string };
	body: string;
	data?: unknown;
}

/** A message with its 1-indexed position in the log; stable across reads, so it addresses `range`. */
export type Numbered = Message & { line: number };

export function boardDir(): string {
	return process.env.PI_BOARD_DIR
		?? join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "pi-board");
}

export function logPath(): string {
	return join(boardDir(), "log.jsonl");
}

let lastMs = 0;
function stamp(): { id: string; ts: string } {
	// Monotonic within a process so `since: ts` is a strict order; across processes
	// readers order by file position and ids are disambiguated by the random suffix.
	let ms = Date.now();
	if (ms <= lastMs) ms = lastMs + 1;
	lastMs = ms;
	return { id: `${ms.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, ts: new Date(ms).toISOString() };
}

export function send(input: Omit<Message, "id" | "ts">): Message {
	const message: Message = { ...stamp(), ...input };
	mkdirSync(boardDir(), { recursive: true });
	appendFileSync(logPath(), JSON.stringify(message) + "\n");
	return message;
}

/** Read raw bytes appended since `offset`. Returns complete lines only. */
export function readFrom(offset: number): { messages: Message[]; offset: number } {
	const path = logPath();
	if (!existsSync(path)) return { messages: [], offset: 0 };
	const size = statSync(path).size;
	if (size < offset) offset = 0; // log was truncated/rotated
	if (size === offset) return { messages: [], offset };
	const fd = openSync(path, "r");
	try {
		const buffer = Buffer.alloc(size - offset);
		readSync(fd, buffer, 0, buffer.length, offset);
		const text = buffer.toString("utf8");
		const end = text.lastIndexOf("\n");
		if (end < 0) return { messages: [], offset };
		const messages: Message[] = [];
		for (const line of text.slice(0, end).split("\n")) {
			if (!line) continue;
			try {
				messages.push(JSON.parse(line));
			} catch {
				// Skip a torn or foreign line rather than poisoning every reader.
			}
		}
		return { messages, offset: offset + Buffer.byteLength(text.slice(0, end + 1)) };
	} finally {
		closeSync(fd);
	}
}

export function readAll(): Numbered[] {
	return readFrom(0).messages.map((m, i) => ({ ...m, line: i + 1 }));
}

export function logSize(): number {
	const path = logPath();
	return existsSync(path) ? statSync(path).size : 0;
}

export interface ReadOptions extends Query {
	/** Message id or ISO timestamp; only messages after it. */
	since?: string;
	/** Regex over body and topic. Smart case: case-insensitive unless the pattern has an uppercase letter. */
	grep?: string;
	/** Line numbers, ids, or ISO timestamps: `50-200`, `50-`, `50+30`, `-20` (last 20), `m2k3x-ab12cd+5`, `2026-09-14T10:00:00Z-`. No default limit when set. */
	range?: string;
	limit?: number;
}

// A range endpoint is a log line number, a message id, or an ISO timestamp (UTC / `Z` only;
// a `+hh:mm` offset would collide with the `+k` form).
const ENDPOINT = String.raw`\d{4}-\d\d-\d\d(?:T[\d:.]*Z?)?|[0-9a-z]+-[0-9a-z]{6}|\d+`;
const RANGE = new RegExp(String.raw`^(${ENDPOINT})(?:([-+])(${ENDPOINT})?)?$|^-(\d+)$`);

/** Resolve an endpoint to a line. A timestamp snaps inward: to the first line at/after it (`lo`) or the last at/before it (`hi`). */
function resolveEndpoint(e: string, side: "lo" | "hi", all: Numbered[]): number {
	if (/^\d+$/.test(e)) return Number(e);
	if (/^\d{4}-/.test(e)) {
		if (side === "lo") return all.find((m) => m.ts >= e)?.line ?? all.length + 1;
		return all.findLast((m) => m.ts <= e)?.line ?? 0;
	}
	const hit = all.find((m) => m.id === e);
	if (!hit) throw new Error(`no message with id ${e}`);
	return hit.line;
}

export function parseRange(spec: string, all: Numbered[]): [number, number] {
	const m = RANGE.exec(spec.trim());
	if (!m) throw new Error(`bad range: ${spec} (expected a-b, a+k, a-, or -k; endpoints are line numbers, ids, or ISO timestamps)`);
	if (m[4]) return [Math.max(1, all.length - Number(m[4]) + 1), all.length];
	const lo = resolveEndpoint(m[1]!, "lo", all);
	if (m[2] === "+") return [lo, lo + Number(m[3] || 0)];
	return [lo, m[3] ? resolveEndpoint(m[3], "hi", all) : all.length];
}

/** Filter the log; `omitted` is how many older matches the limit dropped. */
export function read(options: ReadOptions): { messages: Numbered[]; omitted: number } {
	const match = compileQuery(options);
	const all = readAll();
	let messages = all.filter((m) => match(m.topic, m.tags));
	if (options.since) {
		const byId = messages.findIndex((m) => m.id === options.since);
		if (byId >= 0) messages = messages.slice(byId + 1);
		else messages = messages.filter((m) => m.ts > options.since!);
	}
	if (options.grep) {
		const re = new RegExp(options.grep, /[A-Z]/.test(options.grep) ? "" : "i");
		messages = messages.filter((m) => re.test(m.body) || re.test(m.topic));
	}
	if (options.range) {
		const [lo, hi] = parseRange(options.range, all);
		messages = messages.filter((m) => m.line >= lo && m.line <= hi);
	}
	const limit = options.limit ?? (options.range ? Infinity : 20);
	const omitted = Math.max(0, messages.length - limit);
	return { messages: omitted ? messages.slice(-limit) : messages, omitted };
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
	for (const m of readAll()) {
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

/** Block until a message matching `query` arrives (for scripts; the extension uses its own watcher). */
export async function waitFor(query: Query, options: { timeoutMs?: number; fromOffset?: number; signal?: AbortSignal } = {}): Promise<Message | undefined> {
	const match = compileQuery(query);
	let offset = options.fromOffset ?? logSize();
	const deadline = options.timeoutMs === undefined ? Infinity : Date.now() + options.timeoutMs;
	while (Date.now() < deadline && !options.signal?.aborted) {
		const result = readFrom(offset);
		offset = result.offset;
		const hit = result.messages.find((m) => match(m.topic, m.tags));
		if (hit) return hit;
		await new Promise((r) => setTimeout(r, 500));
	}
	return undefined;
}
