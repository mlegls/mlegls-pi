import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import board from "./index";
import { read, send } from "../../../lib/board/store";

type Handler = (event: unknown, ctx: ExtensionContext) => any;
type Entry = { type: "custom"; customType: string; data: unknown };
type Delivery = { message: { content: string }; options: { triggerTurn?: boolean } };

// Only the host boundaries used by board: real store, tool calls, events, and
// serialized custom entries. Polling is clocked explicitly, not by wall time.
function session(entries: Entry[] = []) {
	const handlers = new Map<string, Handler>();
	const bus = new Map<string, (event: unknown) => void>();
	const tools = new Map<string, { execute: (...args: any[]) => Promise<any> }>();
	const sent: Delivery[] = [];
	let idle = false;
	let poll: () => void = () => { throw new Error("session_start did not install polling"); };
	const ctx = {
		cwd: process.cwd(),
		isIdle: () => idle,
		sessionManager: { getBranch: () => entries, getSessionId: () => "reader" },
	} as unknown as ExtensionContext;
	const pi = {
		on: (name: string, handler: Handler) => handlers.set(name, handler),
		events: { on: (name: string, handler: (event: unknown) => void) => bus.set(name, handler) },
		appendEntry: (customType: string, data: unknown) => entries.push({ type: "custom", customType, data: structuredClone(data) }),
		registerTool: (tool: { name: string; execute: (...args: any[]) => Promise<any> }) => tools.set(tool.name, tool),
		registerCommand: () => {},
		registerMessageRenderer: () => {},
		sendMessage: (message: Delivery["message"], options: Delivery["options"]) => sent.push({ message, options }),
	} as unknown as ExtensionAPI;
	board(pi);
	globalThis.setInterval = ((callback: () => void) => {
		poll = callback;
		return { unref() {} };
	}) as unknown as typeof setInterval;
	globalThis.clearInterval = (() => {}) as typeof clearInterval;
	handlers.get("session_start")!({ type: "session_start" }, ctx);
	return {
		sent,
		poll: () => poll(),
		idle: () => { idle = true; },
		subscribe: (remove = false, wake = true) => bus.get("board:subscribe")!({ topic: "delivery/test", wake, remove }),
		seen: (ids: string[]) => bus.get("board:seen")!({ ids }),
		read: () => tools.get("board_read")!.execute("read", { topic: "delivery/test", mode: "full" }, undefined, undefined, ctx),
		turn: () => handlers.get("before_agent_start")?.({ type: "before_agent_start", prompt: "next turn", systemPrompt: "" }, ctx),
		reload: () => session(structuredClone(entries)),
	};
}

let dir: string;
let oldDir: string | undefined;
let oldTopic: string | undefined;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
beforeEach(() => {
	oldDir = process.env.PI_BOARD_DIR;
	oldTopic = process.env.PI_BOARD_TOPIC;
	dir = mkdtempSync(join(tmpdir(), "board-delivery-"));
	process.env.PI_BOARD_DIR = dir;
	delete process.env.PI_BOARD_TOPIC;
});
afterEach(() => {
	globalThis.setInterval = realSetInterval;
	globalThis.clearInterval = realClearInterval;
	if (oldDir === undefined) delete process.env.PI_BOARD_DIR;
	else process.env.PI_BOARD_DIR = oldDir;
	if (oldTopic === undefined) delete process.env.PI_BOARD_TOPIC;
	else process.env.PI_BOARD_TOPIC = oldTopic;
	rmSync(dir, { recursive: true, force: true });
});

function publish(body = "worker finished") {
	return send({ topic: "delivery/test", body, tags: ["done"], from: { session: "worker" } });
}

for (const consume of ["read", "seen"] as const) {
	test(`${consume} cancels a busy notification, including after reload`, async () => {
		let s = session();
		s.subscribe();
		const message = publish();
		s.poll();
		expect(s.sent).toHaveLength(0);
		if (consume === "read") {
			const result = await s.read();
			expect(result.content[0].text).toContain(message.body);
		} else s.seen([message.id]);
		s = s.reload();
		s.idle();
		s.poll();
		expect(s.sent).toHaveLength(0);
		expect(await s.turn()).toBeUndefined();
	});
}

test("unread wake report survives reload and wakes exactly once when idle", () => {
	let s = session();
	s.subscribe();
	const message = publish();
	s.poll();
	expect(s.sent).toHaveLength(0);
	s = s.reload();
	s.poll();
	expect(s.sent).toHaveLength(0);
	s.idle();
	s.poll();
	expect(s.sent).toHaveLength(1);
	expect(s.sent[0]!.message.content).toContain(message.body);
	expect(s.sent[0]!.options.triggerTurn).toBe(true);
	s.poll();
	expect(s.sent).toHaveLength(1);
	s = s.reload();
	s.idle();
	s.poll();
	expect(s.sent).toHaveLength(0);
});

test("quiet report survives reload without waking and joins the next natural turn", async () => {
	let s = session();
	s.subscribe(false, false);
	const message = publish();
	s.poll();
	expect(s.sent).toHaveLength(0);
	s = s.reload();
	s.idle();
	s.poll();
	expect(s.sent).toHaveLength(0);
	const result = await s.turn();
	expect(result?.message.customType).toBe("board");
	expect(result?.message.content).toContain(message.body);
	expect(await s.turn()).toBeUndefined();
	s = s.reload();
	expect(await s.turn()).toBeUndefined();
});

test("seen acknowledgment before polling survives reload without suppressing unread neighbors", () => {
	let s = session();
	s.subscribe();
	const consumed = publish("already shown");
	const unread = publish("still unread");
	const pulled = read({ topic: "delivery/test" }).messages;
	s.seen(pulled.filter((m) => m.id === consumed.id).map((m) => m.id));
	s = s.reload();
	s.idle();
	s.poll();
	expect(s.sent).toHaveLength(1);
	expect(s.sent[0]!.message.content).toContain(unread.body);
	expect(s.sent[0]!.message.content).not.toContain(consumed.body);
});

test("unsubscribe, idle prune, resubscribe, reload does not resurrect discarded pending", async () => {
	let s = session();
	s.subscribe();
	publish();
	s.poll();
	expect(s.sent).toHaveLength(0);
	s.subscribe(true);
	s.idle();
	s.poll();
	s.subscribe();
	s = s.reload();
	s.idle();
	s.poll();
	expect(s.sent).toHaveLength(0);
	expect(await s.turn()).toBeUndefined();
	const fresh = publish("new subscription report");
	s.poll();
	expect(s.sent).toHaveLength(1);
	expect(s.sent[0]!.message.content).toContain(fresh.body);
});
