import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bash from "./index";

test("shutdown discards detached completions before they access stale context", async () => {
	const previous = process.env.PI_TOOL_MODE;
	process.env.PI_TOOL_MODE = "bash";
	const dir = mkdtempSync(join(tmpdir(), "bash-lifecycle-"));
	const handlers: Record<string, Function> = {};
	const sent: unknown[] = [];
	let tool: any, stale = false, reads = 0;
	const ctx = {
		cwd: dir,
		hasPendingMessages: () => false,
		get sessionManager() {
			reads++;
			if (stale) throw new Error("stale context");
			return { getSessionFile: () => join(dir, "session.jsonl"), getSessionId: () => "test", buildContextEntries: () => [] };
		},
	};
	try {
		bash({ on: (name: string, fn: Function) => handlers[name] = fn, registerTool: (value: any) => tool = value,
			getActiveTools: () => [], setActiveTools() {}, appendEntry() {}, sendMessage: (value: unknown) => sent.push(value) } as any);
		await handlers.session_start({}, ctx);
		await tool.execute("test", { command: "echo started; sleep 30", wait: 0 }, undefined, undefined, ctx);
		await handlers.session_shutdown();
		stale = true;
		const before = reads;
		await Bun.sleep(800);
		expect(reads).toBe(before);
		expect(sent).toEqual([]);
	} finally {
		if (previous === undefined) delete process.env.PI_TOOL_MODE;
		else process.env.PI_TOOL_MODE = previous;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("cheap-model focused output bypasses ingress before collecting context", async () => {
	const previous = process.env.PI_TOOL_MODE;
	process.env.PI_TOOL_MODE = "bash";
	const dir = mkdtempSync(join(tmpdir(), "bash-ingress-policy-"));
	const handlers: Record<string, Function> = {};
	let tool: any;
	const ctx = {
		cwd: dir, model: { id: "gpt-6-luna" }, hasPendingMessages: () => false,
		sessionManager: {
			getSessionFile: () => join(dir, "session.jsonl"), getSessionId: () => "test",
			buildContextEntries() { throw new Error("bypassed reads must not collect judge context"); },
		},
	};
	try {
		bash({ on: (name: string, fn: Function) => handlers[name] = fn, registerTool: (value: any) => tool = value,
			getActiveTools: () => [], setActiveTools() {}, appendEntry() { throw new Error("unexpected filter event"); }, sendMessage() {} } as any);
		await handlers.session_start({}, ctx);
		const result = await tool.execute("test", { command: "printf '%0600d' 0", focus: "inspect exactly" }, undefined, undefined, ctx);
		expect(result.content[0].text).toBe("0".repeat(600));
	} finally {
		await handlers.session_shutdown?.();
		if (previous === undefined) delete process.env.PI_TOOL_MODE;
		else process.env.PI_TOOL_MODE = previous;
		rmSync(dir, { recursive: true, force: true });
	}
});
