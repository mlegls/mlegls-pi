import { expect, test } from "bun:test";
import { keyOf, toPiMessages } from "./index";

const model = { api: "anthropic-messages", provider: "anthropic", id: "m" };

// context-manager stubs a result for an aborted turn's unanswered tool call; pi-ai then drops
// the aborted turn when sending, so the stub must go too or the API rejects it as orphaned.
test("stubbed results for an aborted turn's tool calls are dropped", () => {
	const aborted = { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "bash", arguments: {} }], stopReason: "aborted" } as any;
	const user = { role: "user", content: [{ type: "text", text: "next" }] } as any;
	const nms = [
		{ participant: "Assistant", content: [{ type: "tool_use", id: "t1", name: "bash", input: {} }] },
		{ participant: "user", content: [{ type: "tool_result", toolUseId: "t1", content: "stub" }] },
		{ participant: "User", content: [{ type: "text", text: "next" }] },
	];
	const originals = new Map([
		[keyOf("", nms[0].content), [[aborted]]],
		[keyOf("User", nms[2].content), [[user]]],
	]);
	expect(toPiMessages(nms, "Assistant", model, originals)).toEqual([aborted, user]);
});

test("a completed turn keeps its rebuilt results", () => {
	const done = { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "bash", arguments: {} }], stopReason: "toolUse" } as any;
	const nms = [
		{ participant: "Assistant", content: [{ type: "tool_use", id: "t1", name: "bash", input: {} }] },
		{ participant: "user", content: [{ type: "tool_result", toolUseId: "t1", content: "stub" }] },
	];
	const out = toPiMessages(nms, "Assistant", model, new Map([[keyOf("", nms[0].content), [[done]]]]));
	expect(out.map((m) => m.role)).toEqual(["assistant", "toolResult"]);
});
