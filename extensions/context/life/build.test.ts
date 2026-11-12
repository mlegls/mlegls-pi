import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatParts, markView } from "./cache.ts";
import { Chat, settings } from "./build.ts";
import { runStart } from "./index.ts";
import { lifeLog, lifeMessages } from "./log.ts";

beforeAll(() => { process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "life-build-")); });

const entry = (id: string, message: any) => ({ type: "message", id, parentId: null, timestamp: "2026-10-08T00:00:00Z", message }) as any;
const off = () => { const a = new AbortController(); a.abort(); return a.signal; };

test("short messages are their own nodes and short siblings join without a call; long ones wait for the compactor", () => {
	const branch = [
		entry("a", { role: "user", content: "hi" }),
		entry("b", { role: "assistant", content: [{ type: "text", text: "hello" }], stopReason: "stop" }),
		entry("c", { role: "user", content: "x".repeat(2000) }),
	];
	const c = new Chat(2, settings(tmpdir()));
	const log = lifeLog("/short-messages");
	log.append(lifeMessages(branch, { session: "s1", place: "thread-one", model: "test/model", selfThreads: [] }));
	c.sync(log, { session: "s1", model: undefined, modelRegistry: {}, signal: off(), turn: () => ({ systemPrompt: "", tools: [] }) });
	expect(c.resolve([0, 0])).toBe("user@thread-one: hi");
	expect(c.resolve([1, 0])).toBe("user@thread-one: hi\nagent@thread-one: hello");
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

test("scored: a reply's overlays are cut out of its line, named lines before it only", () => {
	const c: any = new Chat(2, { ...settings(tmpdir()), cut: "scored" });
	c.msgs = Array.from({ length: 10 }, (_, k) => ({ kind: "user", text: "m" + k, pos: k, place: "thread-one", source: "entry:s1/e" + k + "#0", model: "test/model", date: "" }));
	const got = c.parse("user: did X. obsoletes: 0+1 2+2\nduplicates: 4+1, 9+1", 6);
	expect(got.text).toBe("user: did X.");
	expect(got.overlays).toEqual([[c.key([0, 0]), "obsoletes"], [c.key([1, 1]), "obsoletes"], [c.key([0, 4]), "duplicates"]]);
	const due: any = new Chat(2, { ...settings(tmpdir()), cut: "due" });
	expect(due.parse("a. obsoletes: 0+1", 6).text).toBe("a. obsoletes: 0+1");
});
