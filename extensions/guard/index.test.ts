import { expect, test } from "bun:test";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import guard, { hookBypass } from "./index";

// The same tool_call hook receives direct and codemode-nested calls.
test("bash timeout guard uses seconds for direct and nested tool calls", () => {
	let onCall!: (event: ToolCallEvent) => unknown;
	guard({ on: (name: string, handler: typeof onCall) => {
		if (name === "tool_call") onCall = handler;
	} } as ExtensionAPI);
	for (const parentToolCallId of [undefined, "codemode-call"]) {
		const call = (timeout: number) => onCall({
			type: "tool_call", toolName: "bash", toolCallId: "bash-call", parentToolCallId,
			input: { command: "printf ok", timeout },
		});
		expect(call(60000)).toEqual({
			block: true,
			reason: "bash timeout is in seconds: 60000 s is 16.7 h; the ceiling is 1800 s. Slow or streaming work goes through the process tool.",
		});
		expect(call(600)).toBeUndefined();
		expect(call(1800)).toBeUndefined();
	}
});

test("commit hook bypass detection respects the Git command's flags", () => {
	const cases: [string, string | undefined][] = [
		[`tmux -L translation-commit-c new-window -t commit -n retry -c "$PWD" 'git commit -m "Record joined Application Patch translation first use"; ...'`, undefined],
		["git commit -n", "commit -n"],
		["git commit -an -m x", "commit -n"],
		[`git commit -m "a -n b"`, undefined],
		[`tmux new-window -n retry 'git commit -n -m x'`, "commit -n"],
		[`bash -c 'git commit -n -m x'`, "commit -n"],
		["git commit --no-verify -m x", "--no-verify"],
		["git -c core.hooksPath= commit -m x", "core.hooksPath"],
	];
	for (const [command, reason] of cases) {
		expect(hookBypass(command), command).toBe(reason);
	}
});
