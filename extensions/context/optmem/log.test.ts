import { expect, test } from "bun:test";
import { clip, messagesOf, pages } from "./log.ts";

const at = (id: string, message: any) => ({ type: "message", id, parentId: null, timestamp: "2026-10-08T00:00:00Z", message }) as any;

test("each entry becomes its messages by kind; thinking is never logged", () => {
	const ms = messagesOf([
		at("a", { role: "user", content: "fix it" }),
		at("b", { role: "assistant", content: [{ type: "thinking", thinking: "hm" }, { type: "text", text: "ok" }, { type: "toolCall", id: "c1", name: "read", arguments: { path: "x" } }] }),
		at("c", { role: "toolResult", toolCallId: "c1", content: [{ type: "text", text: "body" }] }),
		{ type: "custom_message", id: "d", parentId: "c", timestamp: "2026-10-08T00:00:01Z", customType: "mail", content: "[w1] done", display: true } as any,
		{ type: "label", id: "e", parentId: "d", timestamp: "", targetId: "a", label: "x" } as any,
	]);
	expect(ms.map((m) => [m.kind, m.text, m.entry, m.k])).toEqual([
		["user", "fix it", "a", 0], ["agent", "ok", "b", 0], ["tool", 'read {"path":"x"}', "b", 1], ["echo", "body", "c", 0], ["work", "[w1] done", "d", 0],
	]);
});

test("tool output is clipped to head and tail; other long text is paged", () => {
	const c = clip("a".repeat(50) + "b".repeat(50), 20);
	expect(c.startsWith("a".repeat(10))).toBe(true);
	expect(c.endsWith("b".repeat(10))).toBe(true);
	expect(c).toContain("80 characters clipped");
	expect(pages("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
});
