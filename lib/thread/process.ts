import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
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

export const quote = (text: string): string => "'" + text.replaceAll("'", "'\"'\"'") + "'";
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
