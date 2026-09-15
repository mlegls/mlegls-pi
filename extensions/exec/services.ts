// Host-side service adapter behind exec's structured globals (`exa.*`,
// `board.*`, `wm.*`). exec runs in a separate Node process; `createExecServices`
// owns the host half, wrapping the same libraries the tool extensions use --
// `../exa/client`, `../board/store`, and `../../lib/wm` -- so results arrive
// structured and untruncated. The child renders with `show`; nothing is
// flattened here.
//
// Board subscriptions and acknowledgments have one owner: the board extension,
// reached via board:subscribe / board:seen. Workers use lib/wm's single poller,
// but this adapter's worker map is separate from the hidden legacy wm tool's
// compatibility map. Both restore the wm-run entry; they do not share live state.
// The bridge retains this factory on kernel reset, replaces it on session change,
// and aborts old RPC signals before either reset.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { contents as exaContents, search as exaSearch, type ExaContentsOptions, type ExaSearchOptions } from "../exa/client";
import { parseTags } from "../board/query";
import { read as readBoard, send as sendBoard, topics as boardTopics, type Message } from "../board/store";
import { AGENTS_DIR, MergeConflict, attach, merge, spawn, wait, workmuxStatus, type Outcome, type Worker } from "../../lib/wm";

const REPORT_TAGS = "done | blocked | needs-input | checkpoint";
const RUN_ENTRY = "wm-run";
const SUBS_ENTRY = "board-subs";

export type { ExaResponse } from "../exa/client";
export type { Message, Numbered, TopicSummary } from "../board/store";

/** One call from the exec child, dispatched by namespace and method. */
export interface ExecServiceRequest {
	namespace: string;
	method: string;
	args: unknown;
	signal: AbortSignal;
}

export interface ExecServices {
	call(request: ExecServiceRequest): Promise<unknown>;
}

interface Subscription {
	topic: string;
	tags?: string;
	wake: boolean;
}

type WorkerJSON = ReturnType<Worker["toJSON"]>;

interface OutcomeJSON {
	handle: string;
	kind: Outcome["kind"];
	/** Present for reports (done/blocked/needs-input/checkpoint). */
	message?: Message;
	/** Present for idle/exited, the pane tail. */
	tail?: string;
}

type Args = Record<string, unknown>;

function object(value: unknown): Args {
	return value && typeof value === "object" ? value as Args : {};
}

function need<T>(value: T | undefined, what: string): T {
	if (value === undefined || value === null || value === "") throw new Error(`${what} required`);
	return value;
}

export function createExecServices(pi: ExtensionAPI, ctx: ExtensionContext): ExecServices {
	const cwd = ctx.cwd;
	const sessionId = ctx.sessionManager.getSessionId();
	const name = process.env.PI_BOARD_NAME ?? basename(cwd);

	let run: string | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === RUN_ENTRY) run = entry.data as string;
	}
	const workers = new Map<string, Worker>();

	/** This session's subscriptions, read from the same entry the board extension persists. */
	function subscriptions(): Subscription[] {
		let restored: Subscription[] | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === SUBS_ENTRY) restored = (entry.data as Subscription[]) ?? [];
		}
		return restored ?? (process.env.PI_BOARD_TOPIC ? [{ topic: process.env.PI_BOARD_TOPIC, wake: true }] : []);
	}

	function worker(handle: string, runParam?: string): Worker {
		const r = need(runParam ?? run, "run (no wm.spawn yet this session)");
		const key = `${r}/${handle}`;
		let w = workers.get(key);
		if (!w) {
			w = attach(r, handle, cwd);
			workers.set(key, w);
		}
		return w;
	}

	function remember(r: string) {
		if (run === r) return;
		run = r;
		pi.appendEntry(RUN_ENTRY, run);
	}

	/** Return structured reports without acknowledging them; callers use board.ack(ids). */
	async function waitOn(ws: Worker[], opts: { mode: "any" | "all"; timeoutMs?: number; signal?: AbortSignal }): Promise<{ outcomes: OutcomeJSON[]; pending: string[]; aborted: boolean }> {
		const got = await wait(ws, opts);
		opts.signal?.throwIfAborted();
		const outcomes: OutcomeJSON[] = [];
		for (const [w, o] of got) {
			if (o.kind === "idle" || o.kind === "exited") outcomes.push({ handle: w.handle, kind: o.kind, tail: o.tail });
			else {
				outcomes.push({ handle: w.handle, kind: o.kind, message: o.message });
			}
		}
		return { outcomes, pending: ws.filter((w) => !got.has(w)).map((w) => w.handle), aborted: opts.signal?.aborted ?? false };
	}

	async function exa(method: string, args: unknown, signal: AbortSignal): Promise<unknown> {
		switch (method) {
			case "search": {
				const a = object(args) as unknown as ExaSearchOptions;
				if (!Array.isArray(a.query)) return await exaSearch(a, signal);
				return { responses: await Promise.all(a.query.map(async (query: string) => ({
					query, ...await exaSearch({ ...a, query }, signal),
				}))) };
			}
			case "contents": return await exaContents(object(args) as unknown as ExaContentsOptions, signal);
			default: throw new Error(`unknown exa method: ${method}`);
		}
	}

	function board(method: string, args: unknown): unknown {
		switch (method) {
			case "send": {
				const a = object(args);
				return sendBoard({
					topic: need(a.topic as string | undefined, "topic"),
					body: (a.body as string) ?? "",
					tags: (a.tags as string[]) ?? [],
					data: a.data,
					from: { session: sessionId, name, cwd },
				});
			}
			case "read": {
				const a = object(args);
				const { messages, omitted } = readBoard({ topic: a.topic as string | undefined, tags: a.tags as string | undefined, limit: a.limit as number | undefined });
				return { messages, omitted };
			}
			case "list": {
				const a = object(args);
				return { topics: boardTopics(a.topic as string | undefined), subscriptions: subscriptions() };
			}
			case "subscribe": {
				const a = object(args);
				const sub: Subscription = { topic: need(a.topic as string | undefined, "topic"), tags: (a.tags as string | undefined) || undefined, wake: (a.wake as boolean | undefined) ?? true };
				parseTags(sub.tags); // fail before the board extension swallows anything
				pi.events.emit("board:subscribe", { ...sub, remove: a.remove ?? false });
				return { topic: sub.topic, tags: sub.tags, wake: sub.wake, remove: a.remove ?? false };
			}
			case "ack": {
				const ids = (object(args).ids as string[] | undefined) ?? [];
				if (ids.length) pi.events.emit("board:seen", { ids });
				return { acknowledged: ids };
			}
			default: throw new Error(`unknown board method: ${method}`);
		}
	}

	async function wm(method: string, args: unknown, signal: AbortSignal): Promise<unknown> {
		switch (method) {
			case "spawn": {
				const a = object(args);
				const r = need((a.run as string | undefined) ?? run, "run");
				const specs = (a.workers as Array<{ handle: string; prompt: string; agent?: string; base?: string }> | undefined) ?? [];
				if (!specs.length) throw new Error("workers required");
				const wake = (a.wake as boolean | undefined) ?? true;
				const settled = await Promise.allSettled(specs.map(async (o) => {
					const w = await spawn({ run: r, handle: o.handle, prompt: o.prompt, agent: o.agent, base: o.base, cwd });
					// Keep successful workers recoverable even if a sibling fails or RPC aborts.
					// This map belongs only to the captured session, never a replacement factory.
					workers.set(w.topic, w);
					signal.throwIfAborted();
					remember(r);
					pi.events.emit("board:subscribe", { topic: w.topic, tags: REPORT_TAGS, wake });
					return w;
				}));
				signal.throwIfAborted();
				const ws: Worker[] = [];
				const failures: string[] = [];
				settled.forEach((result, i) => {
					if (result.status === "fulfilled") ws.push(result.value);
					else failures.push(specs[i].handle + ": " + String(result.reason));
				});
				if (failures.length) throw new Error("wm.spawn partial failure (run " + r + "); started handles: " + (ws.map((w) => w.handle).join(", ") || "none") + "; failed: " + failures.join("; "));
				const spawned = { workers: ws.map((w) => w.toJSON()), subscribed: { run: r, wake, tags: REPORT_TAGS } };
				if (!(a.wait as boolean | undefined)) return spawned;
				return { ...spawned, ...(await waitOn(ws, { mode: "all", signal })) };
			}
			case "wait": {
				const a = object(args);
				const handles = a.handles as string[] | undefined;
				const ws = handles?.length ? handles.map((h) => worker(h, a.run as string | undefined)) : [...workers.values()];
				if (!ws.length) throw new Error("no workers to wait on (none spawned this session; pass handles)");
				return await waitOn(ws, { mode: (a.mode as "any" | "all" | undefined) ?? "any", timeoutMs: a.timeoutMs as number | undefined, signal });
			}
			case "send": {
				const a = object(args);
				const w = worker(need(a.handle as string | undefined, "handle"), a.run as string | undefined);
				await w.send(need(a.text as string | undefined, "text"));
				signal.throwIfAborted();
				return { handle: w.handle };
			}
			case "capture": {
				const a = object(args);
				const w = worker(need(a.handle as string | undefined, "handle"), a.run as string | undefined);
				const entry = (await workmuxStatus(cwd)).find((e) => e.worktree === w.handle);
				signal.throwIfAborted();
				if (entry?.pane_id) w.paneId = entry.pane_id;
				const text = await w.capture((a.lines as number | undefined) ?? 50);
				signal.throwIfAborted();
				return { handle: w.handle, paneId: w.paneId, text };
			}
			case "merge": {
				const a = object(args);
				const handles = need(a.handles as string[] | undefined, "handles");
				const into = a.into as string | undefined;
				const mode = (a.mode as "merge" | "rebase" | undefined) ?? "merge";
				const merged: string[] = [];
				for (const w of handles.map((h) => worker(h, a.run as string | undefined))) {
					try {
						await merge(w, { into, mode });
						signal.throwIfAborted();
						merged.push(w.branch);
					} catch (e) {
						signal.throwIfAborted();
						if (e instanceof MergeConflict) return { merged, conflict: { handle: w.handle, files: e.files }, into, mode };
						throw e;
					}
				}
				return { merged, into, mode };
			}
			case "close": {
				const a = object(args);
				const handles = need(a.handles as string[] | undefined, "handles");
				const ws = handles.map((h) => worker(h, a.run as string | undefined));
				for (const w of ws) {
					await w.close((a.keepBranch as boolean | undefined) ?? false);
					signal.throwIfAborted();
					workers.delete(w.topic);
					pi.events.emit("board:subscribe", { topic: w.topic, tags: REPORT_TAGS, remove: true });
				}
				return { closed: ws.map((w) => w.handle) };
			}
			case "status":
				return await workmuxStatus(cwd);
			case "agents":
				return readdirSync(AGENTS_DIR)
					.filter((f) => f.endsWith(".md") && !f.startsWith("_"))
					.sort()
					.map((f) => ({ name: f.slice(0, -3), description: /^description:\s*(.*)$/m.exec(readFileSync(join(AGENTS_DIR, f), "utf8"))?.[1] ?? "" }));
			default:
				throw new Error(`unknown wm method: ${method}`);
		}
	}

	return {
		async call(request: ExecServiceRequest): Promise<unknown> {
			request.signal.throwIfAborted();
			let result: unknown;
			switch (request.namespace) {
				case "exa": result = await exa(request.method, request.args, request.signal); break;
				case "board": result = board(request.method, request.args); break;
				case "wm": result = await wm(request.method, request.args, request.signal); break;
				default: throw new Error("unknown exec service namespace: " + request.namespace);
			}
			request.signal.throwIfAborted();
			return result;
		},
	};
}
