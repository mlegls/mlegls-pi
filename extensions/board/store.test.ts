import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logSize, meta, read, readFrom, send, topics, waitFor } from "./store";

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

test("readFrom is incremental by byte offset", () => {
	send({ topic: "t", tags: [], body: "1", from });
	const first = readFrom(0);
	expect(first.messages).toHaveLength(1);
	expect(first.offset).toBe(logSize());
	expect(readFrom(first.offset).messages).toHaveLength(0);
	send({ topic: "t", tags: [], body: "2", from });
	expect(readFrom(first.offset).messages.map((m) => m.body)).toEqual(["2"]);
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
	expect(meta(m, 4)).toEqual({ id: m.id, line: m.line, ts: m.ts, topic: m.topic, tags: m.tags, from: m.from, body: "abcd" });
	expect(meta(m, 0)).toEqual({ id: m.id, line: m.line, ts: m.ts, topic: m.topic, tags: m.tags, from: m.from });
});



test("query reports what the limit dropped", () => {
	for (let i = 0; i < 5; i++) send({ topic: "t", tags: [], body: String(i), from });
	const { messages, omitted, total } = read({ limit: 2 });
	expect(messages.map((m) => m.body)).toEqual(["3", "4"]);
	expect(omitted).toBe(3);
	expect(total).toBe(5);
	expect(read({ limit: Infinity }).omitted).toBe(0);
});

