import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker, spawnEnv, wait, type Outcome } from "./wm";

const done = (body: string): Outcome => ({
	kind: "done",
	message: { seq: 1, id: body, ts: "", tags: ["done"], body },
});

function pair() {
	const a = new Worker("t", "a", "/tmp", "t", "/tmp/a");
	const b = new Worker("t", "b", "/tmp", "t", "/tmp/b");
	return { a, b };
}

describe("wait", () => {
	test("any returns on the first, leaves the other pending", async () => {
		const { a, b } = pair();
		const p = wait([a, b], { mode: "any" });
		b.emit(done("b1"));
		const got = await p;
		expect([...got.keys()]).toEqual([b]);
		expect(got.get(b)!.kind).toBe("done");
	});

	test("all collects one per worker", async () => {
		const { a, b } = pair();
		const p = wait([a, b], { mode: "all" });
		a.emit(done("a1"));
		b.emit(done("b1"));
		expect((await p).size).toBe(2);
	});

	test("timeout returns what arrived", async () => {
		const { a, b } = pair();
		const p = wait([a, b], { mode: "all", timeoutMs: 20 });
		a.emit(done("a1"));
		const got = await p;
		expect(got.size).toBe(1);
		expect(got.has(a)).toBe(true);
	});

	test("a loser's waiter is withdrawn; its later event is buffered for the next wait", async () => {
		const { a, b } = pair();
		await Promise.all([wait([a, b], { mode: "any" }), Promise.resolve().then(() => b.emit(done("b1")))]);
		a.emit(done("a1")); // nobody listening now
		const got = await wait([a], { mode: "any", timeoutMs: 20 });
		expect(got.get(a)?.kind).toBe("done");
	});

	test("abort signal withdraws without consuming", async () => {
		const { a } = pair();
		const ac = new AbortController();
		const p = wait([a], { signal: ac.signal });
		ac.abort();
		expect((await p).size).toBe(0);
		a.emit(done("a1"));
		expect((await wait([a], { timeoutMs: 20 })).size).toBe(1);
	});
});

describe("spawnEnv", () => {
	test("carries identity, spawn provenance, and the fence ratio", () => {
		expect(spawnEnv({ run: "reorg/0918", handle: "a", agent: "auto", parentSession: "s1", checkpoint: "0.6" })).toEqual([
			"PI_WM_AGENT=auto",
			"PI_WM_RUN=reorg/0918",
			"PI_WM_HANDLE=a",
			"PI_WM_PARENT_SESSION=s1",
			"PI_CHECKPOINT=0.6",
		]);
	});

	test("drops absent optional values", () => {
		expect(spawnEnv({ run: "r", handle: "h" })).toEqual(["PI_WM_RUN=r", "PI_WM_HANDLE=h"]);
	});
});
