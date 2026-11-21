// A worker's report is the final agent message of its completed bb turn. The log binds both by
// scope.turnId; the thread-wide output can already be empty or belong to another turn.
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

export interface LogEvent {
	seq: number;
	type: string;
	createdAt: number;
	scope?: { kind: string; turnId?: string };
	data?: { status?: string; message?: string; detail?: string; providerThreadId?: string; item?: { type: string; text?: string } };
}

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
	/** The newest reportable turn completion read, if any. */
	report?: TurnReport;
	/** Where the next read starts, short of any report material for an unfinished turn. */
	seq: number;
}

interface TurnItems { message?: LogEvent; error?: LogEvent; compacted?: LogEvent }

/** The newest reportable turn completion after `after`, paired with its own final message or provider error. */
export async function readTurn(bb: string, after = 0, o: { onSkip?: (after: number) => void } = {}): Promise<TurnRead> {
	const { events, seq } = await readLog(bb, after, { onSkip: o.onSkip, keep: e =>
		e.type === "turn/completed" || e.type === "provider/error" || e.type === "thread/compacted" ||
		(e.type === "item/completed" && e.data?.item?.type === "agentMessage" && typeof e.data.item.text === "string") });
	const open = new Map<string, TurnItems>();
	let latest: { done: LogEvent; items: TurnItems } | undefined;
	for (const e of events) {
		const id = e.scope?.kind === "turn" && e.scope.turnId;
		if (!id) continue;
		const items = open.get(id) ?? {};
		if (e.type === "turn/completed") {
			open.delete(id);
			// bb can complete a standalone compaction turn right after a report. It is maintenance, not a worker turn.
			if (items.compacted && !items.message && e.data?.status === "completed") continue;
			latest = { done: e, items };
		} else {
			const key = e.type === "item/completed" ? "message" : e.type === "provider/error" ? "error" : "compacted";
			items[key] = e;
			open.set(id, items);
		}
	}
	// A poll can end after the final message or provider error but before bb logs its completion. Re-read those items.
	let next = seq;
	for (const items of open.values()) for (const e of Object.values(items)) next = Math.min(next, e.seq - 1);
	if (!latest) return { seq: next };
	const { done, items } = latest;
	const base = { seq: done.seq, id: String(done.seq), ts: new Date(done.createdAt).toISOString() };
	if (done.data?.status === "failed") {
		const why = items.error?.data;
		return { seq: next, report: { ...base, tags: ["turn-end", "error"], body: "error: " + (why?.detail ?? why?.message ?? "the provider ended the turn with an error") } };
	}
	if (done.data?.status && done.data.status !== "completed") return { seq: next, report: { ...base, tags: ["turn-end"], body: "(the turn was " + done.data.status + ")" } };
	const body = items.message?.data?.item?.text ?? "";
	return { seq: next, report: { ...base, tags: [parse(body).status ?? "turn-end"], body } };
}

/** The newest reportable turn completion of a bb thread after log sequence `after`. */
export const lastTurn = async (bb: string, after = 0): Promise<TurnReport | undefined> => (await readTurn(bb, after)).report;
