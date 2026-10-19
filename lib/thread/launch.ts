import type { ThreadRecord, AgentLaunch } from "./types";

const inheritedIdentity = /^(?:AB_THREAD_ID|PI_SESSION_(?:ID|FILE)|PI_WM_.*|PI_CHECKPOINT|TMUX(?:_PANE)?)$/;

export function launchEnv(thread: ThreadRecord): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (inheritedIdentity.test(key)) delete env[key];
	Object.assign(env, thread.launch?.env);
	env.AB_THREAD_ID = thread.id;
	if (thread.worker) {
		env.PI_WM_RUN = thread.worker.run;
		env.PI_WM_HANDLE = thread.worker.handle;
	}
	delete env.PI_SESSION_ID;
	delete env.PI_SESSION_FILE;
	return env;
}

/** The thread supplies session identity; options that allocate/resume elsewhere cannot override it. */
export function validateLaunch(launch?: AgentLaunch): void {
	if ((launch as { cmd?: unknown } | undefined)?.cmd !== undefined) throw new Error("Threads run pi in bb; a launch command is not supported");
	const identity = /(?:^|\s)(?:--fork|--session|--session-id|--no-session|--continue|--resume|-c|-r)(?:\s|=|$)/;
	if (launch?.args?.some(a => identity.test(a)))
		throw new Error("Thread launches supply --session; remove conflicting session arguments");
}
