// Read-only replay of the original Pi supervisor inputs. Prints counts, never prompt bodies.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { completionThreads, reconcilerCompletion } from "../../../extensions/bb/reconciler-notices";
import { reportsChildExit } from "../../../lib/session-meta/host";
import { bbPrompts, bbSessions } from "../../../lib/thread/bb";
import { commonDir } from "../../../lib/thread/git";
import type { State } from "../../../lib/reconcile/reconcile";

const [repo, owner, start] = process.argv.slice(2);
const since = Date.parse(start), until = since + 86_400_000;
const common = repo && commonDir(repo);
if (!common || !owner || !Number.isFinite(since)) throw new Error("usage: bun replay-day.ts <owner-repo> <bb-owner-thread> <ISO start with offset>");
const files = bbSessions().filter(s => s.thread === owner);
if (!files.length) throw new Error("No Pi session found for " + owner);
const prompts = new Set(bbPrompts().filter(p => p.thread === owner && !p.sender && p.at >= since && p.at < until).map(p => p.text.trim()));
// Historic live records were not stored. Join the child-exit's Pi session ID to the run's workerSessions receipt.
const workerSessions = new Map<string, string>();
const dir = join(common, "reconcile");
for (const file of readdirSync(dir).filter(f => /^[^.]+\.json$/.test(f))) {
	const state: State = JSON.parse(readFileSync(join(dir, file), "utf8"));
	if (state.backend === "threads" && state.root === file.slice(0, -5)) {
		for (const id of Object.keys(state.workerSessions ?? {})) workerSessions.set(id, state.root);
	}
}

const counts: Record<string, number> = {};
const pass: { id: string; kind: string }[] = [];
for (const file of new Set(files.map(s => s.file))) {
	const lines = readFileSync(file, "utf8").split("\n");
	for (const line of lines) {
		if (!line) continue;
		const entry = JSON.parse(line);
		const at = Date.parse(entry.timestamp);
		if (!(at >= since && at < until)) continue;
		if (entry.customType === "child-exit") {
			const m = /^Child process exited: (\S+) \(pid \d+, last state (working|idle)\)\./.exec(entry.content);
			if (!m) throw new Error("Unknown child exit format: " + entry.id);
			const state = m[2] as "working" | "idle";
			const keep = reportsChildExit({ state, reconcilerRun: workerSessions.get(m[1]) });
			const key = keep ? "keep: working child exit without reconciler provenance" : "drop: child exit " + state;
			counts[key] = (counts[key] ?? 0) + 1;
			if (keep) pass.push({ id: entry.id, kind: key });
			continue;
		}
		if (entry.message?.role !== "user") continue;
		const message = entry.message.content;
		const text = typeof message === "string" ? message : message.filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");
		const local = await reconcilerCompletion(text, repo);
		const core = completionThreads(text);
		const kind = core.length ? text.startsWith("[bb system]\n\nChild thread updates:") ? "grouped completion" : "single completion"
			: /^(?:\[reconcile [^\n]+?\] )?(?:needs you:|Post-landing gate|tick failed|Adoption requires)/m.test(text) ? "exception"
			: /^\[reconcile [^\n]+\] done: [^\n]+ landed\b/m.test(text) ? "landing"
			: text.startsWith("[bb message from thread:") ? "direct thread reply"
			: text.startsWith("[reconcile ") ? "run bookkeeping" : prompts.has(text.trim()) ? "maintainer prompt" : "other";
		const key = (local ? "local: " : "keep: ") + kind;
		counts[key] = (counts[key] ?? 0) + 1;
		if (!local && !["maintainer prompt", "exception", "landing"].includes(kind)) pass.push({ id: entry.id, kind });
	}
}
console.log(JSON.stringify({ owner, sessions: files.map(s => s.provider), joinedWorkerSessions: workerSessions.size, from: new Date(since).toISOString(), counts, pass }, null, 2));
