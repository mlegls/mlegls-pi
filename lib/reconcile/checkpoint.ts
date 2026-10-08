/** A continuation gets a new session and cannot own its predecessor's managed processes. */
export async function checkpoint(
	chain: { retries: Record<string, number> },
	running: boolean | undefined,
	budget: number,
	steps: { repair: (message: string) => Promise<void>; raise: (reason: string) => void; restart: () => Promise<void>; save: () => void },
) {
	if (running === true) return steps.repair("Wait for your running process (report `waiting`), then checkpoint after it completes. A continuation cannot own your session's managed processes; this checkpoint has not counted against the checkpoint budget.");
	const count = (chain.retries.checkpoint ?? 0) + 1;
	chain.retries.checkpoint = count;
	if (count > budget) return steps.raise("checkpointed " + budget + " times");
	await steps.restart();
	// Starting a phase resets retries; keep the count across continuations.
	chain.retries.checkpoint = count;
	steps.save();
}
