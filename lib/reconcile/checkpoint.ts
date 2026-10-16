/** A checkpoint is the context fence's pause, not the end of a worker: the fence compacts the worker's session when its
 * turn ends, and the worker waits for a follow-up in the same session and worktree. Replacing it instead lost what the
 * worktree alone held: a rehearsal's authorized production export and imported database went with the retired worktree
 * (2026-10-16). So a live worker resumes; only one that is gone gets a successor (startPhase). Resuming keeps its
 * session, so managed processes it runs stay its own. Budgeted either way: a worker that only checkpoints is raised. */
export async function checkpoint(
	chain: { retries: Record<string, number> },
	alive: boolean | undefined,
	budget: number,
	steps: { resume: () => Promise<void>; raise: (reason: string) => void; restart: () => Promise<void>; save: () => void },
) {
	const count = (chain.retries.checkpoint ?? 0) + 1;
	chain.retries.checkpoint = count;
	if (count > budget) return steps.raise("checkpointed " + budget + " times");
	// An unobserved worker (host listing failed) still has its mailbox; the dead-worker check relaunches one that is gone.
	if (alive === false) await steps.restart();
	else await steps.resume();
	// Starting a phase resets retries; keep the count across continuations.
	chain.retries.checkpoint = count;
	steps.save();
}
