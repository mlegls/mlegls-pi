// Board: a shared pubsub log for coordinating pi sessions and scripts.
//
// Topics are paths (`compile/run-3/unit-a`), messages carry tags, and a session
// subscribes to `topic glob × tag expression`. Matching messages are injected
// into the session; `wake` subscriptions also start a turn, so an idle parent
// hears its children finish and a session hears decisions that touch its area.
// Everything else is pull: read/list never wake anyone.
//
// Other extensions subscribe this session through the event bus:
//   pi.events.emit("board:subscribe", { topic, tags?, wake? })
// and mark messages they already put in front of the model, so a subscription doesn't repeat them:
//   pi.events.emit("board:seen", { ids: string[] })

import { basename } from "node:path";
import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { compileQuery, parseTags } from "./query";
import { logSize, noteRead, readFrom, topics, type Message } from "./store";

interface Subscription {
	topic: string;
	tags?: string;
	wake: boolean;
}

const SUBS_ENTRY = "board-subs";
const CURSOR_ENTRY = "board-cursor";
const SEEN_ENTRY = "board-seen";
const POLL_MS = 1000;

function formatHead(m: Message & { line?: number }): string {
	const tags = m.tags.length ? ` [${m.tags.join(" ")}]` : "";
	const from = m.from.name ? ` <${m.from.name}>` : "";
	const line = m.line !== undefined ? `#${m.line} ` : "";
	return `${line}${m.id} ${m.ts.slice(11, 19)} ${m.topic}${tags}${from}`;
}

function formatMessage(m: Message & { line?: number }, options: { data?: boolean } = { data: true }): string {
	const data = options.data && m.data !== undefined ? `\n${JSON.stringify(m.data)}` : "";
	return `${formatHead(m)}\n${m.body}${data}`;
}

function subKey(s: Subscription): string {
	return `${s.topic} :: ${s.tags ?? ""}`;
}

export function install(pi: ExtensionAPI) {
	// Inside a bb thread, cross-session messaging is bb's (thread tell/wait, parent wake): leave the board inert.
	if (process.env.BB_THREAD_ID) return;
	let subs: Subscription[] = [];
	let cursor = 0; // byte offset into the log
	let context: ExtensionContext | undefined;
	const pending = new Map<string, Message>();
	let sessionId = "";
	let name = "";
	let cwd = "";
	let timer: ReturnType<typeof setInterval> | undefined;
	let matchers: Array<(m: Message) => boolean> = [];

	function rebuildMatchers() {
		matchers = subs.map((s) => {
			const match = compileQuery(s);
			return (m) => match(m.topic, m.tags);
		});
	}

	function persistSubs() {
		pi.appendEntry(SUBS_ENTRY, subs);
	}

	/** Add (or with remove, drop) a subscription; returns the resulting entry. Idempotent on topic×tags. */
	function subscribe(params: { topic: string; tags?: string; wake?: boolean; remove?: boolean }): Subscription {
		parseTags(params.tags);
		const sub: Subscription = { topic: params.topic, tags: params.tags || undefined, wake: params.wake ?? true };
		const key = subKey(sub);
		subs = subs.filter((s) => subKey(s) !== key);
		if (!params.remove) subs.push(sub);
		rebuildMatchers();
		persistSubs();
		return sub;
	}

	pi.events.on("board:subscribe", (params) => {
		subscribe(params as Parameters<typeof subscribe>[0]);
	});

	const seen = new Set<string>();

	function persistDelivery() {
		pi.appendEntry(CURSOR_ENTRY, { offset: cursor, pending: [...pending.values()] });
	}

	function reader() {
		return { session: sessionId, name, cwd };
	}

	function acknowledge(ids: string[]) {
		const fresh = ids.filter((id) => !seen.has(id));
		if (!fresh.length) return;
		for (const id of fresh) {
			seen.add(id);
			pending.delete(id);
		}
		noteRead({ action: "ack", reader: reader(), ids: fresh });
		pi.appendEntry(SEEN_ENTRY, fresh);
		persistDelivery();
	}

	pi.events.on("board:seen", (params) => {
		acknowledge((params as { ids: string[] }).ids);
	});

	function notification(messages: Message[]) {
		return {
			customType: "board",
			content: messages.map((m) => `[board] ${formatMessage(m)}`).join("\n\n"),
			display: true,
			details: { messages },
		};
	}

	function collect() {
		const result = readFrom(cursor);
		if (result.offset === cursor) return;
		cursor = result.offset;
		for (const m of result.messages) {
			if (m.from.session === sessionId || seen.has(m.id)) continue;
			if (matchers.some((match) => match(m))) pending.set(m.id, m);
		}
		persistDelivery();
	}

	function takePending(wakeOnly = false): Message[] {
		// Recheck subscriptions: a closed worker's queued report no longer needs a wake.
		const size = pending.size;
		for (const [id, m] of pending) {
			if (seen.has(id) || !matchers.some((match) => match(m))) pending.delete(id);
		}
		if (pending.size !== size) persistDelivery();
		const messages = [...pending.values()];
		if (wakeOnly && !messages.some((m) => matchers.some((match, i) => subs[i]!.wake && match(m)))) return [];
		acknowledge(messages.map((m) => m.id));
		return messages;
	}

	function poll() {
		collect();
		// Keep busy-session notifications cancellable by board_read / wm_wait. Pi's
		// follow-up queue cannot retract a report the model has since read through a tool.
		if (!context?.isIdle()) return;
		const messages = takePending(true);
		if (messages.length) pi.sendMessage(notification(messages), { triggerTurn: true, deliverAs: "followUp" });
	}

	function restore(ctx: ExtensionContext) {
		context = ctx;
		pending.clear();
		seen.clear();
		sessionId = ctx.sessionManager.getSessionId();
		cwd = ctx.cwd;
		name = process.env.PI_BOARD_NAME ?? basename(ctx.cwd);
		let restoredCursor: number | undefined;
		let restoredSubs: Subscription[] | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom") continue;
			if (entry.customType === SUBS_ENTRY) restoredSubs = (entry.data as Subscription[]) ?? [];
			if (entry.customType === CURSOR_ENTRY) {
				const data = entry.data as number | { offset: number; pending: Message[] };
				restoredCursor = typeof data === "number" ? data : data.offset;
				pending.clear();
				if (typeof data !== "number") for (const m of data.pending) pending.set(m.id, m);
			}
			if (entry.customType === SEEN_ENTRY) for (const id of entry.data as string[]) seen.add(id);
		}
		// A resumed session catches up on what it missed; a new one starts at the tail.
		cursor = restoredCursor ?? logSize();
		// A spawned worker (PI_BOARD_TOPIC set by its parent) starts subscribed with wake to its own
		// topic, so the parent's follow-ups and needs-input answers reach it without it asking.
		subs = restoredSubs ?? (process.env.PI_BOARD_TOPIC ? [{ topic: process.env.PI_BOARD_TOPIC, wake: true }] : []);
		if (!restoredSubs && subs.length) persistSubs();
		for (const id of seen) pending.delete(id);
		rebuildMatchers();
	}

	pi.on("session_start", (_event, ctx) => {
		restore(ctx);
		clearInterval(timer);
		timer = setInterval(poll, POLL_MS);
		timer.unref?.();
	});

	pi.on("session_tree", (_event, ctx) => restore(ctx));

	pi.on("before_agent_start", () => {
		collect();
		const messages = takePending();
		if (messages.length) return { message: notification(messages) };
	});

	pi.on("session_shutdown", () => {
		clearInterval(timer);
		timer = undefined;
	});

	pi.registerCommand("board", {
		description: "Show board topics and this session's subscriptions",
		handler: async (_args, ctx) => {
			const lines = topics().slice(0, 30).map((t) => `${t.topic}  ${t.count}  ${t.lastTs.slice(0, 19)}  [${t.lastTags.join(" ")}]`);
			const subLines = subs.map((s) => `${s.wake ? "wake" : "quiet"}  ${subKey(s)}`);
			ctx.ui.notify([...lines, "", "subscriptions:", ...(subLines.length ? subLines : ["(none)"])].join("\n"));
		},
	});

	pi.registerMessageRenderer("board", (message, { expanded }, theme) => {
		const details = message.details as Message | { messages: Message[] } | undefined;
		if (!details) return new Text(message.content as string, 0, 0);
		const messages = "messages" in details ? details.messages : [details];
		return new Text(messages.map((m) => {
			const head = theme.fg("accent", `board ${m.topic}`) + (m.tags.length ? theme.fg("muted", ` [${m.tags.join(" ")}]`) : "") + (m.from.name ? theme.fg("muted", ` <${m.from.name}>`) : "");
			const body = expanded ? formatMessage(m) : m.body.split("\n")[0]!.slice(0, 120);
			return `${head}\n${body}`;
		}).join("\n\n"), 0, 0);
	});
}
