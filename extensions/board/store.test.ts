import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logSize, query, read, readFrom, send, topics, waitFor } from "./store";

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

test("send then read round-trips with query and since", () => {
	const a = send({ topic: "c/u1", tags: ["progress"], body: "half", from });
	const b = send({ topic: "c/u1", tags: ["done"], body: "ok", data: { verdict: "ok" }, from });
	send({ topic: "r/x", tags: ["done"], body: "other", from });

	expect(read({}).map((m) => m.id)).toEqual([a.id, b.id, expect.any(String)]);
	expect(read({}).map((m) => m.line)).toEqual([1, 2, 3]);
	expect(read({ topic: "c/*", tags: "done" })).toEqual([{ ...b, line: 2 }]);
	expect(read({ topic: "c/*", since: a.id })).toEqual([{ ...b, line: 2 }]);
	expect(read({ since: b.ts })).toHaveLength(1);
	expect(read({ limit: 1 })[0]!.topic).toBe("r/x");
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

test("grep is smart-case over body and topic", () => {
	send({ topic: "a", tags: [], body: "Deploy failed", from });
	send({ topic: "b/deploy", tags: [], body: "fine", from });
	send({ topic: "c", tags: [], body: "unrelated", from });
	expect(read({ grep: "deploy" }).map((m) => m.topic)).toEqual(["a", "b/deploy"]);
	expect(read({ grep: "Deploy" }).map((m) => m.topic)).toEqual(["a"]);
	expect(read({ grep: "fail|fine" })).toHaveLength(2);
});

test("range addresses log line numbers and lifts the default limit", () => {
	for (let i = 1; i <= 30; i++) send({ topic: i % 2 ? "odd" : "even", tags: [], body: String(i), from });
	const lines = (o: Parameters<typeof read>[0]) => read(o).map((m) => m.line);
	expect(lines({ range: "3-5" })).toEqual([3, 4, 5]);
	expect(lines({ range: "28-" })).toEqual([28, 29, 30]);
	expect(lines({ range: "10+2" })).toEqual([10, 11, 12]);
	expect(lines({ range: "-3" })).toEqual([28, 29, 30]);
	expect(lines({ range: "1-" })).toHaveLength(30);
	expect(lines({ range: "1-10", topic: "odd" })).toEqual([1, 3, 5, 7, 9]);
	expect(lines({ range: "1-", limit: 2 })).toEqual([29, 30]);
	expect(() => read({ range: "x" })).toThrow(/bad range/);
});

test("query reports what the limit dropped", () => {
	for (let i = 0; i < 5; i++) send({ topic: "t", tags: [], body: String(i), from });
	const { messages, omitted } = query({ limit: 2 });
	expect(messages.map((m) => m.body)).toEqual(["3", "4"]);
	expect(omitted).toBe(3);
	expect(query({ range: "1-" }).omitted).toBe(0);
});
