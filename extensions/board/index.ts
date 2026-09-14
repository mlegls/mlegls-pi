// Board: a shared pubsub log for coordinating pi sessions and scripts.
//
// Topics are paths (`compile/run-3/unit-a`), messages carry tags, and a session
// subscribes to `topic glob × tag expression`. Matching messages are injected
// into the session; `wake` subscriptions also start a turn, so an idle parent
// hears its children finish and a session hears decisions that touch its area.
// Everything else is pull: read/list never wake anyone.

import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { truncateHead, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { compileQuery, parseTags } from "./query";
import { logSize, read, readFrom, send, topics, type Message, type Numbered } from "./store";

interface Subscription {
	topic: string;
	tags?: string;
	wake: boolean;
}

const SUBS_ENTRY = "board-subs";
const CURSOR_ENTRY = "board-cursor";
const POLL_MS = 1000;

const MAX_BYTES = 50_000;

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

/** One line per message: head, then the first line of the body. */
function formatBrief(m: Numbered): string {
	return `${formatHead(m)}  ${m.body.split("\n")[0]!.slice(0, 120)}`;
}

/** Full render, newest kept within the byte budget; says how many older ones were cut. */
function renderFull(messages: Numbered[]): string {
	const parts: string[] = [];
	let bytes = 0;
	let i = messages.length;
	while (i > 0) {
		const part = formatMessage(messages[i - 1]!);
		bytes += Buffer.byteLength(part) + 2;
		if (bytes > MAX_BYTES && parts.length) break;
		parts.unshift(part);
		i--;
	}
	if (i > 0) parts.unshift(`[${i} earlier messages (#${messages[0]!.line}-#${messages[i - 1]!.line}) cut for size; use mode:json with a pipe]`);
	return parts.join("\n\n");
}

function render(messages: Numbered[], mode: "full" | "brief" | "json"): string {
	if (mode === "json") return messages.map((m) => JSON.stringify(m)).join("\n");
	if (mode === "brief") return messages.map(formatBrief).join("\n");
	return renderFull(messages);
}

function pipe(text: string, command: string, cwd: string): string {
	const r = spawnSync("bash", ["-c", command], { input: text, cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
	if (r.error) throw r.error;
	if (r.status !== 0) throw new Error(`pipe exited ${r.status}: ${r.stderr.trim()}`);
	const t = truncateHead(r.stdout, { maxBytes: MAX_BYTES, maxLines: Number.MAX_SAFE_INTEGER });
	return t.truncated ? `${t.content}\n[pipe output truncated: ${t.outputLines} of ${t.totalLines} lines]` : t.content;
}

function subKey(s: Subscription): string {
	return `${s.topic} :: ${s.tags ?? ""}`;
}

export default function (pi: ExtensionAPI) {
	let subs: Subscription[] = [];
	let cursor = 0; // byte offset into the log
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

	function deliver(m: Message, wake: boolean) {
		pi.sendMessage(
			{
				customType: "board",
				content: `[board] ${formatMessage(m)}`,
				display: true,
				details: m,
			},
			{ triggerTurn: wake, deliverAs: "followUp" },
		);
	}

	function poll() {
		const result = readFrom(cursor);
		if (result.offset === cursor) return;
		cursor = result.offset;
		pi.appendEntry(CURSOR_ENTRY, cursor);
		for (const m of result.messages) {
			if (m.from.session === sessionId) continue;
			let wake = false;
			let hit = false;
			matchers.forEach((match, i) => {
				if (!match(m)) return;
				hit = true;
				if (subs[i]!.wake) wake = true;
			});
			if (hit) deliver(m, wake);
		}
	}

	function restore(ctx: ExtensionContext) {
		sessionId = ctx.sessionManager.getSessionId();
		cwd = ctx.cwd;
		name = process.env.PI_BOARD_NAME ?? basename(ctx.cwd);
		let restoredCursor: number | undefined;
		let restoredSubs: Subscription[] | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom") continue;
			if (entry.customType === SUBS_ENTRY) restoredSubs = (entry.data as Subscription[]) ?? [];
			if (entry.customType === CURSOR_ENTRY) restoredCursor = entry.data as number;
		}
		// A resumed session catches up on what it missed; a new one starts at the tail.
		cursor = restoredCursor ?? logSize();
		// A spawned worker (PI_BOARD_TOPIC set by its parent) starts subscribed with wake to its own
		// topic, so the parent's follow-ups and needs-input answers reach it without it asking.
		subs = restoredSubs ?? (process.env.PI_BOARD_TOPIC ? [{ topic: process.env.PI_BOARD_TOPIC, wake: true }] : []);
		if (!restoredSubs && subs.length) persistSubs();
		rebuildMatchers();
	}

	pi.on("session_start", (_event, ctx) => {
		restore(ctx);
		clearInterval(timer);
		timer = setInterval(poll, POLL_MS);
		timer.unref?.();
	});

	pi.on("session_shutdown", () => {
		clearInterval(timer);
		timer = undefined;
	});

	const TagsParam = Type.Optional(Type.String({
		description: "Tag expression: `done | (blocked & !retry)`. `!` > `&` > `|`; `,` = `&`. Empty matches all.",
	}));
	const TopicParam = Type.Optional(Type.String({
		description: "Topic glob: `*` one segment, `**` any. Default `**`.",
	}));

	pi.registerTool({
		name: "board_send",
		label: "Board Send",
		description: "Publish a message to a board topic. Tags classify it (kind:decision, done, blocked, needs-input, ...). Subscribers whose topic×tag query matches receive it; other sessions can pull it with board_read.",
		promptSnippet: "Publish to the shared board",
		promptGuidelines: [
			"Publish decisions that affect other sessions' areas to the board with tags like kind:decision and the paths they touch, rather than assuming the other session will notice.",
			"When finishing delegated work, publish a done message (with structured data if a schema was requested) to the topic named in the task.",
		],
		parameters: Type.Object({
			topic: Type.String({ description: "Path-like topic, e.g. compile/run-3/unit-a." }),
			body: Type.String(),
			tags: Type.Optional(Type.Array(Type.String())),
			data: Type.Optional(Type.Unknown({ description: "Optional structured payload." })),
		}),
		async execute(_id, params) {
			const message = send({
				topic: params.topic,
				body: params.body,
				tags: params.tags ?? [],
				data: params.data,
				from: { session: sessionId, name, cwd },
			});
			return { content: [{ type: "text", text: `sent ${message.id} → ${message.topic}` }], details: message };
		},
	});

	pi.registerTool({
		name: "board_read",
		label: "Board Read",
		description: "Pull messages from the board by topic glob and tag expression. Never wakes anyone. Each message carries `line`, its position in the log (shown as `#n`). `mode` picks full (default), brief (one line each), or json (one object per line); `pipe` runs the rendered text through a bash command, e.g. `jq -c 'select(.line > 400)'` or `rg deploy`. Output is capped at 50KB.",
		promptSnippet: "Read board messages",
		parameters: Type.Object({
			topic: TopicParam,
			tags: TagsParam,
			mode: Type.Optional(Type.Union([Type.Literal("full"), Type.Literal("brief"), Type.Literal("json")], { description: "Default full." })),
			pipe: Type.Optional(Type.String({ description: "bash command; rendered messages on stdin. Lifts the default limit." })),
			limit: Type.Optional(Type.Number({ description: "Default 20 (unbounded with pipe); the newest are kept." })),
		}),
		async execute(_id, params) {
			parseTags(params.tags); // validate early for a clean error
			const { messages, omitted } = read({ ...params, limit: params.limit ?? (params.pipe ? Infinity : 20) });
			let text = messages.length ? render(messages, params.mode ?? "full") : "";
			if (params.pipe) text = pipe(text, params.pipe, cwd);
			if (!text) text = "(no messages)";
			if (omitted) text += `\n(+${omitted} earlier; raise limit)`;
			return { content: [{ type: "text", text }], details: { count: messages.length, omitted, messages: params.pipe ? undefined : messages } };
		},
	});

	pi.registerTool({
		name: "board_list",
		label: "Board List",
		description: "List board topics (count, last activity, last tags) matching a glob, plus this session's subscriptions.",
		promptSnippet: "List board topics and subscriptions",
		parameters: Type.Object({ topic: TopicParam }),
		async execute(_id, params) {
			const summary = topics(params.topic);
			const lines = summary.map((t) => `${t.topic}  ${t.count}  ${t.lastTs.slice(0, 19)}  [${t.lastTags.join(" ")}]${t.lastFrom ? ` <${t.lastFrom}>` : ""}`);
			const subLines = subs.map((s) => `${s.wake ? "wake" : "quiet"}  ${subKey(s)}`);
			const text = [
				lines.length ? lines.join("\n") : "(no topics)",
				"",
				`subscriptions (${name}):`,
				subLines.length ? subLines.join("\n") : "(none)",
			].join("\n");
			return { content: [{ type: "text", text }], details: { topics: summary, subscriptions: subs } };
		},
	});

	pi.registerTool({
		name: "board_subscribe",
		label: "Board Subscribe",
		description: "Subscribe this session to topic glob × tag expression. Matching messages are injected into the session; wake (default true) also starts a turn when idle. Persists across resume. remove:true drops the exact subscription.",
		promptSnippet: "Subscribe to board topics",
		promptGuidelines: [
			"After delegating work, subscribe with wake to the topic the workers report on, so you are woken when they finish or block instead of polling.",
			"Subscribe quietly (wake:false) to topics you want in context next turn but that should not interrupt you.",
		],
		parameters: Type.Object({
			topic: Type.String({ description: "Topic glob." }),
			tags: TagsParam,
			wake: Type.Optional(Type.Boolean({ description: "Start a turn on match. Default true." })),
			remove: Type.Optional(Type.Boolean()),
		}),
		async execute(_id, params) {
			parseTags(params.tags);
			const sub: Subscription = { topic: params.topic, tags: params.tags || undefined, wake: params.wake ?? true };
			const key = subKey(sub);
			subs = subs.filter((s) => subKey(s) !== key);
			if (!params.remove) subs.push(sub);
			rebuildMatchers();
			persistSubs();
			const text = `${params.remove ? "unsubscribed" : "subscribed"} ${sub.wake ? "wake" : "quiet"} ${key}\n${subs.length} active`;
			return { content: [{ type: "text", text }], details: { subscriptions: subs } };
		},
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
		const m = message.details as Message | undefined;
		if (!m) return new Text(message.content as string, 0, 0);
		const head = theme.fg("accent", `board ${m.topic}`) + (m.tags.length ? theme.fg("muted", ` [${m.tags.join(" ")}]`) : "") + (m.from.name ? theme.fg("muted", ` <${m.from.name}>`) : "");
		const body = expanded ? formatMessage(m) : m.body.split("\n")[0]!.slice(0, 120);
		return new Text(`${head}\n${body}`, 0, 0);
	});
}
