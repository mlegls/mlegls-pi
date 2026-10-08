import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatParts, markView } from "./cache.ts";
import { Chat, settings } from "./build.ts";
import { runStart } from "./index.ts";

beforeAll(() => { process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "optmem-")); });

const entry = (id: string, message: any) => ({ type: "message", id, parentId: null, timestamp: "2026-10-08T00:00:00Z", message }) as any;
const sm = (branch: any[]) => ({ getSessionId: () => "s1", getLeafId: () => branch.at(-1)?.id ?? null, getBranch: () => branch });
const off = () => { const a = new AbortController(); a.abort(); return a.signal; };

test("short messages are their own nodes and short siblings join without a call; long ones wait for the compactor", () => {
	const branch = [
		entry("a", { role: "user", content: "hi" }),
		entry("b", { role: "assistant", content: [{ type: "text", text: "hello" }], stopReason: "stop" }),
		entry("c", { role: "user", content: "x".repeat(2000) }),
	];
	const c = new Chat(2, settings(tmpdir()));
	c.sync(branch, { session: "s1", sm: sm(branch), model: undefined, modelRegistry: {}, signal: off(), turn: () => ({ systemPrompt: "", tools: [] }) });
	expect(c.resolve([0, 0])).toBe("user: hi");
	expect(c.resolve([1, 0])).toBe("user: hi\nagent: hello");
	expect(c.resolve([0, 2])).toBeUndefined();
	expect(c.pending()).toBe(1);
	expect(c.summarized()).toBe(2);
});

test("a run starts after the last assistant message that ended one", () => {
	expect(runStart([
		entry("a", { role: "user", content: "q" }),
		entry("b", { role: "assistant", content: [], stopReason: "stop" }),
		entry("c", { role: "user", content: "q2" }),
		entry("d", { role: "assistant", content: [], stopReason: "toolUse" }),
		entry("e", { role: "toolResult", content: [] }),
	])).toBe(2);
});

test("the view goes in 4-line blocks; the Anthropic mark sits on the last whole one within 4 marks", () => {
	const parts = chatParts(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
	expect(parts.map((p) => p.text)).toEqual(["<chat>\n1\n2\n3\n4\n", "5\n6\n7\n8\n", "9\n</chat>"]);
	const payload = {
		system: [{ type: "text", text: "id", cache_control: { type: "ephemeral", ttl: "1h" } }, { type: "text", text: "sys", cache_control: { type: "ephemeral", ttl: "1h" } }],
		tools: [{ name: "t", cache_control: { type: "ephemeral", ttl: "1h" } }],
		messages: [{ role: "user", content: parts.map((p) => ({ ...p })) }, { role: "user", content: [{ type: "text", text: "go", cache_control: { type: "ephemeral", ttl: "1h" } }] }],
	};
	const out = markView(payload);
	expect(out.messages[0].content[1].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
	expect(out.tools[0].cache_control).toBeUndefined();
	expect(out.system[0].cache_control).toBeDefined();
	expect(JSON.stringify(out).match(/cache_control/g)).toHaveLength(4);
	expect(markView({ input: [] })).toEqual({ input: [] });
});
