import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { checkout } from "./git";
import type { ThreadRecord } from "./types";

export function threadDir(): string {
	return join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab-threads");
}

export function validId(id: string): void {
	if (typeof id !== "string" || !/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(id)) throw new Error("Invalid thread/session id: " + id);
}

function validate(thread: ThreadRecord): void {
	validId(thread.id);
	validId(thread.sessionId);
	for (const key of ["sessionFile", "cwd", "project"] as const)
		if (typeof thread[key] !== "string" || !isAbsolute(thread[key])) throw new Error("Thread " + thread.id + ": " + key + " must be absolute");
	if (!["owner", "guest"].includes(thread.ownership) || typeof thread.archived !== "boolean" || !Number.isFinite(Date.parse(thread.created)))
		throw new Error("Invalid thread record: " + thread.id);
}

function missing(error: unknown): boolean { return (error as { code?: string }).code === "ENOENT"; }

export async function getThread(id: string): Promise<ThreadRecord | undefined> {
	validId(id);
	let value: string;
	try { value = await readFile(join(threadDir(), id + ".json"), "utf8"); }
	catch (error) { if (missing(error)) return; throw error; }
	const thread = JSON.parse(value) as ThreadRecord;
	validate(thread);
	if (thread.id !== id) throw new Error("Thread record id does not match file: " + id);
	return thread;
}

export async function allThreads(includeArchived = false): Promise<ThreadRecord[]> {
	let files: string[];
	try { files = await readdir(threadDir()); }
	catch (error) { if (missing(error)) return []; throw error; }
	const records = await Promise.all(files.filter(f => f.endsWith(".json")).map(f => getThread(f.slice(0, -5))));
	return records.filter((t): t is ThreadRecord => !!t && (includeArchived || !t.archived))
		.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

/** Only current canonical identity counts, never a historical session or worktree name. */
export async function threadForSession(session: string): Promise<ThreadRecord | undefined> {
	const matches = (await allThreads(true)).filter(t => t.sessionId === session || t.sessionFile === resolve(session));
	if (matches.length > 1) throw new Error("Ambiguous canonical session: " + session);
	return matches[0];
}

/** Unique active worker in cwd's git repository; run omitted only for a bare-handle lookup. */
export async function workerThread(handle: string, cwd: string, run?: string): Promise<ThreadRecord | undefined> {
	const project = checkout(cwd).project;
	const matches = (await allThreads()).filter(t => t.project === project && t.worker?.handle === handle && (run === undefined || t.worker.run === run));
	if (matches.length > 1) throw new Error("Ambiguous worker " + handle + " in " + project + "; supply its run");
	return matches[0];
}

/** Updates current identity, not thread id, parent or ownership. */
export async function setCurrentSession(id: string, session: { id: string; file: string }): Promise<void> {
	validId(session.id);
	const thread = await getThread(id);
	if (!thread) throw new Error("Unknown thread: " + id);
	const member = await threadForSession(session.id);
	if (member && member.id !== id) throw new Error("Session " + session.id + " already belongs to thread " + member.id);
	const { persistHeader } = await import("./sessions");
	const file = resolve(session.file);
	await persistHeader(file, session.id, thread.cwd);
	await saveThread({ ...thread, sessionId: session.id, sessionFile: file });
}

export interface BbEntry { bb: string; sessionId: string; topic?: string }
// Not *.json: every listing of the registry directory, including older running copies of this code, reads those as records.
const bbIndexPath = () => join(threadDir(), "bb.index");
/** Active bb-run threads by id, kept by saveThread, so a board send finds them without reading every record. */
export function bbIndex(): Record<string, BbEntry> {
	try { return JSON.parse(readFileSync(bbIndexPath(), "utf8")); } catch { return {}; }
}
function indexBb(thread: ThreadRecord): void {
	const index = bbIndex();
	const had = thread.id in index;
	if (thread.bb && !thread.archived) index[thread.id] = { bb: thread.bb, sessionId: thread.sessionId, ...(thread.worker && { topic: thread.worker.run + "/" + thread.worker.handle }) };
	else if (had) delete index[thread.id];
	else return;
	const temp = bbIndexPath() + "." + randomUUID() + ".tmp";
	writeFileSync(temp, JSON.stringify(index));
	renameSync(temp, bbIndexPath());
}

/** Atomic record replacement; lifecycle uses this for archived/blocked state. */
export async function saveThread(thread: ThreadRecord): Promise<void> {
	validate(thread);
	const dir = threadDir();
	await mkdir(dir, { recursive: true });
	const temp = join(dir, thread.id + "." + randomUUID() + ".tmp");
	try {
		await writeFile(temp, JSON.stringify(thread, null, 2) + "\n", { flag: "wx", mode: 0o600 });
		await rename(temp, join(dir, thread.id + ".json"));
		indexBb(thread);
	} finally {
		await unlink(temp).catch(error => { if (!missing(error)) throw error; });
	}
}
