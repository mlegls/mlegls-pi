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
import { Type, type Static, type TSchema } from "typebox";
import { dataTool } from "../tool";
import { Text } from "@earendil-works/pi-tui";
import { compileQuery, parseTags } from "./query";
import { logSize, meta, noteRead, read, readFrom, readReadEvents, send, topics, type Message } from "./store";
import { subscriberStatus } from "./subscribers";
import { parse } from "../report.ts";
import { mail, mailbox } from "./mailbox";
import { scopes } from "./scopes";
import { writeLiveSubscriptions, type BoardSubscription } from "../session-meta/live";
import { execFile } from "node:child_process";
import { readCursor, writeCursor } from "../records/cursor";
import { canonicalThread } from "../session-meta/host";

type Subscription = BoardSubscription;

const SUBS_ENTRY = "board-subs";
// Delivery state is a `cursor` record (lib/records/cursor, key CURSOR_KEY): written when pending
// or seen changes, so a resumed, navigated or forked session picks up from its branch. Sessions
// from before kept it in these custom entries, read when no record is visible.
const CURSOR_KEY = "board";
const LEGACY_CURSOR_ENTRY = "board-cursor";
const LEGACY_SEEN_ENTRY = "board-seen";
/** Acked ids kept in the cursor: only ids not yet past the cursor matter, so a window suffices. */
const SEEN_KEPT = 500;

interface DeliveryState {
	offset: number;
	pending: Message[];
	seen: string[];
}
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

/** The sender's mailbox, to answer with the mail tool. */
function replyHint(m: Message): string {
	const to = m.from.session ? mailbox(m.from.session) : m.from.name?.startsWith("mail/") ? m.from.name : undefined;
	return to ? `\nreply address: ${to}` : "";
}

function subKey(s: Subscription): string {
	return `${s.topic} :: ${s.tags ?? ""}`;
}

export function install(pi: ExtensionAPI) {
	let subs: Subscription[] = [];
	let cursor = 0; // records seq (lib/records/store)
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
		if (sessionId) writeLiveSubscriptions(sessionId, cwd, subs);
	}

	/** Add (or with remove, drop) a subscription; returns the resulting entry. Idempotent on topic×tags. */
	function subscribe(params: { topic: string; tags?: string; wake?: boolean; remove?: boolean }): Subscription {
		parseTags(params.tags);
		const sub: Subscription = { topic: params.topic, tags: params.tags || undefined, wake: params.wake ?? true };
		const key = subKey(sub);
		const fresh = !params.remove && !subs.some((s) => subKey(s) === key);
		subs = subs.filter((s) => subKey(s) !== key);
		if (!params.remove) subs.push(sub);
		rebuildMatchers();
		if (fresh && sub.topic.startsWith("role/")) takeOverRole(sub);
		persistSubs();
		return sub;
	}

	/** A role outlives the session holding it: its successor receives what no session acknowledged. */
	function takeOverRole(sub: Subscription) {
		const acked = new Set(readReadEvents().flatMap((e) => (e.action === "ack" ? e.ids ?? [] : [])));
		const match = compileQuery(sub);
		for (const m of read({ topic: sub.topic, limit: Infinity }).messages) {
			if (!acked.has(m.id) && !seen.has(m.id) && m.from.session !== sessionId && match(m.topic, m.tags)) pending.set(m.id, m);
		}
		persistDelivery();
	}

	pi.events.on("board:subscribe", (params) => {
		subscribe(params as Parameters<typeof subscribe>[0]);
	});

	const seen = new Set<string>();

	function persistDelivery() {
		if (!context) return;
		const state: DeliveryState = { offset: cursor, pending: [...pending.values()], seen: [...seen].slice(-SEEN_KEPT) };
		writeCursor(context.sessionManager, CURSOR_KEY, state);
	}

	function reader() {
		return { session: sessionId, name: label(), cwd };
	}

	/** Who a message is from, for its readers: the session's name, else a role it holds, a worker's
	 * handle, its first prompt, or its directory. Read at each send, so a later rename shows. */
	function label(): string {
		const role = subs.find((s) => s.topic.startsWith("role/"))?.topic.slice(5).replaceAll("/", " ");
		return pi.getSessionName() ?? role ?? own("PI_BOARD_NAME") ?? firstPrompt() ?? name;
	}

	/** Board identity from the environment is this session's only when it was launched as a thread or
	 * worker. A pi run from another session's tool (pi sets PI_SESSION_ID for those) inherits that
	 * session's identity and must not report as it. */
	function own(key: "PI_BOARD_NAME" | "PI_BOARD_TOPIC" | "PI_BOARD_FOLLOW"): string | undefined {
		const invoker = process.env.PI_SESSION_ID;
		return invoker && invoker !== sessionId ? undefined : process.env[key];
	}

	function firstPrompt(): string | undefined {
		for (const entry of context?.sessionManager.getBranch() ?? []) {
			const m = entry.type === "message" ? (entry.message as { role?: string; content?: unknown }) : undefined;
			if (m?.role !== "user") continue;
			const text = typeof m.content === "string" ? m.content
				: Array.isArray(m.content) ? m.content.map((c: { text?: string }) => c.text ?? "").join("") : "";
			// An invoked skill arrives expanded: name it, then what was asked of it.
			const skill = /^<skill name="([^"]+)"[\s\S]*?<\/skill>\s*/.exec(text);
			const line = ((skill ? "/" + skill[1] + " " : "") + text.slice(skill?.[0].length ?? 0)).trim().split("\n")[0]!;
			return line ? line.slice(0, 40) : undefined;
		}
	}

	function acknowledge(ids: string[]) {
		const fresh = ids.filter((id) => !seen.has(id));
		if (!fresh.length) return;
		for (const id of fresh) {
			seen.add(id);
			pending.delete(id);
		}
		noteRead({ action: "ack", reader: reader(), ids: fresh });
		persistDelivery();
	}

	pi.events.on("board:seen", (params) => {
		acknowledge((params as { ids: string[] }).ids);
	});

	function notification(messages: Message[]) {
		return {
			customType: "board",
			content: messages.map((m) => `[board] ${formatMessage(m)}${replyHint(m)}`).join("\n\n"),
			display: true,
			details: { messages },
		};
	}

	function collect() {
		const result = readFrom(cursor);
		if (result.offset === cursor) return;
		cursor = result.offset;
		const before = pending.size;
		for (const m of result.messages) {
			if (m.from.session === sessionId || seen.has(m.id)) continue;
			if (matchers.some((match) => match(m))) pending.set(m.id, m);
		}
		// A cursor that moved past nothing of ours needn't be written: replaying it re-filters.
		if (pending.size !== before) persistDelivery();
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
		name = own("PI_BOARD_NAME") ?? basename(ctx.cwd);
		let restoredCursor: number | undefined;
		let restoredSubs: Subscription[] | undefined;
		const state = readCursor<DeliveryState>(ctx.sessionManager, CURSOR_KEY);
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom") continue;
			if (entry.customType === SUBS_ENTRY) restoredSubs = (entry.data as Subscription[]) ?? [];
			if (state) continue;
			if (entry.customType === LEGACY_CURSOR_ENTRY) {
				const data = entry.data as number | { offset: number; pending: Message[] };
				restoredCursor = typeof data === "number" ? data : data.offset;
				pending.clear();
				if (typeof data !== "number") for (const m of data.pending) pending.set(m.id, m);
			}
			if (entry.customType === LEGACY_SEEN_ENTRY) for (const id of entry.data as string[]) seen.add(id);
		}
		if (state) {
			restoredCursor = state.offset;
			for (const m of state.pending) pending.set(m.id, m);
			for (const id of state.seen) seen.add(id);
		}
		// A resumed session catches up on what it missed; a new one starts at the tail.
		cursor = restoredCursor ?? logSize();
		// A spawned worker (PI_BOARD_TOPIC set by its parent) starts subscribed with wake to its own
		// topic, so the parent's follow-ups and needs-input answers reach it without it asking.
		subs = restoredSubs ?? [
			...(own("PI_BOARD_TOPIC") ? [{ topic: own("PI_BOARD_TOPIC")!, wake: true }] : []),
			// Decisions across its run (PI_BOARD_FOLLOW names the run) arrive on the next turn without waking it.
			...(own("PI_BOARD_FOLLOW") ? [{ topic: own("PI_BOARD_FOLLOW") + "/**", tags: "decision", wake: false }] : []),
		];
		// Every session has a mailbox (mail/xxxxxxxx): the reconciler, ab tree and
		// other sessions reach it there. Shown in pi's footer and, under tmux, the status bar.
		const box = mailbox(sessionId);
		// Plus the worktree and ticket it works in (lib/board/scopes): shared channels, on trial.
		const shared = scopes(ctx.cwd);
		for (const topic of [box, ...shared]) if (!subs.some((s) => s.topic === topic && !s.tags)) subs.push({ topic, wake: true });
		if (ctx.hasUI) ctx.ui.setStatus("mailbox", ["✉ " + box, ...shared.map((t) => "# " + t)].join("  "));
		if (process.env.TMUX_PANE) execFile("tmux", ["set", "-p", "-t", process.env.TMUX_PANE, "@mailbox", box], () => {});
		if (!restoredSubs || subs.length !== restoredSubs.length) persistSubs();
		else writeLiveSubscriptions(sessionId, cwd, subs);
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

	// A spawned worker reports by ending its turn: its last assistant message goes to its own topic,
	// tagged with the status it starts with (done/blocked/needs-input) or `turn-end` when it has none,
	// so the parent (wm's poller, children.turnEnd, a supervision loop) reads the report, not a pane.
	pi.on("agent_end", async (event, ctx) => {
		const assigned = own("PI_BOARD_TOPIC");
		const member = assigned ? undefined : await canonicalThread(ctx.sessionManager.getSessionId(), ctx.sessionManager.getSessionFile());
		const topic = assigned ?? (member && "thread/" + member.id);
		if (!topic) return;
		const last = [...event.messages].reverse().find((m) => (m as { role?: string }).role === "assistant") as { content?: unknown } | undefined;
		const content = last?.content;
		const text = typeof content === "string" ? content
			: Array.isArray(content) ? content.filter((c) => c?.type === "text").map((c) => c.text as string).join("\n") : "";
		if (!text.trim()) return;
		const status = parse(text).status;
		send({ topic, tags: [status ?? "turn-end"], from: reader(), body: text });
	});

	pi.on("session_shutdown", () => {
		persistDelivery();
		clearInterval(timer);
		timer = undefined;
	});

	const namespace = { name: "board", description: "Shared pubsub log for coordinating sessions: topics are paths, messages carry tags; every session has a mailbox topic mail/xxxxxxxx" };
	const tool = <P extends TSchema>(name: string, description: string, parameters: P, run: (params: Static<P>) => unknown, readOnly = false) =>
		dataTool(pi, { name, description, parameters, namespace, readOnly, run });
	const Tags = Type.Optional(Type.String({ description: "Tag expression: `a b` requires both, `a | b` either, `!a` excludes" }));

	tool("board_read", "Read messages matching topic glob (`run/**` includes the base topic and all descendants; `run/*` misses the base) and tags, newest `limit` kept (default 20). Reads do not acknowledge.",
		Type.Object({
			topic: Type.Optional(Type.String()), tags: Tags, limit: Type.Optional(Type.Number()),
			fields: Type.Optional(Type.Union([Type.Literal("full"), Type.Literal("meta")], { description: "meta: compact previews, body cut to bodyChars (default 120, 0 drops it)" })),
			bodyChars: Type.Optional(Type.Number()),
		}),
		(p) => {
			const result = read({ topic: p.topic, tags: p.tags, limit: p.limit });
			noteRead({ action: "read", reader: reader(), ids: result.messages.map((m) => m.id) });
			return p.fields === "meta" ? { ...result, messages: result.messages.map((m) => meta(m, p.bodyChars)) } : result;
		}, true);
	tool("board_send", "Post a message to a topic. A decision affecting peers goes on your topic tagged `decision` plus `path:<file>` per file it touches.",
		Type.Object({ topic: Type.String(), body: Type.String(), tags: Type.Optional(Type.Array(Type.String())), data: Type.Optional(Type.Any()) }),
		(p) => send({ topic: p.topic, body: p.body, tags: p.tags ?? [], from: reader(), ...(p.data !== undefined && { data: p.data }) }));
	tool("board_topics", "Topics with message counts and their latest tags, optionally under a glob.",
		Type.Object({ topic: Type.Optional(Type.String()) }), (p) => topics(p.topic), true);
	tool("board_subscribe", "Subscribe this session to topic × tags. Matching messages are injected into the session; with wake (default) they also start a turn when idle. remove drops it.",
		Type.Object({ topic: Type.String(), tags: Tags, wake: Type.Optional(Type.Boolean()), remove: Type.Optional(Type.Boolean()) }),
		(p) => ({ subscription: subscribe(p), subscriptions: subs }));
	tool("board_ack", "Acknowledge handled messages so subscriptions do not deliver them again.",
		Type.Object({ ids: Type.Array(Type.String()) }), (p) => { acknowledge(p.ids); return { acknowledged: p.ids.length }; });
	tool("mail", "Message a session's mailbox (mail/xxxxxxxx, bare xxxxxxxx, or a session id) or any topic, e.g. a worker's run/handle to answer or steer it. Signed with this session's mailbox so the reader can reply.",
		Type.Object({ to: Type.String(), body: Type.String() }), (p) => {
			const m = mail(p.to, p.body, { session: sessionId, name: label() });
			if (subscriberStatus(m.topic) !== "none") return m;
			const role = m.topic.startsWith("role/");
			return { ...m, warning: `No live session listens on ${m.topic}` + (role
				? "; it waits there for the next session to take the role."
				: "; it is delivered only if that session resumes. For a project's supervisor, mail role/<repo>/supervisor.") };
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

export { install as default };
