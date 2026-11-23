import { execFile } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";

export function command(bin: string, args: string[], cwd?: string, env = process.env): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(bin, args, { cwd, env, encoding: "utf8", maxBuffer: 64 << 20 }, (error, stdout, stderr) => {
			if (error) reject(new Error(bin + " " + args.join(" ") + ": " + (stderr || stdout || error.message)));
			else resolve(stdout);
		});
	});
}

export function executable(name: string): string {
	for (const dir of (process.env.PATH ?? "").split(delimiter)) {
		const path = join(dir, name);
		try { accessSync(path, constants.X_OK); return path; } catch {}
	}
	throw new Error("Executable not found on PATH: " + name);
}

/** Read the session receipt, not the group leader's PID: the manager can still be waiting on its descendants. */
export function managedProcess(sessionFile: string, missingMeansEmpty = false): boolean | undefined {
	try {
		const registry = JSON.parse(readFileSync(join(sessionFile + ".processes", "registry.json"), "utf8"));
		if (registry.version !== 1 || !Array.isArray(registry.records)) return undefined;
		const statuses: (string | undefined)[] = registry.records.map((r: { info?: { status?: string } }) => r?.info?.status);
		if (statuses.some(status => status === "running" || status === "terminating" || status === "terminate_timeout")) return true;
		return statuses.every(status => status === "exited" || status === "killed") ? false : undefined;
	} catch (e) { return missingMeansEmpty && (e as NodeJS.ErrnoException).code === "ENOENT" ? false : undefined; }
}

export const quote = (text: string): string => "'" + text.replaceAll("'", "'\"'\"'") + "'";
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
