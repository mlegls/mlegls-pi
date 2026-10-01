import { afterEach, beforeEach, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logSize, meta, noteRead, read, readFrom, readReadEvents, readsPath, send, topics, waitFor } from "./store";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "pi-board-"));
	process.env.PI_BOARD_DIR = dir;
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env.PI_BOARD_DIR;
});

const from = { session: "s1", name: "t" };

test("send then read round-trips with query", () => {
	const a = send({ topic: "c/u1", tags: ["progress"], body: "half", from });
	const b = send({ topic: "c/u1", tags: ["done"], body: "ok", data: { verdict: "ok" }, from });
	send({ topic: "r/x", tags: ["done"], body: "other", from });

	expect(read({}).messages.map((m) => m.id)).toEqual([a.id, b.id, expect.any(String)]);
	expect(read({}).messages.map((m) => m.line)).toEqual([1, 2, 3]);
	expect(read({ topic: "c/*", tags: "done" }).messages).toEqual([{ ...b, line: 2 }]);
	expect(read({ topic: "c/*", tags: ["done"] }).messages).toEqual([{ ...b, line: 2 }]);
	expect(read({ limit: 1 }).messages[0]!.topic).toBe("r/x");
});

// run-glob-misses-base-topic-decisions: the run-wide pattern taught to workers (`<run>/**`) must reach decisions posted on the bare run topic.
test("run-wide read includes base-topic decisions; <run>/* does not", () => {
	send({ topic: "run", tags: ["decision"], body: "base", from });
	send({ topic: "run/peer", tags: ["decision"], body: "peer", from });
	send({ topic: "run/sub/peer", tags: ["decision"], body: "nested", from });
	send({ topic: "other/peer", tags: ["decision"], body: "outside", from });
	const bodies = (topic: string) => read({ topic }).messages.map((m) => m.body);
	expect(bodies("run/**")).toEqual(["base", "peer", "nested"]);
	expect(bodies("run/*")).toEqual(["peer"]);
});

test("readFrom is incremental by cursor", () => {
	send({ topic: "t", tags: [], body: "1", from });
	const first = readFrom(0);
	expect(first.messages).toHaveLength(1);
	expect(first.offset).toBe(logSize());
	expect(readFrom(first.offset).messages).toHaveLength(0);
	send({ topic: "t", tags: [], body: "2", from });
	expect(readFrom(first.offset).messages.map((m) => m.body)).toEqual(["2"]);
});

// Replays the drive packet's omitted-sender reader check (docs/attachments/root-board-store-fixture-typecheck/index.md)
// against the one-time import of the pre-store JSONL log.
test("legacy log import normalizes missing sender metadata and skips malformed records", () => {
	const first = { id: "first", ts: "2026-01-01T00:00:00.000Z", topic: "t", tags: ["k:v", "bare"], from, body: "first", data: { n: 1, list: ["a"], nested: { x: [1, { y: null }] }, empty: [] } };
	const { from: _, ...anonymous } = { ...first, id: "anonymous", body: "匿名", data: "plain" };
	const invalid = [null, [], 42, {}, { ...first, tags: [1] }, { ...first, body: null },
		{ ...first, from: "script" }, { ...first, from: { session: 1 } }, { ...first, body: "duplicate id" }];
	writeFileSync(join(dir, "log.jsonl"), [JSON.stringify(first), "{torn", ...invalid.map((m) => JSON.stringify(m)), JSON.stringify(anonymous)].join("\n") + "\n");
	const result = readFrom(0);
	expect(result.messages).toEqual([first, { ...anonymous, from: {} }]);
	expect(result.offset).toBe(logSize());
	expect(readFrom(result.offset).messages).toEqual([]);
	expect(topics()[0]!.count).toBe(2);
	const last = send({ topic: "t", tags: [], body: "last", from });
	expect(readFrom(result.offset).messages).toEqual([last]);
});

test("lines old sessions append to the legacy log are imported once; sends mirror there", () => {
	writeFileSync(join(dir, "log.jsonl"), "");
	const mine = send({ topic: "t", tags: [], body: "new", from });
	const old = { id: "old", ts: "2026-01-01T00:00:00.000Z", topic: "t", tags: ["done"], from, body: "old" };
	appendFileSync(join(dir, "log.jsonl"), JSON.stringify(old) + "\n");
	expect(readFrom(0).messages).toEqual([mine, old]);
	expect(readFrom(0).messages).toHaveLength(2);
	expect(readFileSync(join(dir, "log.jsonl"), "utf8")).toContain('"id":"' + mine.id + '"');
});

test("a cursor from before the store resumes at the tail", () => {
	send({ topic: "t", tags: [], body: "1", from });
	expect(readFrom(10_000_000)).toEqual({ messages: [], offset: logSize() });
});

// Replays the same packet's script-send check, including normalized readback.
test("send normalizes omitted sender metadata from scripts and rejects malformed input", () => {
	const input = { topic: "t", tags: [], body: "anonymous" };
	const message = send(input as unknown as Parameters<typeof send>[0]);
	expect(message.from).toEqual({});
	expect(() => send({ ...input, tags: [1] } as unknown as Parameters<typeof send>[0])).toThrow("Invalid board message");
	expect(readFrom(0).messages).toEqual([{ ...message, ...input, from: {} }]);
});

test("topics summarises latest per topic", () => {
	send({ topic: "a", tags: ["x"], body: "", from });
	send({ topic: "b", tags: ["y"], body: "", from });
	send({ topic: "a", tags: ["z"], body: "", from });
	const summary = topics();
	expect(summary.map((t) => t.topic)).toEqual(["a", "b"]);
	expect(summary[0]).toMatchObject({ count: 2, lastTags: ["z"], lastFrom: "t" });
});

test("waitFor resolves on a matching message and times out otherwise", async () => {
	const pending = waitFor({ topic: "w", tags: "done" }, { timeoutMs: 3000 });
	send({ topic: "w", tags: ["progress"], body: "", from });
	send({ topic: "w", tags: ["done"], body: "fin", from });
	expect((await pending)?.body).toBe("fin");
	expect(await waitFor({ topic: "never" }, { timeoutMs: 600 })).toBeUndefined();
});

test("waitFor fromOffset sees messages already logged", async () => {
	const fromOffset = logSize();
	send({ topic: "w", tags: ["done"], body: "early", from });
	expect((await waitFor({ topic: "w", tags: "done" }, { fromOffset, timeoutMs: 1000 }))?.body).toBe("early");
});

test("meta drops data and slices body", () => {
	send({ topic: "t", tags: ["x"], body: "abcdef", data: { n: 1 }, from });
	const m = read({ topic: "t", limit: 1 }).messages[0]!;
	expect(meta(m, 4)).toEqual({ id: m.id, line: m.line, ts: m.ts, topic: m.topic, tags: m.tags, from: m.from, body: "abcd", bodyTruncated: true });
	expect(meta(m, 0)).toEqual({ id: m.id, line: m.line, ts: m.ts, topic: m.topic, tags: m.tags, from: m.from });
	expect(meta(m, 6).bodyTruncated).toBeUndefined();
	expect(() => meta(m, NaN)).toThrow();
	expect(() => meta(m, 1.5)).toThrow();
});



test("query reports what the limit dropped", () => {
	for (let i = 0; i < 5; i++) send({ topic: "t", tags: [], body: String(i), from });
	const { messages, omitted, total } = read({ limit: 2 });
	expect(messages.map((m) => m.body)).toEqual(["3", "4"]);
	expect(omitted).toBe(3);
	expect(total).toBe(5);
	expect(read({ limit: Infinity }).omitted).toBe(0);
	expect(read({ limit: 0 })).toEqual({ messages: [], omitted: 5, total: 5 });
});


test("reads and acks log beside the message log with the reader", () => {
	const a = send({ topic: "t", tags: ["done"], body: "x", from });
	const b = send({ topic: "t", tags: ["done"], body: "y", from });
	noteRead({ action: "read", reader: { session: "s1", name: "reader" }, topic: "t", tags: "done", count: 2 });
	noteRead({ action: "ack", reader: { session: "s1", name: "reader" }, ids: [a.id, b.id] });
	const events = readReadEvents();
	expect(events.map((e) => e.action)).toEqual(["read", "ack"]);
	expect(events[0]).toMatchObject({ reader: { session: "s1", name: "reader" }, topic: "t", tags: "done", count: 2 });
	expect(events[1]!.ids).toEqual([a.id, b.id]);
	expect(events.every((e) => Number.isFinite(Date.parse(e.ts)))).toBe(true);
	expect(read({}).messages.map((m) => m.id)).toEqual([a.id, b.id]);
});

test("readReadEvents tolerates an absent file and torn lines", () => {
	expect(readReadEvents()).toEqual([]);
	noteRead({ action: "read", reader: {}, count: 1 });
	appendFileSync(readsPath(), "{torn\n");
	expect(readReadEvents()).toHaveLength(1);
});