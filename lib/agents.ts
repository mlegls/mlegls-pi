// Shared worker stances; execution defaults live in agent frontmatter.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AGENTS_DIR = process.env.PI_AGENTS_DIR ?? join(homedir(), ".pi", "agent", "agents");

export interface Agent {
	name: string;
	model?: string;
	effort?: string;
	routingNote?: string;
	checkpoint?: string; // context ratio at which the fence extension fires; see extensions/fence
	/** Pipeline roles this agent can fill (`role: implement` or `role: drive, review`); see agents/roles/. */
	roles: string[];
	body: string;
}

/** Parse `AGENTS_DIR/<name>.md`: yaml-ish frontmatter (flat `key: value`) + body. */
export function agent(name: string): Agent | undefined {
	const file = join(AGENTS_DIR, `${name}.md`);
	if (!existsSync(file)) return undefined;
	const text = readFileSync(file, "utf8");
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
	const fm: Record<string, string> = {};
	for (const line of m?.[1].split("\n") ?? []) {
		const i = line.indexOf(":");
		if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
	return { name, model: fm.model, effort: fm.effort, routingNote: fm.routingNote, checkpoint: fm.checkpoint, roles: fm.role ? fm.role.split(",").map(r => r.trim()).filter(Boolean) : [], body: (m ? text.slice(m[0].length) : text).trim() };
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
