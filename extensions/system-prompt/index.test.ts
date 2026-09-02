import { describe, expect, test } from "bun:test";
import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import systemPromptExtension from "./index";

type BeforeAgentStartHandler = (event: {
	systemPrompt: string;
	systemPromptOptions: BuildSystemPromptOptions;
}) => { systemPrompt: string };

function buildPrompt(options: BuildSystemPromptOptions): string {
	let handler: BeforeAgentStartHandler | undefined;
	systemPromptExtension({
		on(event, candidate) {
			if (event === "before_agent_start") handler = candidate as BeforeAgentStartHandler;
		},
	} as ExtensionAPI);
	if (!handler) throw new Error("before_agent_start handler was not registered");
	return handler({ systemPrompt: "", systemPromptOptions: options }).systemPrompt;
}

const skill = {
	name: "example",
	description: "Example skill",
	filePath: "/skills/example/SKILL.md",
	disableModelInvocation: false,
};

describe("system prompt extension", () => {
	test("only advertises skills when read is available", () => {
		const withoutRead = buildPrompt({ cwd: "/work", selectedTools: ["bash"], skills: [skill] } as BuildSystemPromptOptions);
		const withRead = buildPrompt({ cwd: "/work", selectedTools: ["read"], skills: [skill] } as BuildSystemPromptOptions);

		expect(withoutRead).not.toContain("<available_skills>");
		expect(withRead).toContain("<available_skills>");
	});
});
