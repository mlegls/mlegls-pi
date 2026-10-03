// session-meta: record a session's spawn provenance in its own session log.
//
// lib/wm.ts exports PI_WM_AGENT, PI_WM_RUN, PI_WM_HANDLE, and PI_WM_PARENT_SESSION
// on the worker's agent command; a pi started from another session's bash tool records that
// session (PI_SESSION_ID) as invokedBy. Pi's session header
// has no user-writable field, so this writes one `custom` entry at session start. Audits
// read customType "session-meta" instead of inferring workers from directory names; a
// resumed session keeps the entry it already has.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readLive, removeLive, takeRetired, writeLive, type Live } from "./live";
import { mailbox } from "../board/mailbox";
import { send } from "../board/store";
import { getThread, threadForSession } from "../thread/registry";
import type { ThreadRecord } from "../thread/types";
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// Diagnostic: workers died of an uncaught "EPIPE: broken pipe, write" whose Bun stack names no caller.
// Pi's crash handler exits, so record what the pipe was (error fields, open fds, child processes) first.
const epipe = (e: unknown) => {
	if ((e as { code?: string })?.code !== "EPIPE") return;
	const run = (cmd: string, args: string[]) => { try { return execFileSync(cmd, args, { encoding: "utf8", timeout: 3000 }); } catch (x) { return String(x); } };
	try {
		appendFileSync(join(homedir(), ".pi/agent/epipe.jsonl"), JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, cwd: process.cwd(),
			error: { ...(e as object), message: (e as Error).message, stack: (e as Error).stack },
			fds: run("lsof", ["-p", String(process.pid)]).split("\n").filter(l => /PIPE|unix|FIFO/.test(l)),
			children: run("ps", ["-o", "pid,ppid,stat,lstart,command", "-g", String(process.pid)]) }) + "\n");
	} catch {}
};
const watchEpipe = () => { process.off("uncaughtException", epipe); process.prependListener("uncaughtException", epipe); };

export const SPAWN_META = "session-meta";

export interface SpawnMeta {
	thread?: string;
	agent?: string;
	run?: string;
	handle?: string;
	parentSession?: string;
	/** Session whose tool call started this pi (PI_SESSION_ID from the bash tool's env): headless children. */
	invokedBy?: string;
	/** Pi launch mode, persisted for status views after the process exits. */
	mode?: ExtensionContext["mode"];
}

/** Spawn provenance from wm's env or the invoking session, or undefined for a session nobody spawned. */
export function spawnMeta(env: Record<string, string | undefined> = process.env): SpawnMeta | undefined {
	const run = env.PI_WM_RUN;
	const handle = env.PI_WM_HANDLE;
	const wm = run && handle ? { run, handle, agent: env.PI_WM_AGENT, parentSession: env.PI_WM_PARENT_SESSION } : undefined;
	const invokedBy = !wm && env.PI_SESSION_ID ? env.PI_SESSION_ID : undefined;
	if (!wm && !invokedBy) return undefined;
	return { ...wm, ...(invokedBy && { invokedBy }) };
}

/** Membership is current id + file, not inherited env, directory name or historical metadata. */
export async function canonicalThread(sessionId: string, sessionFile?: string): Promise<ThreadRecord | undefined> {
	let record = await threadForSession(sessionId);
	if (!record && process.env.AB_THREAD_ID) record = await getThread(process.env.AB_THREAD_ID);
	return record && !record.archived && record.sessionId === sessionId && record.sessionFile === sessionFile ? record : undefined;
}

export function install(pi: ExtensionAPI) {
	const meta = spawnMeta();
	let parentSession = meta?.parentSession ?? meta?.invokedBy;
	let children = new Map<number, Live>();
	let monitor: ReturnType<typeof setInterval> | undefined;
	let ctx: ExtensionContext | undefined;
	let thread: string | undefined;
	const live = (state: "working" | "idle") => {
		if (!ctx) return;
		const sm = ctx.sessionManager;
		try {
			writeLive({ pid: process.pid, sessionId: sm.getSessionId(), sessionFile: sm.getSessionFile(), cwd: sm.getCwd(), state,
				since: new Date().toISOString(), tmuxPane: process.env.TMUX_PANE, mode: ctx.mode, parentSession, thread });
		} catch {}
	};
	// Prepended after pi's own handler (installed at startup), so it runs before pi exits.
	pi.on("agent_start", () => watchEpipe());
	pi.on("session_start", async (_event, c) => {
		ctx = c;
		watchEpipe();
		const saved = c.sessionManager.getBranch().filter((entry) => entry.type === "custom" && entry.customType === SPAWN_META).at(-1);
		const provenance = saved?.type === "custom" ? saved.data as SpawnMeta : undefined;
		const member = await canonicalThread(c.sessionManager.getSessionId(), c.sessionManager.getSessionFile());
		thread = member?.id;
		const worker = member?.worker ? { ...member.worker, agent: member.launch?.env?.PI_WM_AGENT, parentSession: member.launch?.env?.PI_WM_PARENT_SESSION } : undefined;
		const metadata = { ...provenance, ...meta, ...worker, thread, mode: c.mode };
		if (!thread) delete metadata.thread;
		parentSession = metadata.parentSession ?? metadata.invokedBy;
		clearInterval(monitor);
		children.clear();
		monitor = setInterval(() => {
			const next = new Map(readLive().filter(child => child.parentSession === c.sessionManager.getSessionId()).map(child => [child.pid, child]));
			// Print-mode children (pi -p) are one-shot runs whose caller reads their output; their exit is the expected end.
			for (const [pid, child] of children) if (!next.has(pid) && !takeRetired(child) && child.mode !== "print" && child.mode !== "json") {
				send({ topic: mailbox(c.sessionManager.getSessionId()), tags: ["child-exit"], from: { name: "child-monitor" }, body: `Child process exited: ${child.sessionId} (pid ${pid}, last state ${child.state}).\nWorkspace: ${child.cwd}\n${child.tmuxPane ? "Pane: " + child.tmuxPane : "No tmux pane recorded"}. Inspect its report before resuming; process exit alone does not establish a crash.` });
			}
			children = next;
		}, 5000);
		monitor.unref();
		live("idle");
		if (!saved || provenance?.thread !== thread || (worker && (provenance?.run !== worker.run || provenance?.handle !== worker.handle)))
			pi.appendEntry(SPAWN_META, metadata);
	});
	pi.on("agent_start", () => live("working"));
	pi.on("agent_end", () => live("idle"));
	pi.on("session_shutdown", () => { clearInterval(monitor); removeLive(); });
	process.once("exit", () => removeLive());
}

export { install as default };