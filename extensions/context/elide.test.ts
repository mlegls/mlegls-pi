import { expect, test } from "bun:test";
import { elideCold, elidedId, recallElided } from "./elide.ts";

const usage = { input: 100, output: 10, cacheRead: 50, cacheWrite: 0, totalTokens: 160, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const assistant = (text: string) => ({ role: "assistant", content: [{ type: "text", text }], api: "openai-responses", provider: "test", model: "model", usage, stopReason: "stop", timestamp: 1 });

test("tool outputs are elided only behind cold gaps, keeping recent turns, small results and journal notes", () => {
	const big = "x".repeat(4000), branch: any[] = [];
	const add = (message: any) => { branch.push({ type: "message", id: "e" + branch.length, parentId: branch.at(-1)?.id ?? null, timestamp: "", message }); };
	const call = (id: string, t: number) => ({ ...assistant("run"), content: [{ type: "toolCall", id, name: "bash", arguments: {} }], timestamp: t });
	const result = (id: string, text: string, t: number, toolName = "bash") => ({ role: "toolResult", toolCallId: id, toolName, content: [{ type: "text", text }], isError: false, timestamp: t });
	add({ role: "user", content: "a", timestamp: 0 }); add(call("c1", 1)); add(result("c1", big, 2)); add(result("c1s", "small", 2)); add(result("j", big, 2, "journal"));
	add({ role: "user", content: "b", timestamp: 3 }); add(call("c2", 4)); add(result("c2", big, 5));
	const messages = () => branch.map(e => e.message), o = { idleMs: (p: string) => p === "test" ? 1000 : Infinity, minTokens: 500, keepTurns: 1 };
	expect(elideCold(messages(), branch, o).elided).toBe(0);
	add({ role: "user", content: "c", timestamp: 5000 });
	const cold = elideCold(messages(), branch, o);
	expect(cold.elided).toBe(1);
	expect(cold.messages[2].content[0].text).toContain("recall " + elidedId("e2"));
	expect(cold.elisions).toMatchObject([{ entry: "e2", tool: "bash", call: {} }]);
	expect(recallElided(branch, elidedId("e2"))!.content[0].text).toBe(big);
	expect(cold.messages[3].content[0].text).toBe("small");
	expect(cold.messages[4].content[0].text).toBe(big);
	expect(cold.messages[7].content[0].text).toBe(big);
	expect(elideCold(messages(), branch, { ...o, idleMs: () => 10000 }).elided).toBe(0);
	add(call("c3", 5001)); add(result("c3", big, 5002)); add({ role: "user", content: "d", timestamp: 5003 });
	expect(JSON.stringify(elideCold(messages(), branch, o).messages.slice(0, 9))).toBe(JSON.stringify(cold.messages));
});
