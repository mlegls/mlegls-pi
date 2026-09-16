import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// A coordinator must receive a report posted before it awaits the worker. The
// poller owns a process-level cursor, so isolate the fixture's board as a process.
test("poller delivers a report posted after the worker is registered", async () => {
	const dir = mkdtempSync(join(tmpdir(), "wm-race-"));
	const code = [
		"import { Worker } from " + JSON.stringify(join(import.meta.dir, "wm.ts")) + ";",
		"import { send } from " + JSON.stringify(join(import.meta.dir, "../extensions/board/store.ts")) + ";",
		"const w = new Worker('race', 'b', process.cwd(), 'race', process.cwd());",
		"send({ topic: 'race/b', tags: ['done'], body: 'mid-spawn', from: {name: 'b'} });",
		"const result = await w.next(); w.drop(); console.log(JSON.stringify(result));",
	].join("\n");
	const child = Bun.spawn([process.execPath, "-e", code], {
		cwd: dir, env: { ...process.env, PI_BOARD_DIR: dir }, stdout: "pipe", stderr: "pipe",
	});
	const timeout = setTimeout(() => child.kill(), 4000);
	try {
		const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
		expect({code, err}).toEqual({code: 0, err: ""});
		expect(JSON.parse(out)).toMatchObject({kind: "done", message: {body: "mid-spawn"}});
	} finally {
		clearTimeout(timeout);
		child.kill();
		rmSync(dir, { recursive: true, force: true });
	}
}, 5000);
