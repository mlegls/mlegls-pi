// A bb thread's turn completions: how a worker's report reaches whoever waits on it. bb logs a
// `turn/completed` event per turn and keeps the final message as the thread's output; the report is that
// message, its status the first word (lib/report.ts), `turn-end` when it has none.
import { parse } from "../report.ts";
import { command } from "./process";

export interface TurnReport {
	/** The bb log sequence of the completion: later reports have larger ids. */
	seq: number;
	id: string;
	ts: string;
	/** The status the report starts with, else `turn-end`; `error` too when the provider ended the turn. */
	tags: string[];
	body: string;
}

export interface LogEvent { seq: number; type: string; createdAt: number; data?: { status?: string; message?: string; detail?: string; providerThreadId?: string } }

const cli = () => process.env.BB_CLI || "bb";
async function json<T>(args: string[]): Promise<T> {
	const value = JSON.parse(await command(cli(), [...args, "--json"]));
	if (value && typeof value === "object" && !Array.isArray(value) && value.ok === false) throw new Error("bb " + args.join(" ") + ": " + (value.error?.message ?? "failed"));
	return value as T;
}

/** bb refuses an event response over 8 MiB (HTTP 413), however few events it holds. */
const TOO_LARGE = /\b413\b|event_data_too_large/;
const PAGE = 200;

/** A bb thread's log after sequence `after`, read in pages oldest first (`--all` is one response, which a long thread
 * outgrows: 2026-11-06, concept). A page bb refuses as too large is read again smaller, down to one event; an event too
 * large to read alone is skipped, stepping the cursor one sequence at a time since its own isn't known until a later
 * read succeeds (sequences can skip numbers, so a step may pass none). Only events `keep` accepts are held; `seq` is
 * the position read up to. */
export async function readLog(bb: string, after = 0, o: { keep?: (e: LogEvent) => boolean; page?: number; onSkip?: (after: number) => void } = {}): Promise<{ events: LogEvent[]; seq: number }> {
	const page = o.page ?? PAGE, events: LogEvent[] = [];
	let seq = after, limit = page, stepping = false;
	for (;;) {
		let batch: LogEvent[];
		try { batch = await json<LogEvent[]>(["thread", "log", bb, "--limit", String(limit), "--after-seq", String(seq)]); }
		catch (e) {
			if (!TOO_LARGE.test(String(e))) throw e;
			if (limit > 1) { limit = Math.max(1, Math.floor(limit / 2)); continue; }
			if (!stepping) o.onSkip?.(seq);
			stepping = true; seq++; continue;
		}
		stepping = false;
		if (!batch.length) break;
		for (const e of batch) if (!o.keep || o.keep(e)) events.push(e);
		seq = batch.at(-1)!.seq;
		if (batch.length < limit) break;
		limit = Math.min(page, limit * 2);
	}
	return { events, seq };
}

export interface TurnRead {
	/** The newest turn completion read, if any. */
	report?: TurnReport;
	/** Where the next read starts: what was read, short of a provider error whose turn hasn't completed yet. */
	seq: number;
}

/** The newest turn completion of a bb thread after log sequence `after`, with the thread's final message as its body (a
 * provider error's text when the turn failed), and the log position to read from next. */
export async function readTurn(bb: string, after = 0, o: { onSkip?: (after: number) => void } = {}): Promise<TurnRead> {
	const { events, seq } = await readLog(bb, after, { keep: e => e.type === "turn/completed" || e.type === "provider/error", onSkip: o.onSkip });
	const done = events.filter(e => e.type === "turn/completed").at(-1);
	// bb logs a provider error just before the failed completion: one read without it is read again with it.
	const pending = events.find(e => e.type === "provider/error" && e.seq > (done?.seq ?? after));
	const next = pending ? pending.seq - 1 : seq;
	if (!done) return { seq: next };
	const base = { seq: done.seq, id: String(done.seq), ts: new Date(done.createdAt).toISOString() };
	// A turn the provider ended (auth, quota, retries exhausted) has no message; bb logs why just before it completes as failed.
	if (done.data?.status === "failed") {
		const why = events.filter(e => e.type === "provider/error" && e.seq < done.seq).at(-1)?.data;
		return { seq: next, report: { ...base, tags: ["turn-end", "error"], body: "error: " + (why?.detail ?? why?.message ?? "the provider ended the turn with an error") } };
	}
	// An interrupted turn's output is the turn before it.
	if (done.data?.status && done.data.status !== "completed") return { seq: next, report: { ...base, tags: ["turn-end"], body: "(the turn was " + done.data.status + ")" } };
	const body = (await json<{ output?: string }>(["thread", "output", bb])).output ?? "";
	return { seq: next, report: { ...base, tags: [parse(body).status ?? "turn-end"], body } };
}

/** The newest turn completion of a bb thread after log sequence `after`. */
export const lastTurn = async (bb: string, after = 0): Promise<TurnReport | undefined> => (await readTurn(bb, after)).report;
