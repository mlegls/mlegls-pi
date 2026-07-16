import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export function expandHome(input: string): string {
	if (input === "~") return homedir();
	if (input.startsWith("~/")) return join(homedir(), input.slice(2));
	return input;
}

export async function resolveWorkspacePath(input: string, cwd: string): Promise<string> {
	const value = input.trim();
	if (!value) throw new Error("Workspace path is required");
	const expanded = expandHome(value);
	const candidate = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
	const info = await stat(candidate).catch(() => undefined);
	if (!info) throw new Error(`Workspace does not exist: ${candidate}`);
	if (!info.isDirectory()) throw new Error(`Workspace is not a directory: ${candidate}`);
	return realpath(candidate);
}
