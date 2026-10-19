export interface WorkerIdentity { run: string; handle: string }
export interface ThreadBlock {
	action: "archive" | "merge";
	parentBranch: string;
	files: string[];
	reason: string;
}
export interface AgentLaunch {
	/** Additional pi arguments; the thread's pi gets --session from the current record. */
	args?: string[];
	env?: Record<string, string>;
	/** Submitted on first launch only, never replayed by the restart loop. */
	prompt?: string;
}
export interface ThreadRecord {
	id: string; // canonical pi session id at creation; never changes
	sessionId: string;
	sessionFile: string;
	cwd: string;
	project: string; // absolute main checkout
	worktree?: string; // enclosing linked worktree, if any
	ownership: "owner" | "guest"; // only owner may merge/remove worktree/kill cwd leftovers
	branch?: string;
	parent?: string; // spawn parent thread, independent of ab-parent
	archived: boolean;
	created: string;
	worker?: WorkerIdentity;
	launch?: AgentLaunch;
	blocked?: ThreadBlock;
	/** The bb thread running this thread's pi (lib/thread/bb.ts); absent on a record from the retired zmx runtime. */
	bb?: string;
}
export interface NewThreadOptions {
	cwd?: string; // spawning/integration checkout, default process.cwd()
	in?: string; // guest destination cwd; mutually exclusive with worktree
	worktree?: string; // requested branch/worktree name; default new thread id
	base?: string; // initial git ref; does not change the merge parent
	prepare?: (thread: ThreadRecord) => Promise<void>; // after checkout creation, before setup/launch
	parent?: string;
	parentSession?: string; // resolves default parent; free-session provenance remains separate
	launch?: AgentLaunch;
	worker?: WorkerIdentity;
	interactive?: boolean;
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
	closed: string[]; // post-order thread ids already retired
	killed: number[];
	branchesDeleted: string[];
	branchesKept: { branch: string; reason: string }[];
	/** Ignored state moved aside from removed worktrees, instead of deleted with them. */
	kept?: { worktree: string; path: string; entries: string[] }[];
	blocked?: { threadId: string; block: ThreadBlock };
}
