import { test, expect, jest } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supervising, cacheIdleSeconds } from "./hibernate.ts";
import { parseBlock } from "./core.ts";

test("finds running supervise jobs with live children owned by this session", () => {
	const root = mkdtempSync(join(tmpdir(), "hibernate-"));
	const job = (name: string, r: any) => { const f = join(root, `supervise-${name}.json`); writeFileSync(f, JSON.stringify({ id: name, type: "supervise", ...r })); return f; };
	const files = [
		job("a", { status: "running", input: { ticket: "a", ownerSession: "me" }, state: { children: { x: {}, y: {} } } }),
		job("b", { status: "running", input: { ticket: "b", ownerSession: "me" }, state: { children: {} } }),
		job("c", { status: "completed", input: { ticket: "c", ownerSession: "me" }, state: { children: { z: {} } } }),
		job("d", { status: "running", input: { ticket: "d", ownerSession: "other" }, state: { children: { z: {} } } }),
		join(root, "supervise-missing.json"),
	];
	writeFileSync(join(root, "jobs.json"), JSON.stringify(files));
	expect(supervising("me", root)).toEqual([{ id: "a", ticket: "a", live: ["x", "y"] }]);
	expect(supervising("me", join(root, "nothing"))).toEqual([]);
});

test("supervisor cache lifetimes", () => {
	expect(cacheIdleSeconds("anthropic")).toBe(300);
	expect(cacheIdleSeconds("amazon-bedrock")).toBe(300);
	for (const provider of ["openai", "openai-codex", "zai", "xai", "unknown"])
		expect(cacheIdleSeconds(provider)).toBe(3600);
});

test("external artifact citations are accepted but are neither evidence nor corrections", () => {
	const b = parseBlock("Child x is looping on flaky tests [@e1]; see [@issue:x] and [@commit:abc123].", new Set(["e1"]), [], false, ["e1"]);
	expect(b.sources).toEqual(["e1"]);
	expect(b.supersedes).toEqual([]);
	expect(() => parseBlock("Only [@issue:x].", new Set(["e1"]), [], false, [])).toThrow();
});

test("supervisor waits for cache expiry, resets on activity, and cancels on shutdown", async () => {
	jest.useFakeTimers();
	const oldState = process.env.AB_STATE;
	try {
	const root = mkdtempSync(join(tmpdir(), "hibernate-"));
	const f = join(root, "supervise-a.json");
	writeFileSync(f, JSON.stringify({ id: "a", type: "supervise", status: "running", input: { ticket: "t", ownerSession: "s" }, state: { children: { x: {} } } }));
	writeFileSync(join(root, "jobs.json"), JSON.stringify([f]));
	process.env.AB_STATE = root;
	const { default: memoryExtension } = await import("./index.ts");
	const hooks = new Map<string, any>();
	memoryExtension({ on: (n: string, fn: any) => hooks.set(n, fn), registerCommand() {}, registerTool() {} } as any);
	const long = "word ".repeat(8000);
	let branch: any[] = [
		{ type: "message", id: "e0", parentId: null, timestamp: new Date().toISOString(), message: { role: "user", content: long, timestamp: 1 } },
		{ type: "message", id: "e1", parentId: "e0", timestamp: new Date().toISOString(), message: { role: "user", content: "waiting", timestamp: 2 } },
	];
	const calls: any[] = [];
	const ctx: any = { cwd: root, model: { provider: "anthropic", id: "m" }, isIdle: () => true, hasPendingMessages: () => false, ui: { notify() {} },
		sessionManager: { getSessionId: () => "s", getBranch: () => branch }, compact: (o: any) => calls.push(o) };
	hooks.get("agent_settled")({}, ctx);
	expect(calls).toHaveLength(0);
	jest.advanceTimersByTime(299_999);
	expect(calls).toHaveLength(0);
	hooks.get("agent_start")({}, ctx);
	jest.advanceTimersByTime(1);
	expect(calls).toHaveLength(0);
	hooks.get("agent_settled")({}, ctx);
	jest.advanceTimersByTime(300_000);
	expect(calls).toHaveLength(1);
	expect(calls[0].customInstructions).toContain("t: x");
	jest.advanceTimersByTime(300_000);
	expect(calls).toHaveLength(1);
	ctx.model.provider = "zai";
	hooks.get("agent_settled")({}, ctx);
	jest.advanceTimersByTime(3_599_999);
	expect(calls).toHaveLength(1);
	jest.advanceTimersByTime(1);
	expect(calls).toHaveLength(2);
	hooks.get("agent_settled")({}, ctx);
	hooks.get("session_shutdown")({}, ctx);
	jest.advanceTimersByTime(3_600_000);
	expect(calls).toHaveLength(2);
	} finally {
		jest.useRealTimers();
		if (oldState === undefined) delete process.env.AB_STATE;
		else process.env.AB_STATE = oldState;
	}
});
