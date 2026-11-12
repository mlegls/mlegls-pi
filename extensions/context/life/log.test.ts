import { expect, test } from "bun:test";
import { clip, lifeMessages, messagesOf, pages } from "./log.ts";

const at = (id: string, message: any) => ({ type: "message", id, parentId: null, timestamp: "2026-10-08T00:00:00Z", message }) as any;

test("each entry becomes its messages by kind; thinking is never logged", () => {
	const branch = [
		{ type: "model_change", id: "model1", parentId: null, timestamp: "", provider: "p", modelId: "first" } as any,
		at("a", { role: "user", content: "fix it" }),
		at("b", { role: "assistant", provider: "p", model: "reply", content: [{ type: "thinking", thinking: "hm" }, { type: "text", text: "ok" }, { type: "toolCall", id: "c1", name: "read", arguments: { path: "x" } }] }),
		at("c", { role: "toolResult", toolCallId: "c1", content: [{ type: "text", text: "body" }] }),
		{ type: "custom_message", id: "d", parentId: "c", timestamp: "2026-10-08T00:00:01Z", customType: "mail", content: "[w1] done", display: true } as any,
		{ type: "label", id: "e", parentId: "d", timestamp: "", targetId: "a", label: "x" } as any,
		{ type: "model_change", id: "model2", parentId: "e", timestamp: "", provider: "q", modelId: "next" } as any,
		at("f", { role: "user", content: "[bb message from thread:sibling] what I hold" }),
		at("g", { role: "user", content: "[bb message from thread:worker] done" }),
	];
	const context = { session: "session", place: "import", model: "fallback/model", selfThreads: ["sibling"] };
	const ms = messagesOf(branch, context);
	expect(ms.map((m) => [m.kind, m.text, m.entry, m.k])).toEqual([
		["user", "fix it", "a", 0], ["agent", "ok", "b", 0], ["tool", 'read {"path":"x"}', "b", 1], ["echo", "body", "c", 0], ["work", "[w1] done", "d", 0],
		["self", "[bb message from thread:sibling] what I hold", "f", 0], ["work", "[bb message from thread:worker] done", "g", 0],
	]);
	expect(lifeMessages(branch, context).map((m) => [m.source, m.model])).toEqual([
		["entry:session/a#0", "p/first"], ["entry:session/b#0", "p/reply"], ["entry:session/b#1", "p/reply"],
		["entry:session/c#0", "p/reply"], ["entry:session/d#0", "p/reply"],
		["entry:session/f#0", "q/next"], ["entry:session/g#0", "q/next"],
	]);
});

test("tool output is clipped to head and tail; other long text is paged", () => {
	const c = clip("a".repeat(50) + "b".repeat(50), 20);
	expect(c.startsWith("a".repeat(10))).toBe(true);
	expect(c.endsWith("b".repeat(10))).toBe(true);
	expect(c).toContain("80 characters clipped");
	expect(pages("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
});
