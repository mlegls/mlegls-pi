import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSessionContext, convertToLlm } from "@earendil-works/pi-coding-agent";
import memoryExtension from "./index.ts";
import { KIND, expandMemory, parseBlock, renderBlock } from "./core.ts";

const usage = { input: 100, output: 10, cacheRead: 50, cacheWrite: 0, totalTokens: 160, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const assistant = (text: string) => ({ role: "assistant", content: [{ type: "text", text }], api: "openai-responses", provider: "test", model: "model", usage, stopReason: "stop", timestamp: 1 });

test("append, resume, cache-prefix reuse, original recall and failed checkpoint", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "memory-test-"));
	try {
		mkdirSync(join(cwd, ".pi"));
		writeFileSync(join(cwd, ".pi/settings.json"), JSON.stringify({ memory: { keepRecentTokens: 1 } }));
		const branch: any[] = [];
		const add = (type: string, fields: any) => {
			const e = { type, id: `e${branch.length}`, parentId: branch.at(-1)?.id ?? null, timestamp: new Date().toISOString(), ...fields };
			branch.push(e); return e;
		};
		add("message", { message: { role: "user", content: "Use port 4567, not 3000.", timestamp: 1 } });
		add("message", { message: assistant("I will use 4567; not verified yet.") });
		add("message", { message: { role: "user", content: "yes", timestamp: 2 } });
		const hooks = new Map<string, any>(), registered = new Map<string, any>();
		const pi: any = {
			on: (name: string, fn: any) => hooks.set(name, fn), registerCommand() {},
			registerTool: (tool: any) => registered.set(tool.name, tool),
			getActiveTools: () => [...registered.keys()], getAllTools: () => [...registered.values()], getThinkingLevel: () => "off",
		};
		let sent: any; let invalid = false; let notices: string[] = [];
		const ctx: any = {
			cwd, model: { id: "model", provider: "test", maxTokens: 16000 }, getSystemPrompt: () => "Unchanged system prompt",
			ui: { notify: (s: string) => notices.push(s) },
			sessionManager: { getSessionId: () => "session", getLeafId: () => branch.at(-1)?.id, getBranch: () => branch },
			modelRegistry: { streamSimple(_model: any, context: any) {
				sent = context;
				const prompt = context.messages.at(-1).content as string;
				const id = prompt.split("Covered source entries (IDs, dates and identification hints; full content is above):\n")[1].split(" ")[0];
				return { result: async () => assistant(JSON.stringify({ observations: [{ text: "Port 4567, not verified.", sources: [invalid ? "missing" : id] }], reflections: [] })) };
			} },
		};
		memoryExtension(pi);
		const firstContext = convertToLlm(buildSessionContext(branch).messages);
		hooks.get("context")({ messages: buildSessionContext(branch).messages }, ctx);
		add("message", { message: assistant("Ready.") });
		const fold = () => hooks.get("session_before_compact")({ branchEntries: branch, preparation: { tokensBefore: 1234 }, signal: new AbortController().signal }, ctx);
		const one = await fold();
		expect(one.cancel).toBeUndefined();
		expect(sent.messages.slice(0, firstContext.length)).toEqual(firstContext);
		expect(sent.systemPrompt).toBe("Unchanged system prompt");
		expect(one.compaction.details.prefixMode).toBe("captured");
		expect(one.compaction.usage).toEqual(usage);
		add("compaction", one.compaction);
		const firstBlock = one.compaction.details.blocks[0];
		const resumed = expandMemory(buildSessionContext(branch).messages, branch);
		expect(resumed[0].content).toBe(renderBlock(firstBlock));
		add("message", { message: { role: "user", content: "New topic", timestamp: 3 } });
		hooks.get("context")({ messages: buildSessionContext(branch).messages }, ctx);
		add("message", { message: assistant("Next task.") });
		const two = await fold();
		expect(two.compaction.details.blocks).toHaveLength(2);
		expect(two.compaction.details.blocks[0]).toEqual(firstBlock);
		add("compaction", two.compaction);
		expect(expandMemory(buildSessionContext(branch).messages, branch)[0]).toEqual(resumed[0]);
		const recall = await registered.get("memory_recall").execute("call", { ids: ["e0", "other-branch"] }, undefined, undefined, ctx);
		expect(recall.content[0].text).toContain("Use port 4567");
		expect(recall.content[0].text).toContain("not found on this branch");
		add("message", { message: { role: "user", content: "Another topic", timestamp: 4 } });
		add("message", { message: assistant("Another answer.") });
		invalid = true;
		const before = branch.length;
		expect(await fold()).toEqual({ cancel: true });
		expect(branch).toHaveLength(before);
		expect(notices.at(-1)).toContain("invalid original-source pointers");
	} finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("rewrite retains direct evidence; unknown supersession/source references fail", () => {
	const first = parseBlock(JSON.stringify({ observations: [{ text: "Port 3000", sources: ["original"] }], reflections: [] }), new Set(["original"]), [], false, ["original"]);
	const json = JSON.stringify({ observations: [{ text: "Port 4567 instead", sources: ["original", "correction"], supersedes: [first.observations[0].id] }], reflections: [] });
	const revised = parseBlock(json, new Set(["original", "correction"]), [first], true, ["correction"]);
	expect(revised.observations[0].sources).toEqual(["original", "correction"]);
	expect(revised.observations[0].supersedes).toEqual([]);
	expect(() => parseBlock(json, new Set(["correction"]), [first], true, [])).toThrow("source pointers");
	expect(() => parseBlock(json, new Set(["original", "correction"]), [], false, [])).toThrow("superseded claim");
});
