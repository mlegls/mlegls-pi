import type { Handle } from "../dispatch.ts";
import type { Message } from "../board/store.ts";
import type { Tracker } from "../tracker.ts";
import type { GlobalRunState } from "./tracker-state.ts";
import type { PrRepairRequest, PullRequestHost } from "./pr-types.ts";

/** Run-owned hooks; PR polling holds no idle worker. The landing checkout remains
 * the ab-parent for repair workers, even while the owner's checkout is elsewhere. */
export interface PullRequestContext {
	state: GlobalRunState;
	tracker: Tracker;
	host: PullRequestHost;
	save: () => void;
	locked: <T>(work: () => Promise<T>) => Promise<T>;
	tests: string[];
	launchRepair: (request: PrRepairRequest) => Promise<Handle>;
	report: (worker: Handle, after?: string, launchedAt?: number) => Message | undefined;
	retireRepair: (worker: Handle) => Promise<void>;
	raiseOwner: (reason: string, message: string) => void;
}

/** Filled by reconcile-pr-checks-and-branch-updates. Invoked after root integrate,
 * and on restart of an opening/waiting/repairing run, before normal tree scheduling. */
export async function advancePullRequest(_context: PullRequestContext): Promise<"waiting" | "merged" | "held"> {
	throw new Error("reconcile-pr-checks-and-branch-updates has not filled advancePullRequest");
}
