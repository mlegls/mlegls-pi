import { parse as parseYaml } from "yaml";
// Shared worker stances; execution defaults live in agent frontmatter.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AGENTS_DIR = process.env.PI_AGENTS_DIR ?? join(homedir(), ".pi", "agent", "agents");

export interface Execution { model: string; effort: string }

/** The `provider/model:effort` entries of an agent's `model:` list, most preferred first. */
export function executions(line: string): Execution[] {
	return [...line.matchAll(/([\w-]+\/[\w.-]+):(off|none|minimal|low|medium|high|xhigh|max)\b/g)].map(m => ({ model: m[1], effort: m[2] }));
}

export interface Agent {
	name: string;
	/** `model:` list, most preferred first, e.g. "openai-codex/gpt-6.1-sol:high, anthropic/claude-sonnet-5-5:high"; routing takes the first with delegated capacity left. */
	routing?: string;
	/** The list's first entry. */
	model?: string;
	effort?: string;
	checkpoint?: string; // context ratio at which the fence extension fires; see extensions/context
	/** Pipeline roles this agent can fill (`role: implement` or `role: drive, review`); see agents/roles/. */
	roles: string[];
	description?: string;
	body: string;
}

/** Parse `AGENTS_DIR/<name>.md`: yaml frontmatter + body. */
export function agent(name: string): Agent | undefined {
	const file = join(AGENTS_DIR, `${name}.md`);
	if (!existsSync(file)) return undefined;
	const text = readFileSync(file, "utf8");
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
	const fm: Record<string, string> = Object.fromEntries(Object.entries((m && parseYaml(m[1])) ?? {}).map(([k, v]) => [k, String(v)]));
	const first = fm.model ? executions(fm.model)[0] : undefined;
	if (fm.model && !first) throw new Error(`Agent ${name}: model list names no provider/model:effort`);
	return { name, routing: fm.model, model: first?.model, effort: first?.effort, checkpoint: fm.checkpoint, roles: fm.role ? fm.role.split(",").map(r => r.trim()).filter(Boolean) : [], description: fm.description, body: (m ? text.slice(m[0].length) : text).trim() };
}

/** Agents that can fill a role: the candidate set a role's router chooses among. */
export function byRole(role: string): Agent[] {
	return readdirSync(AGENTS_DIR).filter(f => f.endsWith(".md") && !f.startsWith("_")).map(f => agent(f.slice(0, -3))!).filter(a => a.roles.includes(role));
}

/** The role layer of a prompt (`AGENTS_DIR/roles/<role>.md`), between the universal preamble and the agent's own body. */
export function roleBody(role: string): string {
	const file = join(AGENTS_DIR, "roles", role + ".md");
	if (!existsSync(file)) throw new Error("Unknown role: " + role);
	const text = readFileSync(file, "utf8");
	return text.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}
