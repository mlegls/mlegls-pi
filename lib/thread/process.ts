import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function command(bin: string, args: string[], cwd?: string, env = process.env): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(bin, args, { cwd, env, encoding: "utf8", maxBuffer: 64 << 20 }, (error, stdout, stderr) => {
			if (error) reject(new Error(bin + " " + args.join(" ") + ": " + (stderr || stdout || error.message)));
			else resolve(stdout);
		});
	});
}

export interface ProcessReceipt {
	id: string;
	name: string;
	status: string;
	endTime: number | null;
	exitCode: number | null;
	interruption?: string;
}

export function processReceipts(dir: string, missingMeansEmpty = false): (ProcessReceipt | undefined)[] | undefined {
	try {
		const registry = JSON.parse(readFileSync(join(dir, "registry.json"), "utf8"));
		if (registry.version === 1 && Array.isArray(registry.records)) return registry.records.map((r: { info?: ProcessReceipt }) => r?.info);
	} catch (e) { if (missingMeansEmpty && (e as NodeJS.ErrnoException).code === "ENOENT") return []; }
}

export const liveProcessStatus = (status?: string) => status === "running" || status === "terminating" || status === "terminate_timeout";

/** Read the session receipt, not the group leader's PID: the manager can still be waiting on its descendants. */
export function managedProcess(sessionFile: string, missingMeansEmpty = false): boolean | undefined {
	const statuses = processReceipts(sessionFile + ".processes", missingMeansEmpty)?.map(info => info?.status);
	if (!statuses) return undefined;
	if (statuses.some(liveProcessStatus)) return true;
	return statuses.every(status => status === "exited" || status === "killed") ? false : undefined;
}

export const quote = (text: string): string => "'" + text.replaceAll("'", "'\"'\"'") + "'";
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
