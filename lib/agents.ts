// Shared worker stances; dispatch selects execution separately from legacy runCommand.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AGENTS_DIR = process.env.PI_AGENTS_DIR ?? join(homedir(), ".pi", "agent", "agents");

export interface Agent {
	name: string;
	runCommand?: string;
	checkpoint?: string; // context ratio at which the fence extension fires; see extensions/fence
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
	return { name, runCommand: fm.runCommand, checkpoint: fm.checkpoint, body: (m ? text.slice(m[0].length) : text).trim() };
}
