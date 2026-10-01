import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { threadDir } from "./registry";
import { command, delay } from "./process";

export interface ZmxTerminal {
	name: string;
	pid: number; // PTY shell, not pi
	clients: number;
	created: number;
	thread?: string;
	role?: string;
	ended?: string;
	[key: string]: string | number | undefined;
}

export function backgroundEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	delete env.ZMX_SESSION;
	delete env.ZMX_SESSION_PREFIX;
	return env;
}

let binary: Promise<string> | undefined;
export function zmxBinary(): Promise<string> {
	return binary ??= command("mise", ["which", "zmx"], fileURLToPath(new URL("../../", import.meta.url))).then(path => path.trim());
}

export async function zmx(args: string[], cwd?: string, env = backgroundEnv()): Promise<string> {
	env = { ...env };
	delete env.ZMX_SESSION;
	delete env.ZMX_SESSION_PREFIX;
	return command(await zmxBinary(), args, cwd, env);
}

/** Full zmx ls is tab-separated key=value, including error rows. Never treat failed discovery as empty. */
export async function terminals(): Promise<ZmxTerminal[]> {
	const output = await zmx(["ls"]);
	const out: ZmxTerminal[] = [];
	for (const line of output.split("\n").filter(Boolean)) {
		const values: Record<string, string> = {};
		for (const field of line.replace(/^(?:→ |  )/, "").split("\t")) {
			const at = field.indexOf("=");
			if (at < 1 || Object.hasOwn(values, field.slice(0, at))) throw new Error("Malformed zmx ls: " + line);
			values[field.slice(0, at)] = field.slice(at + 1);
		}
		if (values.err || values.status || !values.name || !/^[1-9]\d*$/.test(values.pid ?? "") || !/^\d+$/.test(values.clients ?? "") || !/^\d+$/.test(values.created ?? ""))
			throw new Error("Unavailable/malformed zmx ls: " + line);
		if (out.some(t => t.name === values.name)) throw new Error("Duplicate zmx session: " + values.name);
		out.push({ ...values, name: values.name, pid: Number(values.pid), clients: Number(values.clients), created: Number(values.created) });
	}
	return out;
}

/** Serialize discovery/create across CLI processes, not just callers in one JS process. */
export async function terminalLock<T>(name: string, body: () => Promise<T>): Promise<T> {
	const dir = join(threadDir(), "locks");
	await mkdir(dir, { recursive: true });
	const path = join(dir, name);
	const until = Date.now() + 30_000;
	while (true) {
		try {
			const fd = await open(path, "wx", 0o600);
			try { await fd.writeFile(String(process.pid)); } finally { await fd.close(); }
			break;
		} catch (error) {
			if ((error as { code?: string }).code !== "EEXIST") throw error;
			const pid = Number(await readFile(path, "utf8").catch(() => ""));
			if (pid > 0) {
				try { process.kill(pid, 0); }
				catch (error) {
					if ((error as { code?: string }).code === "ESRCH") { await unlink(path).catch(() => {}); continue; }
				}
			}
			if (Date.now() >= until) throw new Error("Timed out waiting for thread terminal lock: " + name);
			await delay(100);
		}
	}
	try { return await body(); }
	finally { await unlink(path); }
}
