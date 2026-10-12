// Shared seam for thread-registry-on-zmx. Implementations are partitioned in docs/issues/thread-core-and-workers-on-zmx.md.
export interface WorkerIdentity { run: string; handle: string }
export interface ThreadBlock {
	action: "archive" | "merge";
	parentBranch: string;
	files: string[];
	reason: string;
}
export interface AgentLaunch {
	/** Trusted shell command override (wm.spawn's explicit command / CLI --cmd). */
	cmd?: string;
	/** Additional pi arguments; the runner supplies --session using the current record. */
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
	/** bb thread id when bb runs this thread's pi (lib/thread/bb.ts) instead of a zmx terminal. */
	bb?: string;
}
export interface ThreadTerminal { name: string; role: string }
export interface ThreadSnapshot {
	thread: ThreadRecord;
	state: "queued" | "working" | "idle" | "exited";
	admission?: import("./admission").Admission;
	workspace?: import("./resources").WorkspaceResources;
	pid?: number; // canonical pi pid from readLive, never zmx ls's shell pid
	/** bb's own status for a bb-run thread; `error` is a bb command that failed (thread.start, turn.submit), which pi never reports. */
	bbStatus?: import("./bb").BbThread["status"];
	mergeParent?: string; // branch.<branch>.ab-parent
	mergeParentThread?: string;
	terminals: ThreadTerminal[];
	report?: { tag: string; ts: string; body: string };
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
	forkFrom?: string; // session id or file; copied once before launch
	launch?: AgentLaunch;
	worker?: WorkerIdentity;
	interactive?: boolean;
	/** Default defaultRuntime(): bb inside a bb session, else zmx. */
	runtime?: import("./bb").Runtime;
}
export interface ThreadIntegration {
	branch: string;
	parentBranch: string;
	path: string; // destination checkout used for integration
	mode: "rebase" | "merge";
}
export interface ThreadCleanup {
	closed: string[]; // post-order thread ids already retired
	killed: number[];
	branchesDeleted: string[];
	branchesKept: { branch: string; reason: string }[];
	blocked?: { threadId: string; block: ThreadBlock };
}
