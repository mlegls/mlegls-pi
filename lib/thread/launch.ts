import type { AgentLaunch, WorkerCheckout } from "./types";

const inheritedIdentity = /^(?:PI_SESSION_(?:ID|FILE)|PI_WM_.*|PI_CHECKPOINT|TMUX(?:_PANE)?)$/;

export function launchEnv(thread: Pick<WorkerCheckout, "worker" | "launch">): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (inheritedIdentity.test(key)) delete env[key];
	Object.assign(env, thread.launch?.env);
	env.PI_WM_RUN = thread.worker.run;
	env.PI_WM_HANDLE = thread.worker.handle;
	delete env.PI_SESSION_ID;
	delete env.PI_SESSION_FILE;
	return env;
}

/** bb owns the session; options that allocate/resume elsewhere cannot override it. */
export function validateLaunch(launch?: AgentLaunch): void {
	if ((launch as { cmd?: unknown } | undefined)?.cmd !== undefined) throw new Error("Threads run pi in bb; a launch command is not supported");
	const identity = /(?:^|\s)(?:--fork|--session|--session-id|--no-session|--continue|--resume|-c|-r)(?:\s|=|$)/;
	if (launch?.args?.some(a => identity.test(a)))
		throw new Error("Worker launches cannot carry session arguments; remove them");
}
