import { basename } from "node:path";
import type { ThreadRecord, AgentLaunch } from "./types";

const inheritedIdentity = /^(?:AB_THREAD_ID|PI_SESSION_(?:ID|FILE)|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_WM_.*|PI_CHECKPOINT|TMUX(?:_PANE)?)$/;

/** A direct literal pi command is an override of pi's arguments, not a shell fixture. */
export function isPiLaunch(launch?: AgentLaunch): boolean {
	if (launch?.cmd === undefined) return true;
	const word = /^\s*(?:'([^']+)'|"([^"$`]+)"|([^\s'"\\;&|<>]+))(?=\s|$)/.exec(launch.cmd);
	return !!word && basename(word[1] ?? word[2] ?? word[3]!) === "pi";
}

export function launchEnv(thread: ThreadRecord): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (inheritedIdentity.test(key)) delete env[key];
	Object.assign(env, thread.launch?.env);
	env.AB_THREAD_ID = thread.id;
	env.PI_BOARD_TOPIC = thread.worker ? thread.worker.run + "/" + thread.worker.handle : "thread/" + thread.id;
	if (thread.worker) {
		env.PI_WM_RUN = thread.worker.run;
		env.PI_WM_HANDLE = thread.worker.handle;
		env.PI_BOARD_NAME ??= thread.worker.handle;
	}
	delete env.PI_SESSION_ID;
	delete env.PI_SESSION_FILE;
	return env;
}

/** The runner supplies session identity; options that allocate/resume elsewhere cannot override it. */
export function validateLaunch(launch?: AgentLaunch): void {
	if (launch?.cmd !== undefined && !launch.cmd.trim()) throw new Error("command must not be empty");
	if (!isPiLaunch(launch)) return;
	const identity = /(?:^|\s)(?:--fork|--session|--session-id|--no-session|--continue|--resume|-c|-r)(?:\s|=|$)/;
	if (identity.test(launch?.cmd ?? "") || launch?.args?.some(a => identity.test(a)))
		throw new Error("Thread launches supply --session; remove conflicting session arguments");
}
