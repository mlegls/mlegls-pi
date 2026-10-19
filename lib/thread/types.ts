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
	/** A session a person types into, set at spawn. Interactive threads have no spawn parent; legacy records infer it. */
	interactive?: boolean;
	/** When a frontend last showed this thread; a turn ending after it is unread. */
	seenAt?: string;
	/** The bb thread running this thread's pi (lib/thread/bb.ts); absent on a record from the retired zmx runtime. */
	bb?: string;
}
export interface ThreadTerminal { name: string; role: string }
export interface ThreadSnapshot {
	thread: ThreadRecord;
	state: "working" | "idle" | "exited";
	workspace?: import("./resources").WorkspaceResources;
	pid?: number; // canonical pi pid from readLive, from the session's own live record
	/** bb's own status for a bb-run thread; `error` is a bb command that failed (thread.start, turn.submit), which pi never reports. */
	bbStatus?: import("./bb").BbThread["status"];
	mergeParent?: string; // branch.<branch>.ab-parent
	mergeParentThread?: string;
	terminals: ThreadTerminal[];
	interactive: boolean;
	/** needs-you > unread > read > running; workers' needs-you rolls up to their interactive ancestor in listThreads. */
	attention: Attention;
	/** When the current idle period began. */
	idleSince?: string;
	/** The worktree (uncommitted tracked edits included) against its merge base with `against`: mergeParent under a parent thread, else the project's default branch (origin/HEAD first), so a top-level thread shows what hasn't reached the remote. ahead/behind in commits. */
	delta?: { against: string; added: number; removed: number; files: number; ahead: number; behind: number };
}
export type Attention = "needs-you" | "unread" | "read" | "running";
export interface ThreadRow extends ThreadSnapshot {
	depth: number;
	treeParent?: string; // selected tree's parent thread
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
