export interface WorkerIdentity { run: string; handle: string }
export interface AgentLaunch {
	/** Additional pi arguments (--model, --thinking). */
	args?: string[];
	env?: Record<string, string>;
	/** Submitted on first launch only. */
	prompt?: string;
}
/** The worktree wm made for a worker, before bb has a thread for it. Never persisted: a running worker is found again
 * from its bb thread (workerOf in runtime.ts) and git. */
export interface WorkerCheckout {
	cwd: string;
	project: string; // absolute main checkout
	worktree: string;
	branch: string;
	worker: WorkerIdentity;
	launch?: AgentLaunch;
}
/** A worker's bb thread and its checkout. */
export interface WorkerThread extends WorkerCheckout {
	id: string; // the bb thread id
}
export interface NewThreadOptions {
	cwd?: string; // spawning/integration checkout, default process.cwd()
	worktree?: string; // requested branch/worktree name; default the worker's handle
	base?: string; // initial git ref; does not change the merge parent
	prepare?: (checkout: WorkerCheckout) => Promise<void>; // after checkout creation, before setup/launch
	parent?: string; // the bb thread it sits under; default BB_THREAD_ID
	launch?: AgentLaunch;
	worker: WorkerIdentity;
}
export interface ThreadIntegration {
	branch: string;
	parentBranch: string;
	path: string; // destination checkout used for integration
	mode: "rebase" | "merge";
	/** What the destination's merge printed, its hooks' output included: git ignores a failing post-merge hook. */
	output?: string;
}
export interface ThreadCleanup {
	closed: string[]; // retired bb thread ids
	killed: number[];
	branchesDeleted: string[];
	branchesKept: { branch: string; reason: string }[];
	/** Ignored state moved aside from removed worktrees, instead of deleted with them. */
	kept?: { worktree: string; path: string; entries: string[] }[];
}
