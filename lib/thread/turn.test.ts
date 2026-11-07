import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fakeBb } from "./fake-bb";
import { readTurn } from "./turn";
import { bbSessionFile } from "./bb";

// bb refuses an event response over 8 MiB (HTTP 413); the fake scales the limit down to a few KiB.
let root = "", saved: NodeJS.ProcessEnv = {}, bb: ReturnType<typeof fakeBb>;
const env = "/worker";
beforeEach(() => {
	saved = { ...process.env };
	root = mkdtempSync(join(tmpdir(), "turn-log-"));
	bb = fakeBb(root);
	bb.addThread("thr_w", env, "run/w");
});
afterEach(() => { process.env = saved; rmSync(root, { recursive: true, force: true }); });
const logReads = () => bb.calls().filter(c => c[1] === "log");

test("a turn whose whole log is over bb's limit is read in pages", async () => {
	bb.padLog(env, Array(300).fill(100));
	bb.completeTurn(env, "done\n\nAll of it.");
	bb.limitLog(env, 8_000);
	const read = await readTurn("thr_w");
	expect(read.report).toMatchObject({ tags: ["done"], body: "done\n\nAll of it." });
	expect(read.seq).toBe(read.report!.seq);
	expect(logReads().some(c => c.includes("--all"))).toBe(false);
});

test("an event too large to return alone is skipped with a note, and the turn after it still arrives", async () => {
	bb.padLog(env, [100, 20_000, 100, 20_000, 20_000]);
	bb.completeTurn(env, "done");
	bb.limitLog(env, 8_000);
	const skipped: number[] = [];
	const read = await readTurn("thr_w", 0, { onSkip: after => skipped.push(after) });
	expect(read.report?.tags).toEqual(["done"]);
	expect(skipped).toEqual([2, 6]);
});

test("a poll reads only the events after the last one seen", async () => {
	bb.padLog(env, Array(50).fill(10));
	const first = await readTurn("thr_w");
	expect(first.report).toBeUndefined();
	expect(first.seq).toBe(100);
	bb.completeTurn(env, "waiting");
	const calls = logReads().length;
	const second = await readTurn("thr_w", first.seq);
	expect(second.report?.tags).toEqual(["waiting"]);
	expect(logReads().slice(calls).every(c => c[c.indexOf("--after-seq") + 1] === "100")).toBe(true);
	expect((await readTurn("thr_w", second.seq)).report).toBeUndefined();
});

test("a failed turn's provider error read before its completion is read again with it", async () => {
	bb.completeTurn(env, "quota exhausted", "failed");
	// What a poll between the two events saw: the error, no completion yet.
	const { readFileSync, writeFileSync } = await import("node:fs");
	const file = join(root, "fake-bb", "thread-thr_w.json"), t = JSON.parse(readFileSync(file, "utf8"));
	writeFileSync(file, JSON.stringify({ ...t, events: t.events.slice(0, 1) }));
	const early = await readTurn("thr_w", 0);
	expect(early).toEqual({ seq: 0 });
	writeFileSync(file, JSON.stringify(t));
	expect((await readTurn("thr_w", early.seq)).report).toMatchObject({ tags: ["turn-end", "error"], body: "error: quota exhausted" });
});

test("a log that fails for another reason fails the read", async () => {
	bb.failLog(env, "bb daemon unavailable");
	await expect(readTurn("thr_w")).rejects.toThrow("bb daemon unavailable");
});

test("the pi session file comes from a paged log", async () => {
	process.env.BB_PI_BRIDGE_SESSION_DIR = join(root, "sessions");
	bb.padLog(env, Array(150).fill(100));
	const { writeFileSync, readFileSync } = await import("node:fs");
	const file = join(root, "fake-bb", "thread-thr_w.json"), t = JSON.parse(readFileSync(file, "utf8"));
	t.events.push({ seq: 1000, type: "thread/identity", createdAt: Date.now(), data: { providerThreadId: "prov-1" } });
	writeFileSync(file, JSON.stringify(t));
	bb.limitLog(env, 8_000);
	expect(await bbSessionFile("thr_w")).toBe(join(root, "sessions", "prov-1.jsonl"));
});
