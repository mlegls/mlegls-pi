import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supervising, worthFolding } from "./hibernate.ts";
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

test("folds only when the wait outlasts the cache and there is enough to fold", () => {
	expect(worthFolding({ expectedIdleSeconds: 1800, cacheSeconds: 330, foldableTokens: 5000, minTokens: 4000 })).toBe(true);
	expect(worthFolding({ expectedIdleSeconds: 1800, cacheSeconds: 86400, foldableTokens: 5000, minTokens: 4000 })).toBe(false);
	expect(worthFolding({ expectedIdleSeconds: 1800, cacheSeconds: 330, foldableTokens: 100, minTokens: 4000 })).toBe(false);
});

test("external artifact citations are accepted but are neither evidence nor corrections", () => {
	const b = parseBlock("Child x is looping on flaky tests [@e1]; see [@issue:x] and [@commit:abc123].", new Set(["e1"]), [], false, ["e1"]);
	expect(b.sources).toEqual(["e1"]);
	expect(b.supersedes).toEqual([]);
	expect(() => parseBlock("Only [@issue:x].", new Set(["e1"]), [], false, [])).toThrow();
});

test("agent_settled folds a supervisor once, then not again right after", async () => {
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
	const ctx: any = { cwd: root, model: { provider: "anthropic", id: "m" }, hasPendingMessages: () => false, ui: { notify() {} },
		sessionManager: { getSessionId: () => "s", getBranch: () => branch }, compact: (o: any) => calls.push(o) };
	hooks.get("agent_settled")({}, ctx);
	expect(calls).toHaveLength(1);
	expect(calls[0].customInstructions).toContain("t: x");
	branch = [...branch, { type: "compaction", id: "c", parentId: "e1", timestamp: new Date().toISOString(), summary: "memory ".repeat(6000), firstKeptEntryId: "e1", tokensBefore: 9000 }];
	hooks.get("agent_settled")({}, ctx);
	expect(calls).toHaveLength(1);
	ctx.model.provider = "zai";
	branch = branch.slice(0, 2);
	hooks.get("agent_settled")({}, ctx);
	expect(calls).toHaveLength(1);
});
