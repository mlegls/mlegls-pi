// Move a zmx thread's pi session into bb. bb's Pi provider keeps each thread's session as a plain pi file and resumes
// from it, so the session is copied over a fresh bb thread's: pi's context, session id and board mailbox carry over.
// bb's own timeline starts at the stub exchange; the earlier history is in context, not shown.
import { copyFileSync, readFileSync } from "node:fs";
import { markRetired, readLive } from "../session-meta/live";
import { terminals, zmx } from "./zmx";
import { getThread, saveThread } from "./registry";
import { bbSessionFile, spawnBb, stopBb, waitBb } from "./bb";
import { delay } from "./process";
import type { ThreadRecord } from "./types";

/** The session's current model and thinking level, from its last change entries. */
function sessionModel(file: string): { model?: string; effort?: string } {
	let model: string | undefined, effort: string | undefined;
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line.includes("_change\"")) continue;
		let e: { type?: string; provider?: string; modelId?: string; thinkingLevel?: string };
		try { e = JSON.parse(line); } catch { continue; }
		if (e.type === "model_change" && e.provider && e.modelId) model = e.provider + "/" + e.modelId;
		if (e.type === "thinking_level_change" && e.thinkingLevel) effort = e.thinkingLevel;
	}
	return { model, effort };
}

const writing = (file: string) => readLive().some(l => l.sessionFile === file);
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** Stop only the agent terminal and its pi: unlike retirement, services running in the thread's worktree stay up. */
async function stopAgent(thread: ThreadRecord): Promise<void> {
	const pis = readLive().filter(l => l.sessionId === thread.sessionId);
	for (const l of pis) markRetired(l); // the exit is a move, not a crash
	if ((await terminals()).some(t => t.name === thread.id + ".agent")) await zmx(["kill", thread.id + ".agent", "--force"]);
	for (const l of pis) if (alive(l.pid)) process.kill(l.pid, "SIGTERM");
	for (let i = 0; i < 50 && pis.some(l => alive(l.pid)); i++) await delay(100);
	if (pis.some(l => alive(l.pid))) throw new Error("pi for thread " + thread.id + " did not exit");
}

export async function moveToBb(id: string): Promise<ThreadRecord> {
	const thread = await getThread(id);
	if (!thread || thread.archived) throw new Error("No active thread: " + id);
	if (thread.bb) throw new Error("Thread " + id + " already runs in bb (" + thread.bb + ")");
	if (thread.launch?.cmd !== undefined) throw new Error("Thread " + id + " runs a command override, not pi");
	const live = readLive().filter(l => l.sessionId === thread.sessionId);
	if (live.some(l => l.state === "working")) throw new Error("Thread " + id + " is mid-turn; move it once it's idle");
	const { model, effort } = sessionModel(thread.sessionFile);
	// The zmx runner would restart pi on the old file; stop it before two writers share the session.
	await stopAgent(thread);
	// Keep the spawn tree: a worker moved out of zmx still belongs under its parent's bb thread.
	const parentBb = thread.parent ? (await getThread(thread.parent))?.bb : undefined;
	const bb = await spawnBb(thread, parentBb, { model, effort, prompt: "Continued from pi session " + thread.sessionId + " (" + thread.sessionFile + "): its history is in your context but not shown in this thread. Reply only: ok" });
	await waitBb(bb, 300);
	const target = await bbSessionFile(bb);
	await stopBb(bb);
	for (let i = 0; i < 50 && writing(target); i++) await delay(200);
	if (writing(target)) throw new Error("bb's pi for " + bb + " is still running; its stub session " + target + " was left in place");
	copyFileSync(thread.sessionFile, target);
	const moved = { ...(await getThread(id))!, bb, sessionFile: target };
	await saveThread(moved);
	return moved;
}
