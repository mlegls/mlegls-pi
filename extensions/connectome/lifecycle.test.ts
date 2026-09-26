import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import connectome from "./index";

function harness() {
	const root = mkdtempSync(join(tmpdir(), "connectome-test-"));
	mkdirSync(join(root, ".pi"));
	writeFileSync(join(root, ".pi/settings.json"), JSON.stringify({ connectome: { dir: root } }));
	const handlers: Record<string, Function> = {}, bus: Record<string, Function> = {}, commands: Record<string, any> = {};
	const entries: any[] = [];
	const ctx: any = {
		cwd: root, model: { id: "test-model", contextWindow: 100000 },
		sessionManager: { getSessionId: () => "source", getEntries: () => entries, getBranch: () => [] },
		ui: { setStatus() {}, notify() {} }, getSystemPrompt: () => "test",
	};
	connectome({
		on: (n: string, f: Function) => handlers[n] = f,
		events: { on: (n: string, f: Function) => bus[n] = f },
		registerCommand: (n: string, c: any) => commands[n] = c,
		appendEntry: (customType: string, data: any) => entries.push({ type: "custom", customType, data }),
		getAllTools: () => [], getActiveTools: () => [],
	} as any);
	const move = (source = ctx, id = "replacement") => {
		let entry: any;
		bus["workspace:handoff"]({ source, target: {
			getSessionId: () => id,
			appendCustomEntry: (customType: string, data: any) => entry = { type: "custom", customType, data },
		} });
		return entry;
	};
	return { root, ctx, handlers, bus, commands, move, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("workspace binding survives resume and repeated moves, but not forks or explicit identity changes", async () => {
	const h = harness();
	try {
		await h.handlers.session_start({}, h.ctx);
		await h.commands.connectome.handler("use @session", h.ctx);
		const first = h.move();
		const directory = first.data.workspace.directory;
		const replacement = { ...h.ctx, cwd: join(h.root, "other-project"), sessionManager: {
			getSessionId: () => "replacement", getEntries: () => [first],
		} };
		await h.handlers.session_start({}, replacement);
		expect(h.move(replacement, "third").data.workspace.directory).toBe(directory);
		const fork = { ...replacement, sessionManager: { ...replacement.sessionManager, getSessionId: () => "fork" } };
		await h.handlers.session_start({}, fork);
		expect(h.move(fork).data.workspace.directory).not.toBe(directory);
		await h.handlers.session_start({}, replacement);
		await h.commands.connectome.handler("use @session", replacement);
		expect(h.move(replacement).data.workspace.directory).not.toBe(directory);
	} finally { h.cleanup(); }
});

test("compile failure relinquishes context and compaction ownership without reopening on the next turn", async () => {
	const h = harness();
	const lives = (globalThis as any)[Symbol.for("mlegls.connectome.lives")] as Map<string, any>;
	let path = "", closes = 0, compiles = 0;
	try {
		await h.handlers.session_start({}, h.ctx);
		await h.commands.connectome.handler("use @session", h.ctx);
		path = join(h.move().data.workspace.directory, h.ctx.model.id);
		mkdirSync(path, { recursive: true });
		lives.set(path, { path, holder: { aborts: new Set() }, originals: new Map(), ingested: new Map(), cm: {
			sync() {}, tick: async () => {}, setSystemPrompt() {}, setToolDefinitions() {},
			compile: async () => { if (++compiles < 3) return { messages: [] }; throw new Error("over budget"); },
			getPendingWork: () => undefined, close: () => closes++,
		} });
		await h.handlers.context({ messages: [] }, h.ctx);
		expect(await h.handlers.session_before_compact()).toEqual({ cancel: true });
		const entry = h.move();
		await h.handlers.session_shutdown({ reason: "switch" });
		const replacement = { ...h.ctx, cwd: join(h.root, "elsewhere"), sessionManager: {
			getSessionId: () => "replacement", getEntries: () => [entry], getBranch: () => [],
		} };
		await h.handlers.session_start({}, replacement);
		await h.handlers.context({ messages: [] }, replacement);
		expect(closes).toBe(0);
		expect(await h.handlers.session_before_compact()).toEqual({ cancel: true });
		expect(await h.handlers.context({ messages: [] }, replacement)).toBeUndefined();
		expect(await h.handlers.session_before_compact()).toBeUndefined();
		const query: any = {};
		h.bus["connectome:query"](query);
		expect(query.active).toBe(false);
		await h.handlers.context({ messages: [] }, replacement);
		expect(compiles).toBe(3);
		expect(closes).toBe(1);
		expect(lives.has(path)).toBe(false);
	} finally { lives.delete(path); h.cleanup(); }
});
