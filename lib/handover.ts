import { relative, isAbsolute } from "node:path";
import { handoverDesk } from "./desk";
import { readLive } from "./session-meta/live";
import { archiveBb, bbThreads, reparentBb, showBb } from "./thread/bb";
import { campaigns } from "./reconcile/main";
import { updateState } from "./reconcile/reconcile";
import { handoverPickup } from "./reconcile/pickup";
import { ownershipLock } from "./reconcile/ownership";

const within = (path: string, dir: string) => {
	const sub = relative(dir, path);
	return !sub || sub !== ".." && !sub.startsWith("../") && !isAbsolute(sub);
};

/** All operations are repeatable after partial failure. Archive is last, while launches
 * are excluded; no worker or pending exception is stopped or replaced. */
export async function handover(from: string, to: string, cwd = process.cwd()) {
	if (from === to) throw new Error("Handover needs two different threads");
	return ownershipLock(cwd, async () => {
		const old = await showBb(from), next = await showBb(to);
		if (!next.thread.canSpawnChild || next.thread.archivedAt)
			throw new Error("@thread:" + to + " cannot launch children; handover left the old supervisor unarchived");
		const threads = await bbThreads();
		// BB's lifecycle ownership is immutable and hidden source forks cascade separately
		// from sidebar parenting. Refuse those before making an archive destructive.
		for (const t of threads.values()) if (!t.archivedAt &&
			(t.lifecycleOwnerThreadId === from || t.sourceThreadId === from && t.visibility === "hidden"))
			throw new Error("@thread:" + t.id + " has an immutable archive dependency on " + from + "; cannot archive its owner while preserving it");
		const runs = campaigns(cwd);
		for (const s of runs) if (!s.finished && s.owner === from) {
			if (s.running && !s.ownerHandover)
				throw new Error(s.root + " has not loaded handover-aware code yet; let its automatic code refresh finish, then retry");
			if (old.environment?.managed && old.environment.isWorktree && within(s.cwd, old.environment.path))
				throw new Error(s.root + " still lands in the old supervisor's managed worktree " + s.cwd + "; archive would remove that target");
		}
		const ownerSession = readLive().find(l => l.thread === to)?.sessionId;
		// The watcher holds its scan lock until every start is recorded. Transfer it
		// first, then enumerate runs again to include a start that just completed.
		const pickup = handoverPickup(cwd, from, to, ownerSession);
		const movedRuns: string[] = [];
		for (const s of campaigns(cwd)) if (!s.finished && s.owner === from) {
			updateState(cwd, s.root, current => {
				if (current?.owner === from) {
					current.owner = to; current.ownerSession = ownerSession;
				}
				return current!;
			});
			movedRuns.push(s.root);
		}
		const desk = await handoverDesk(from, to, cwd);
		const children: string[] = [];
		// The new supervisor may itself have been a child of the old one.
		if (next.thread.parentThreadId === from) {
			await reparentBb(to, old.thread.parentThreadId);
			children.push(to);
		}
		for (const t of (await bbThreads()).values()) if (!t.archivedAt && t.parentThreadId === from && t.id !== to) {
			await reparentBb(t.id, to);
			children.push(t.id);
		}
		// Use bb's live capability rather than paying for a probe model turn.
		const ready = await showBb(to);
		if (!ready.thread.canSpawnChild || ready.thread.archivedAt)
			throw new Error("New supervisor lost launch capability; old supervisor remains unarchived. Retry handover after restoring it");
		if (!old.thread.archivedAt) await archiveBb(from);
		return { from, to, desk, pickup: pickup ?? null, reconcilers: movedRuns, children, canSpawnChild: true, archived: from };
	});
}
