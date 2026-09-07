import { describe, expect, test } from "bun:test";
import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import systemPromptExtension from "./index";

type BeforeAgentStartHandler = (event: {
	systemPrompt: string;
	systemPromptOptions: BuildSystemPromptOptions;
}) => { systemPrompt: string };

function buildPrompt(options: BuildSystemPromptOptions, systemPrompt = ""): string {
	let handler: BeforeAgentStartHandler | undefined;
	systemPromptExtension({
		on(event, candidate) {
			if (event === "before_agent_start") handler = candidate as BeforeAgentStartHandler;
		},
	} as ExtensionAPI);
	if (!handler) throw new Error("before_agent_start handler was not registered");
	return handler({ systemPrompt, systemPromptOptions: options }).systemPrompt;
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

	test("retains pi identity but omits documentation guidance from the default prompt", () => {
		const originalPrompt = [
			"- Main documentation: /pi/README.md",
			"- Additional docs: /pi/docs",
			"- Examples: /pi/examples (extensions, custom tools, SDK)",
		].join("\n");
		const prompt = buildPrompt({ cwd: "/work" }, originalPrompt);

		expect(prompt).toContain("You are an expert coding assistant operating inside pi, a coding agent harness.");
		expect(prompt).toContain("Be concise and show file paths clearly when working with files.");
		expect(prompt).not.toContain("Pi documentation:");
		expect(prompt).not.toContain("/pi/");
		expect(prompt).not.toContain("cross-references");
	});

	test("preserves custom prompts, appended instructions, and project context", () => {
		const prompt = buildPrompt({
			cwd: "/work",
			customPrompt: "Custom pi instructions",
			appendSystemPrompt: "Appended instructions",
			contextFiles: [{ path: "/work/AGENTS.md", content: "Project instructions" }],
		});

		expect(prompt).toStartWith("Custom pi instructions");
		expect(prompt).toContain("Appended instructions");
		expect(prompt).toContain('<project_instructions path="/work/AGENTS.md">\nProject instructions');
		expect(prompt).toContain("Current working directory: /work");
	});
});
