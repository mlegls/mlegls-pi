import { GithubRateLimited } from "../tracker-github-snapshot.ts";

/** Runs work, and while the tracker's shared API budget is exhausted holds it until the reset, then runs it again.
 * Exhaustion is neither a failed snapshot nor an exception for any node, so it is noted once per hold (never mailed to
 * the owner) and every node simply waits; the retry replays the same idempotent step. Other errors pass through. */
export async function untilReset<T>(work: () => T | Promise<T>, o: { note?: (line: string) => void; signal?: AbortSignal } = {}): Promise<T> {
	for (let held = false; ; held = true) {
		try { return await work(); }
		catch (error) {
			if (!(error instanceof GithubRateLimited) || o.signal?.aborted) throw error;
			if (!held) o.note?.("tracker rate limit: holding every node until " + new Date(error.resetAt).toISOString());
			// GitHub reports whole seconds; a second of slack avoids waking just before the reset.
			await Bun.sleep(Math.max(0, error.resetAt - Date.now()) + 1_000);
		}
	}
}
