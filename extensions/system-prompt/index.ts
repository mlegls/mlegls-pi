import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&apos;",
	})[character]!);
}

function readsFiles(options: BuildSystemPromptOptions): boolean {
	return !options.selectedTools || options.selectedTools.some((name) => name === "read" || name === "codemode");
}

// Pi derives a rule like this from the read tool's own guidelines, but this prompt replaces Pi's,
// and under codemode the nested read/grep/edit aren't selected tools anyway.
const FILE_TOOLS = "Use read, grep and edit for files rather than cat, sed, rg or redirects in bash: their output carries the anchors edit takes, so grep → edit needs no second look, and large files come back as outlines. bash is for running things.";

// Exec documented the same idiom; without it, shell backticks or escapes inside a script's template literal break the script.
const CODEMODE_PAYLOADS = "In codemode scripts, write literal payloads (shell commands, file text) as double-quoted strings, or String.raw`…` when they hold backslashes but no backticks, not plain template literals: backticks, ${ and backslashes in the payload then survive.";

function visibleSkills(options: BuildSystemPromptOptions): string | undefined {
	if (!readsFiles(options)) return undefined;
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

function buildPrompt(options: BuildSystemPromptOptions, sessionTimestamp?: string): string {
	const parts: string[] = [];
	parts.push(options.customPrompt?.trim() || [
		"You are an expert coding assistant operating inside pi, a coding agent harness.",
		"Be concise and show file paths clearly when working with files.",
	].join("\n\n"));

	if (readsFiles(options)) parts.push(FILE_TOOLS);
	if (options.selectedTools?.includes("codemode")) parts.push(CODEMODE_PAYLOADS);

	if (options.appendSystemPrompt?.trim()) parts.push(options.appendSystemPrompt.trim());

	if (options.contextFiles?.length) {
		const files = options.contextFiles.map(({ path, content }) =>
			`<project_instructions path="${path}">\n${content}\n</project_instructions>`
		).join("\n\n");
		parts.push(`<project_context>\n\nProject-specific instructions and guidelines:\n\n${files}\n\n</project_context>`);
	}

	const skills = visibleSkills(options);
	if (skills) parts.push(skills);

	if (sessionTimestamp) parts.push(`Session started: ${sessionTimestamp.slice(0, 10)}`);
	parts.push(`Current working directory: ${options.cwd.replace(/\\/g, "/")}`);
	return parts.join("\n\n");
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event, ctx) => ({
		systemPrompt: buildPrompt(event.systemPromptOptions, ctx.sessionManager.getHeader()?.timestamp),
	}));
}
