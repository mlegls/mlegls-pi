import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { saveThread } from "../../lib/thread/registry";
import { resumeRefusal, threadCommand } from "./thread";

// Replays drive.md check 6 (docs/attachments/thread-commands-in-pi): lifecycle commands must be
// executable through pi. In-thread cleanup is detached and replayed with real pis in redrive.ts.
let root: string, state: string | undefined;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "thread-command-")); state = process.env.XDG_STATE_HOME; process.env.XDG_STATE_HOME = join(root, "state"); });
afterEach(async () => { if (state === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = state; await rm(root, { recursive: true, force: true }); });

function session(canonical: boolean) {
	const sm = SessionManager.create(root, join(root, "sessions"));
	const record = { id: sm.getSessionId(), sessionId: sm.getSessionId(), sessionFile: sm.getSessionFile()!, cwd: root, project: root, ownership: "guest" as const, archived: false, created: new Date().toISOString() };
	const notes: [string, string][] = [], calls: string[][] = [];
	const ctx: any = { cwd: root, sessionManager: sm, waitForIdle: async () => {}, ui: { notify: (m: string, k: string) => notes.push([k, m]) } };
	const pi: any = { exec: async (_: string, argv: string[]) => { calls.push(argv); return { code: 0, stdout: "{}", stderr: "" }; } };
	return { record, ctx, pi, notes, calls, save: () => canonical && saveThread(record) };
}

test("a canonical pi's /thread archive <id> hands another thread to ab thread", async () => {
	const s = session(true);
	await s.save();
	const other = { ...s.record, id: "other-thread", sessionId: "other-thread", sessionFile: join(root, "other.jsonl") };
	await saveThread(other);
	for (const action of ["archive", "abandon", "merge"]) await threadCommand(action + " other-thread", s.ctx, s.pi);
	expect(s.calls.map(c => c.slice(-3))).toEqual([["thread", "archive", "other-thread"], ["thread", "abandon", "other-thread"], ["thread", "merge", "other-thread"]]);
});

test("resuming another thread's conversation is refused, one's own or a free session is not", async () => {
	const s = session(true);
	await s.save();
	const other = { ...s.record, id: "other-thread", sessionId: "other-thread", sessionFile: join(root, "other.jsonl") };
	await saveThread(other);
	expect(await resumeRefusal(other.sessionFile, s.ctx)).toContain("thread other-thread's conversation");
	await saveThread({ ...other, archived: true });
	expect(await resumeRefusal(other.sessionFile, s.ctx)).toContain("archived thread other-thread");
	expect(await resumeRefusal(s.record.sessionFile, s.ctx)).toBeUndefined();
	expect(await resumeRefusal(join(root, "free.jsonl"), s.ctx)).toBeUndefined();
});

test("a free pi's lifecycle command names its missing thread instead of rejecting silently", async () => {
	const s = session(false);
	await expect(threadCommand("archive", s.ctx, s.pi)).rejects.toThrow("requires a thread id");
	await expect(threadCommand("abandon nope", s.ctx, s.pi)).rejects.toThrow("Unknown thread: nope");
	expect(s.calls).toEqual([]);
});
