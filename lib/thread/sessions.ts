import { SessionManager } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readLive } from "../session-meta/live";
import { threadForSession, validId } from "./registry";

export async function sessionFile(source: string, cwd: string): Promise<string> {
	if (existsSync(source)) return resolve(source);
	const thread = await threadForSession(source);
	if (thread) return thread.sessionFile;
	const live = readLive().filter(l => l.sessionFile && (l.sessionId === source || l.sessionFile === resolve(source)));
	const files = new Set(live.map(l => l.sessionFile!));
	if (files.size > 1) throw new Error("Ambiguous session: " + source);
	if (files.size) return [...files][0]!;
	const local = SessionManager.findById(cwd, source);
	if (local) return local;
	const matches = (await SessionManager.listAll()).filter(s => s.id === source);
	if (matches.length !== 1) throw new Error(matches.length ? "Ambiguous session: " + source : "Session not found: " + source);
	return matches[0]!.path;
}

export async function sessionHeader(file: string): Promise<{ id: string; cwd: string }> {
	const header = JSON.parse((await readFile(file, "utf8")).split("\n")[0]!);
	if (header.type !== "session" || typeof header.cwd !== "string") throw new Error("Invalid pi session header: " + file);
	validId(header.id);
	return header;
}

/** SDK create buffers empty sessions; the documented header alone preserves identity on open. */
export async function persistHeader(file: string, id: string, cwd: string): Promise<void> {
	if (!existsSync(file)) {
		const manager = SessionManager.create(cwd, dirname(file), { id });
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, JSON.stringify(manager.getHeader()) + "\n", { flag: "wx" })
			.catch(error => { if (error.code !== "EEXIST") throw error; });
	}
	if ((await sessionHeader(file)).id !== id) throw new Error("Pi session id does not match " + file + ": " + id);
}
