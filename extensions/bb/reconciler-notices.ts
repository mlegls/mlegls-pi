import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { git } from "../../lib/thread/git.ts";
import { workerHandles, type State } from "../../lib/reconcile/reconcile.ts";

function hasFollowUp(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasFollowUp);
	if (value && typeof value === "object") return Object.values(value).some(hasFollowUp);
	return typeof value === "string" ? !!value.trim() : !!value;
}

function needsOwner(state: State): boolean {
	return Object.keys(state.exceptions ?? {}).length > 0
		|| Object.values(state.results ?? {}).some(({ handoff }) =>
			[handoff.question, handoff.caveats, handoff.followup].some(hasFollowUp));
}

/** Provenance, not titles: only receipted workers and recorded runs may settle locally.
 * Terminal run notices outlive their process; worker messages require a live run. */
export async function reconcilerCompletion(text: string, cwd: string): Promise<boolean> {
	const child = /^\[bb system\]\n\n@thread:(thr_[a-z0-9]+) completed(?:, with \d+ workflows? still running)?:\n/.exec(text)?.[1];
	const message = /^\[bb message from thread:(thr_[a-z0-9]+)\]\n\n([\s\S]*)$/.exec(text);
	const body = message?.[2] ?? text;
	const notices = body.split(/(?=^\[reconcile )/m).filter(Boolean);
	const runs = notices.map(notice => /^\[reconcile ([a-z0-9][a-z0-9._-]*)\] (?:done: [^\n]+ landed\b|parked\b|withdrew\b|stopped\b)/.exec(notice)?.[1]);
	const runNotice = runs.length > 0 && runs.every(Boolean);
	if (!child && !message && !runNotice) return false;
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
		// Explicit worker questions still need an answer, even before the reconciler records an exception.
		if (message && (/\?|\bneeds-input\b|\bblocked\b/i.test(body))) return false;
		for (const state of states.values()) {
			if (state.finished || state.stopping || !Number.isInteger(state.pid) || state.pid! <= 0) continue;
			try { process.kill(state.pid!, 0); }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") continue; }
			if (workerHandles(state).some(receipt => receipt.bb === (child ?? message?.[1]) && receipt.run === state.root))
				return !needsOwner(state);
		}
		return false;
	} catch {
		// Missing/stale/unreadable provenance is not authority to drop an input.
		return false;
	}
}
