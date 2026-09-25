// session-meta: record a session's spawn provenance in its own session log.
//
// lib/wm.ts exports PI_WM_AGENT, PI_WM_RUN, PI_WM_HANDLE, and PI_WM_PARENT_SESSION
// on the worker's agent command. Paseo gives each agent PASEO_AGENT_ID and keeps the
// parent and title (run/handle) itself, so a Paseo tree is joined through Paseo. A pi
// started inside a Paseo agent inherits and records that agent's id. Pi's session header
// has no user-writable field, so this writes one `custom` entry at session start. Audits
// read customType "session-meta" instead of inferring workers from directory names; a
// resumed session keeps the entry it already has.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { removeLive, writeLive } from "./live";

export const SPAWN_META = "session-meta";

export interface SpawnMeta {
	agent?: string;
	run?: string;
	handle?: string;
	parentSession?: string;
	paseoAgent?: string;
	/** Session whose tool call started this pi (PI_SESSION_ID from the bash tool's env): headless children. */
	invokedBy?: string;
}

/** Spawn provenance from wm's or Paseo's env, or undefined in sessions neither spawned. */
export function spawnMeta(env: Record<string, string | undefined> = process.env): SpawnMeta | undefined {
	const run = env.PI_WM_RUN;
	const handle = env.PI_WM_HANDLE;
	const wm = run && handle ? { run, handle, agent: env.PI_WM_AGENT, parentSession: env.PI_WM_PARENT_SESSION } : undefined;
	const paseoAgent = env.PASEO_AGENT_ID || undefined;
	const invokedBy = !wm && env.PI_SESSION_ID ? env.PI_SESSION_ID : undefined;
	if (!wm && !paseoAgent && !invokedBy) return undefined;
	return { ...wm, ...(paseoAgent && { paseoAgent }), ...(invokedBy && { invokedBy }) };
}

export function install(pi: ExtensionAPI) {
	const meta = spawnMeta();
	let ctx: ExtensionContext | undefined;
	const live = (state: "working" | "idle") => {
		if (!ctx) return;
		const sm = ctx.sessionManager;
		try {
			writeLive({ pid: process.pid, sessionId: sm.getSessionId(), sessionFile: sm.getSessionFile(), cwd: sm.getCwd(), state,
				since: new Date().toISOString(), tmuxPane: process.env.TMUX_PANE, paseoAgent: process.env.PASEO_AGENT_ID });
		} catch {}
	};
	pi.on("session_start", (_event, c) => {
		ctx = c;
		live("idle");
		if (!meta) return;
		const recorded = c.sessionManager.getBranch().some((entry) => entry.type === "custom" && entry.customType === SPAWN_META);
		if (!recorded) pi.appendEntry(SPAWN_META, meta);
	});
	pi.on("agent_start", () => live("working"));
	pi.on("agent_end", () => live("idle"));
	pi.on("session_shutdown", () => removeLive());
	process.once("exit", () => removeLive());
}

export { install as default };