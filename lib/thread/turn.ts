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

interface Event { seq: number; type: string; createdAt: number; data?: { status?: string; message?: string; detail?: string } }

const cli = () => process.env.BB_CLI || "bb";
async function json<T>(args: string[]): Promise<T> {
	const value = JSON.parse(await command(cli(), [...args, "--json"]));
	if (value && typeof value === "object" && !Array.isArray(value) && value.ok === false) throw new Error("bb " + args.join(" ") + ": " + (value.error?.message ?? "failed"));
	return value as T;
}

/** The newest turn completion of a bb thread after log sequence `after`, with the thread's final message as its body (a provider error's text when the turn failed). */
export async function lastTurn(bb: string, after = 0): Promise<TurnReport | undefined> {
	const events = await json<Event[]>(["thread", "log", bb, "--all", "--after-seq", String(after)]);
	const done = events.filter(e => e.type === "turn/completed").at(-1);
	if (!done) return undefined;
	const base = { seq: done.seq, id: String(done.seq), ts: new Date(done.createdAt).toISOString() };
	// A turn the provider ended (auth, quota, retries exhausted) has no message; bb logs why just before it completes as failed.
	if (done.data?.status === "failed") {
		const why = events.filter(e => e.type === "provider/error" && e.seq < done.seq).at(-1)?.data;
		return { ...base, tags: ["turn-end", "error"], body: "error: " + (why?.detail ?? why?.message ?? "the provider ended the turn with an error") };
	}
	// An interrupted turn's output is the turn before it.
	if (done.data?.status && done.data.status !== "completed") return { ...base, tags: ["turn-end"], body: "(the turn was " + done.data.status + ")" };
	const body = (await json<{ output?: string }>(["thread", "output", bb])).output ?? "";
	return { ...base, tags: [parse(body).status ?? "turn-end"], body };
}
