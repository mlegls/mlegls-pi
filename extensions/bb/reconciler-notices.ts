import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { git } from "../../lib/thread/git.ts";
import { unmailedStatusException, workerHandles, type State } from "../../lib/reconcile/reconcile.ts";

function hasFollowUp(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasFollowUp);
	if (value && typeof value === "object") return Object.values(value).some(hasFollowUp);
	return typeof value === "string" ? !!value.trim() : !!value;
}

/** A run notice keeps its model turn when the run records something for the supervisor: a pending
 * exception, or a result asking a question or naming a follow-up. Caveats don't count: nearly every
 * handoff has them, and reconcile_status lists them. Worker notices never wait on this: an exception
 * reaches the supervisor in its own "needs you" notice. */
function needsOwner(state: State): boolean {
	return Object.values(state.exceptions ?? {}).some(ex => !unmailedStatusException(ex))
		|| Object.values(state.results ?? {}).some(({ handoff }) =>
			[handoff.question, handoff.followup].some(hasFollowUp));
}

/** BB's grouped notice can include several terminal outcomes. A malformed or mixed group stays intact. */
export function completionThreads(text: string): string[] {
	const child = /^\[bb system\]\n\n@thread:(thr_[a-z0-9]+) completed(?:, with \d+ workflows? still running)?(?::\n|\.$)/.exec(text)?.[1];
	if (child) return [child];
	const group = "[bb system]\n\nChild thread updates:\n\n";
	if (!text.startsWith(group)) return [];
	const ids = text.slice(group.length).trimEnd().split("\n").map(line =>
		/^- @thread:(thr_[a-z0-9]+) (?:completed|failed|was interrupted(?: because its host daemon restarted)?)\.$/.exec(line)?.[1]);
	return ids.every((id): id is string => !!id) ? ids : [];
}

/** Core notices use durable worker receipts; an explicit worker tell still requires a live run. */
export async function reconcilerCompletion(text: string, cwd: string): Promise<boolean> {
	const children = completionThreads(text);
	const message = /^\[bb message from thread:(thr_[a-z0-9]+)\]\n\n([\s\S]*)$/.exec(text);
	const body = message?.[2] ?? text;
	const notices = body.split(/(?=^\[reconcile )/m).filter(Boolean);
	const runs = notices.map(notice => /^\[reconcile ([a-z0-9][a-z0-9._-]*)\] (?:done: [^\n]+ landed\b|parked\b|withdrew\b|stopped\b|started \(budget \d+\)$|moved out\b|retired [^\n]+ with uncommitted work in its worktree;)/.exec(notice)?.[1]);
	const runNotice = runs.length > 0 && runs.every(Boolean);
	if (!children.length && !message && !runNotice) return false;
	try {
		const dir = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "reconcile");
		if (!existsSync(dir)) return false;
		const states = new Map<string, State>();
		// GitHub tracker journals share this directory, but aren't run states.
		for (const file of readdirSync(dir).filter(f => /^[^.]+\.json$/.test(f))) {
			const state = JSON.parse(readFileSync(join(dir, file), "utf8")) as State;
			if (state.root === file.slice(0, -5) && state.backend === "threads") states.set(state.root, state);
		}
		if (runNotice) return runs.every(root => {
			const state = states.get(root!);
			return !!state && !needsOwner(state);
		});
		if (children.length) {
			const pending = new Set(children);
			for (const state of states.values()) {
				for (const id of state.workerThreads ?? []) pending.delete(id);
				for (const id of Object.values(state.workerSessions ?? {})) pending.delete(id);
				for (const receipt of workerHandles(state)) if (receipt.bb && receipt.run === state.root) pending.delete(receipt.bb);
				if (!pending.size) return true;
			}
			return false;
		}
		// Explicit worker questions still need an answer, even before the reconciler records an exception.
		if (message && (/\?|\bneeds-input\b|\bblocked\b/i.test(body))) return false;
		for (const state of states.values()) {
			if (state.finished || state.stopping || !Number.isInteger(state.pid) || state.pid! <= 0) continue;
			try { process.kill(state.pid!, 0); }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") continue; }
			if (workerHandles(state).some(receipt => receipt.bb === message?.[1] && receipt.run === state.root))
				return true;
		}
		return false;
	} catch {
		// Missing/stale/unreadable provenance is not authority to drop an input.
		return false;
	}
}
