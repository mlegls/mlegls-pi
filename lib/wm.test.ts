import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { send } from "../extensions/board/store";
import { Worker, wait, type Outcome } from "./wm";

const done = (body: string): Outcome => ({
	kind: "done",
	message: { id: body, ts: "", topic: "", tags: ["done"], from: { name: "", session: "", cwd: "" }, body },
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

test("poller delivers a report posted after the worker is registered", async () => {
	const dir = mkdtempSync(join(tmpdir(), "wm-race-"));
	const old = process.env.PI_BOARD_DIR;
	process.env.PI_BOARD_DIR = dir;
	const run = "race-" + process.pid + "-" + Date.now();
	const w = new Worker(run, "b", dir, run, dir);
	try {
		const pending = w.next();
		send({ topic: run + "/b", tags: ["done"], body: "mid-spawn", from: { name: "b" } });
		const o = await pending;
		expect(o.kind).toBe("done");
		if (o.kind === "done") expect(o.message.body).toBe("mid-spawn");
	} finally {
		w.emit({ kind: "exited", tail: "" });
		if (old === undefined) delete process.env.PI_BOARD_DIR;
		else process.env.PI_BOARD_DIR = old;
		rmSync(dir, { recursive: true, force: true });
	}
}, 5000);
