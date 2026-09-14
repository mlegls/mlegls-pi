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

export function readAll(): Message[] {
	return readFrom(0).messages;
}

export function logSize(): number {
	const path = logPath();
	return existsSync(path) ? statSync(path).size : 0;
}

export interface ReadOptions extends Query {
	/** Message id or ISO timestamp; only messages after it. */
	since?: string;
	limit?: number;
}

export function read(options: ReadOptions): Message[] {
	const match = compileQuery(options);
	let messages = readAll().filter((m) => match(m.topic, m.tags));
	if (options.since) {
		const byId = messages.findIndex((m) => m.id === options.since);
		if (byId >= 0) messages = messages.slice(byId + 1);
		else messages = messages.filter((m) => m.ts > options.since!);
	}
	const limit = options.limit ?? 20;
	return messages.length > limit ? messages.slice(-limit) : messages;
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
