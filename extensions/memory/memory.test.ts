import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSessionContext, convertToLlm } from "@earendil-works/pi-coding-agent";
import { recall } from "../../lib/memory.ts";
import memoryExtension from "./index.ts";
import { KIND, elideCold, expandMemory, parseBlock, renderBlock, sourceEntries, tailChoices, visibleEntries } from "./core.ts";

const usage = { input: 100, output: 10, cacheRead: 50, cacheWrite: 0, totalTokens: 160, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const assistant = (text: string) => ({ role: "assistant", content: [{ type: "text", text }], api: "openai-responses", provider: "test", model: "model", usage, stopReason: "stop", timestamp: 1 });

test("model-selected contiguous tail, stable append/resume and failed checkpoint", async () => {
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
		let sent: any; let blockedAll = false, blocked = false, invalid = false, invalidTail = false, citeTail = false; let notices: string[] = [];
		const ctx: any = {
			cwd, model: { id: "model", provider: "test", maxTokens: 16000 }, getSystemPrompt: () => "Unchanged system prompt",
			ui: { notify: (s: string) => notices.push(s) },
			sessionManager: { getSessionDir: () => cwd, getSessionId: () => "session", getLeafId: () => branch.at(-1)?.id, getBranch: () => branch },
			modelRegistry: { streamSimple(_model: any, context: any) {
				sent = context;
				const prompt = context.messages.at(-1).content as string;
				if (blockedAll || blocked && !prompt.includes("first person plural")) return { result: async () => ({ ...assistant(""), stopReason: "error", errorMessage: "This request was blocked as it seems to violate Anthropic's Terms of Service restrictions on reverse engineering or duplicating model outputs." }) };
				const visible = visibleEntries(branch);
				const tail = tailChoices(visible).find(c => sourceEntries(visible.slice(0, c.index)).length)!;
				const id = sourceEntries(visible.slice(0, tail.index))[0].id;
				return { result: async () => assistant(`tail: ${invalidTail ? "missing" : tail.id}\n\nPort 4567, not verified. [@${invalid ? "missing" : citeTail ? tail.id : id}]`) };
			} },
		};
		memoryExtension(pi);
		const firstContext = convertToLlm(buildSessionContext(branch).messages);
		hooks.get("context")({ messages: buildSessionContext(branch).messages }, ctx);
		add("message", { message: assistant("Ready.") });
		const fold = () => hooks.get("session_before_compact")({ branchEntries: branch, preparation: { tokensBefore: 1234 }, signal: new AbortController().signal }, ctx);
		citeTail = true;
		const one = await fold();
		expect(one.cancel).toBeUndefined();
		expect(sent.messages.slice(0, firstContext.length)).toEqual(firstContext);
		expect(sent.systemPrompt).toBe("Unchanged system prompt");
		expect(one.compaction.details.prefixMode).toBe("captured");
		expect(one.compaction.details.register).toBe("compaction-om-v11");
		expect(sent.messages.at(-1).content).toContain('vgel, "Small Models Can Introspect, Too"');
		expect(sent.messages.at(-1).content).toContain('Jack Lindsey et al., "Emergent Introspective Awareness in Large Language Models"');
		expect(one.compaction.usage).toEqual(usage);
		expect(one.compaction.firstKeptEntryId).toBe("e1");
		expect(one.compaction.details.tail.estimatedTokens).toBeGreaterThan(1);
		expect(one.compaction.details.blocks[0].covers).toEqual(["e0"]);
		expect(one.compaction.details.blocks[0].sources).toEqual(["e1"]);
		add("compaction", one.compaction);
		const firstBlock = one.compaction.details.blocks[0];
		const resumed = expandMemory(buildSessionContext(branch).messages, branch);
		expect(resumed[0].content).toBe(renderBlock(firstBlock));
		expect(resumed.slice(1)).toEqual(firstContext.slice(1).concat({ ...branch.find(e => e.id === "e3").message }));
		add("message", { message: { role: "user", content: "New topic", timestamp: 3 } });
		hooks.get("context")({ messages: buildSessionContext(branch).messages }, ctx);
		add("message", { message: assistant("Next task.") });
		const two = await fold();
		expect(two.compaction.details.blocks).toHaveLength(2);
		expect(two.compaction.details.blocks[0]).toEqual(firstBlock);
		add("compaction", two.compaction);
		expect(two.compaction.details.blocks[1].covers).toEqual(["e1"]);
		const sessionFile = join(cwd, "session.jsonl");
		writeFileSync(sessionFile, branch.map(e => JSON.stringify(e)).join("\n"));
		expect(recall({ sessionFile, leafId: branch.at(-1).id, ids: firstBlock.sources })).toContain("I will use 4567; not verified yet.");
		expect(expandMemory(buildSessionContext(branch).messages, branch)[0]).toEqual(resumed[0]);
		expect(registered.has("memory_recall")).toBe(false);
		add("message", { message: { role: "user", content: "Another topic", timestamp: 4 } });
		add("message", { message: assistant("Another answer.") });
		invalid = true;
		const before = branch.length;
		expect(await fold()).toEqual({ cancel: true });
		expect(branch).toHaveLength(before);
		expect(notices.at(-1)).toContain("invalid original-source pointers");
		invalid = false; invalidTail = true;
		expect(await fold()).toEqual({ cancel: true });
		expect(notices.at(-1)).toContain("Invalid tail start");
		invalidTail = false; citeTail = true;
		const tailCited = await fold();
		expect(tailCited.compaction.details.blocks.at(-1).sources).toEqual([tailCited.compaction.firstKeptEntryId]);
		expect(tailCited.compaction.details.blocks.at(-1).covers).not.toContain(tailCited.compaction.firstKeptEntryId);
		citeTail = false; blocked = true;
		const retried = await fold();
		expect(retried.compaction.details.register).toBe("compaction-om-v11-fallback-impersonal");
		expect(sent.messages.at(-1).content).toContain("vgel");
		expect(sent.messages.at(-1).content).toContain("first person plural");
		expect(sent.messages.filter((m: any) => typeof m.content === "string" && m.content.includes("Tail starts"))).toHaveLength(1);
		blockedAll = true;
		expect(await fold()).toBeUndefined();
		expect(notices.at(-1)).toContain("falling back to Pi's native compaction");
		const attempts = readFileSync(join(cwd, "memory-attempts.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
		expect(attempts.slice(-2).map(a => a.attempt)).toEqual([1, 2]);
		expect(attempts.at(-1).error).toContain("reverse engineering");
		const captureFile = readdirSync(cwd).find(f => f.startsWith("memory-checkpoint-"))!;
		const capture = JSON.parse(readFileSync(join(cwd, captureFile), "utf8"));
		expect(capture.requests).toHaveLength(2);
		expect(capture.requests[0].messages.at(-1).content).not.toContain("first person plural");
		expect(capture.requests[1].messages.at(-1).content).toContain("first person plural");
	} finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("rewrite retains direct evidence; unknown or rewrite-time correction references fail", () => {
	const first = parseBlock("Port 3000. [@original]", new Set(["original"]), [], false, ["original"]);
	const correction = `Port 4567 instead, correcting [@${first.id}]. [@original] [@correction]`;
	const appended = parseBlock(correction, new Set(["original", "correction"]), [first], false, ["correction"]);
	expect(appended.sources).toEqual(["original", "correction"]);
	expect(appended.supersedes).toEqual([first.id]);
	const revised = parseBlock("Port 4567 instead. [@original] [@correction]", new Set(["original", "correction"]), [first], true, ["correction"]);
	expect(revised.supersedes).toEqual([]);
	expect(() => parseBlock(correction, new Set(["original", "correction"]), [first], true, [])).toThrow("source pointers");
	expect(() => parseBlock(correction, new Set(["correction"]), [], false, [])).toThrow("source pointers");
});

test("V1 blocks retain their rendered prefix and can be corrected or rewritten as prose", () => {
	const old = { id: "old", timestamp: 1, covers: ["source"],
		observations: [{ id: "old:o0", text: "Port 3000", sources: ["source"], supersedes: [] }], reflections: [] };
	const branch: any[] = [{ type: "compaction", id: "cut", timestamp: new Date(1).toISOString(),
		summary: "old envelope", details: { kind: "memory-log.v1", blocks: [old] } }];
	const expected = "Historical memory old. Later explicit corrections supersede earlier claims; plans are not completed work. Use memory_recall for original evidence.\nObservations:\n[old:o0] Port 3000\nSources: source\nReflection / activity log:\n";
	expect(expandMemory([{ role: "compactionSummary" }], branch)[0].content).toBe(expected);
	const text = "The port changed to 4567, correcting [@old:o0]; deployment remains unverified. [@source] [@correction]";
	const appended = parseBlock(text, new Set(["source", "correction"]), [old], false, ["correction"]);
	expect(appended.text).toBe(text);
	expect(appended.supersedes).toEqual(["old:o0"]);
	branch[0].details = { kind: KIND, blocks: [old, appended] };
	expect(expandMemory([{ role: "compactionSummary" }], branch)[0].content).toBe(expected);
	const rewritten = parseBlock("The port is 4567; deployment remains unverified. [@source] [@correction]", new Set(["source", "correction"]), [old, appended], true, ["correction"]);
	expect(rewritten.sources).toEqual(["source", "correction"]);
	expect(rewritten.supersedes).toEqual([]);
	expect(renderBlock(rewritten)).not.toContain("Observations:");
	expect(() => parseBlock("Uncited prose", new Set(["source"]), [], false, [])).toThrow("source pointers");
	expect(() => parseBlock("  ", new Set(), [], false, [])).toThrow("Missing memory prose");
});

test("tail starts exclude tool results and old summaries, preserving call/result groups", () => {
	const entries: any[] = [
		{ type: "compaction", id: "memory", summary: "prior memory", tokensBefore: 10, timestamp: new Date(1).toISOString() },
		{ type: "message", id: "user", message: { role: "user", content: "Check it", timestamp: 1 } },
		{ type: "message", id: "call", message: { ...assistant(""), content: [{ type: "toolCall", id: "c", name: "bash", arguments: { command: "true" } }] } },
		{ type: "message", id: "result", message: { role: "toolResult", toolCallId: "c", toolName: "bash", content: [{ type: "text", text: "ok" }], isError: false, timestamp: 1 } },
		{ type: "message", id: "answer", message: assistant("Checked.") },
	];
	const choices = tailChoices(entries);
	expect(choices.map(c => c.id)).toEqual(["user", "call", "answer"]);
	expect(entries.slice(choices[1].index).map(e => e.id)).toEqual(["call", "result", "answer"]);
	expect(choices[0].tokens).toBeGreaterThan(choices[2].tokens);
});

test("compaction tolerates metadata appends but rejects changed context and aborts", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "memory-race-"));
	try {
		mkdirSync(join(cwd, ".pi"));
		writeFileSync(join(cwd, ".pi/settings.json"), JSON.stringify({ memory: { enabled: true } }));
		for (const change of ["metadata", "message", "custom_message", "compaction", "branch", "session", "model", "abort"]) {
			const branch: any[] = [
				{ type: "message", id: "user", parentId: null, message: { role: "user", content: "Use port 4567", timestamp: 1 } },
				{ type: "message", id: "answer", parentId: "user", message: assistant("Ready") },
			];
			const hooks = new Map<string, any>(), notices: string[] = [];
			const controller = new AbortController();
			let session = "session";
			const ctx: any = {
				cwd, model: { id: "model", provider: "test", maxTokens: 16000 }, getSystemPrompt: () => "",
				ui: { notify: (s: string) => notices.push(s) },
				sessionManager: { getSessionId: () => session, getLeafId: () => branch.at(-1)?.id, getBranch: () => branch },
				modelRegistry: { streamSimple() { return { result: async () => {
					if (change === "session") session = "other";
					else if (change === "model") ctx.model = { ...ctx.model, id: "other" };
					else if (change === "abort") controller.abort();
					else if (change === "branch") branch.pop();
					else branch.push({ type: change === "metadata" ? "custom" : change, id: "new", parentId: "answer", customType: "board-cursor", data: { offset: 123 } });
					return assistant("tail: answer\nPort 4567. [@user]");
				} }; } },
			};
			memoryExtension({ on: (name: string, fn: any) => hooks.set(name, fn), registerCommand() {}, getActiveTools: () => [], getAllTools: () => [], getThinkingLevel: () => "off" } as any);
			const result = await hooks.get("session_before_compact")({ branchEntries: [...branch], preparation: { tokensBefore: 100 }, signal: controller.signal }, ctx);
			if (change === "metadata") {
				expect(result.compaction.firstKeptEntryId).toBe("answer");
				expect(notices).toEqual([]);
			} else {
				expect(result).toEqual({ cancel: true });
				expect(notices.at(-1)).toContain(change === "abort" ? "request aborted" : "session or conversation changed");
			}
		}
	} finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("tool outputs are elided only behind cold gaps, keeping recent turns and small results", () => {
	const big = "x".repeat(4000), branch: any[] = [];
	const add = (message: any) => { branch.push({ type: "message", id: `e${branch.length}`, parentId: branch.at(-1)?.id ?? null, timestamp: "", message }); };
	const call = (id: string, t: number) => ({ ...assistant("run"), content: [{ type: "toolCall", id, name: "bash", arguments: {} }], timestamp: t });
	const result = (id: string, text: string, t: number) => ({ role: "toolResult", toolCallId: id, toolName: "bash", content: [{ type: "text", text }], isError: false, timestamp: t });
	add({ role: "user", content: "a", timestamp: 0 }); add(call("c1", 1)); add(result("c1", big, 2)); add(result("c1s", "small", 2));
	add({ role: "user", content: "b", timestamp: 3 }); add(call("c2", 4)); add(result("c2", big, 5));
	const messages = () => branch.map(e => e.message), o = { idleMs: (p: string) => p === "test" ? 1000 : Infinity, minTokens: 500, keepTurns: 1 };
	expect(elideCold(messages(), branch, o).elided).toBe(0);
	add({ role: "user", content: "c", timestamp: 5000 });
	const warm = elideCold(messages(), branch, o);
	expect(warm.elided).toBe(1);
	expect(warm.messages[2].content[0].text).toContain("ab memory recall e2");
	expect(warm.messages[3].content[0].text).toBe("small");
	expect(warm.messages[6].content[0].text).toBe(big);
	expect(elideCold(messages(), branch, { ...o, idleMs: () => 10000 }).elided).toBe(0);
	add(call("c3", 5001)); add(result("c3", big, 5002)); add({ role: "user", content: "d", timestamp: 5003 });
	expect(JSON.stringify(elideCold(messages(), branch, o).messages.slice(0, 8))).toBe(JSON.stringify(warm.messages));
});
