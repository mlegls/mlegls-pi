// Hibernation: a supervisor that is about to wait on its children folds its context while the prompt cache
// is still warm (the fold then reuses the cached prefix), instead of carrying it cold into the next wake.
// The canonical state (job, ledger, issues) is re-read on wake; the fold keeps only judgment. Like
// erlang:hibernate/3 or actor passivation. Design: docs/issues/supervisor-hibernation.md.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stateRoot } from "../../lib/daemon.ts";

export interface Supervision { id: string; ticket: string; live: string[] }

/** Running supervise jobs owned by this session that have live children, read from the daemon's index without starting it. */
export function supervising(session: string, root = stateRoot()): Supervision[] {
	const index = join(root, "jobs.json");
	if (!existsSync(index)) return [];
	const files: string[] = JSON.parse(readFileSync(index, "utf8"));
	return files.flatMap(file => {
		if (!/supervise-[^/]*\.json$/.test(file) || !existsSync(file)) return [];
		try {
			const r = JSON.parse(readFileSync(file, "utf8"));
			const live = Object.keys(r.state?.children ?? {});
			return r.type === "supervise" && r.status === "running" && r.input?.ownerSession === session && live.length
				? [{ id: r.id, ticket: r.input.ticket, live }] : [];
		} catch { return []; }
	});
}

/** Fold only when the expected wait outlasts the provider's cache: past that, the next wake re-reads everything anyway. */
export const worthFolding = (o: { expectedIdleSeconds: number; cacheSeconds: number; foldableTokens: number; minTokens: number }) =>
	o.expectedIdleSeconds >= o.cacheSeconds && o.foldableTokens >= o.minTokens;

export const focus = (jobs: Supervision[]) => `You are hibernating: this fold happens because you are a supervisor about to wait on your children (${jobs.map(j => `${j.ticket}: ${j.live.join(", ")}`).join("; ")}), not because context is full. Their state, the ledger and the issues are re-read on wake with \`ab supervise status\`, so don't restate them. Keep what they don't record: judgments about children and approaches, decisions and why, suspicions, what you intend to do on the likely next wakes. Cite artifacts as [@issue:slug], [@commit:sha] or [@job:id] where a judgment is about one. Nothing is in progress, so the tail can start at the last turn.`;
