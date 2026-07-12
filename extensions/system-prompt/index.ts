import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";

function documentationPaths(prompt: string): string[] {
	return ["Main documentation", "Additional docs", "Examples"].flatMap((label) => {
		const match = prompt.match(new RegExp(`^- ${label}: (.+)$`, "m"));
		return match ? [`- ${label}: ${match[1]}`] : [];
	});
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&apos;",
	})[character]!);
}

function visibleSkills(options: BuildSystemPromptOptions): string | undefined {
	const skills = options.skills?.filter((skill) => !skill.disableModelInvocation);
	if (!skills?.length) return undefined;
	const entries = skills.map((skill) => [
		"  <skill>",
		`    <name>${escapeXml(skill.name)}</name>`,
		`    <description>${escapeXml(skill.description)}</description>`,
		`    <location>${escapeXml(skill.filePath)}</location>`,
		"  </skill>",
	].join("\n")).join("\n");
	return `Skills provide task-specific instructions. Read a matching skill file before using it.\n\n<available_skills>\n${entries}\n</available_skills>`;
}

function buildPrompt(options: BuildSystemPromptOptions, originalPrompt: string): string {
	const parts: string[] = [];
	parts.push(options.customPrompt?.trim() || [
		"You are an expert coding assistant operating inside pi, a coding agent harness.",
		"Be concise and show file paths clearly when working with files.",
	].join("\n\n"));

	const docs = documentationPaths(originalPrompt);
	if (docs.length > 0) parts.push(`Pi documentation:\n${docs.join("\n")}`);
	if (options.appendSystemPrompt?.trim()) parts.push(options.appendSystemPrompt.trim());

	if (options.contextFiles?.length) {
		const files = options.contextFiles.map(({ path, content }) =>
			`<project_instructions path="${path}">\n${content}\n</project_instructions>`
		).join("\n\n");
		parts.push(`<project_context>\n\nProject-specific instructions and guidelines:\n\n${files}\n\n</project_context>`);
	}

	const skills = visibleSkills(options);
	if (skills) parts.push(skills);

	const date = new Date().toISOString().slice(0, 10);
	parts.push(`Current date: ${date}\nCurrent working directory: ${options.cwd.replace(/\\/g, "/")}`);
	return parts.join("\n\n");
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => ({
		systemPrompt: buildPrompt(event.systemPromptOptions, event.systemPrompt),
	}));
}
