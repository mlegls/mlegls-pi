import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logSize, read, readFrom, send, topics, waitFor } from "./store";

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
	expect(read({ topic: "c/*", tags: "done" })).toEqual([b]);
	expect(read({ topic: "c/*", since: a.id })).toEqual([b]);
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
