import { afterEach, describe, expect, test } from "bun:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionAlertMonitor, type SessionAlert } from "./alerts";
import sessionExtension from "./index";
import { terminalServerName, TmuxTerminalManager, tmuxAvailable } from "./tmux";

const managers: TmuxTerminalManager[] = [];

function manager(): TmuxTerminalManager {
	const instance = new TmuxTerminalManager(`pi-terminal-alert-test-${randomUUID().slice(0, 12)}`);
	managers.push(instance);
	return instance;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate() && Date.now() < deadline) {
		await sleep(20);
	}
	if (!predicate()) throw new Error("Timed out waiting for terminal alert");
}

afterEach(async () => {
	await Promise.all(managers.splice(0).map((instance) => instance.killServer()));
});

interface RegisteredSessionTool {
	name: string;
	execute: (
		toolCallId: string,
		params: { op: "spawn"; command: string; name: string; notifyOnExit: boolean },
		signal: AbortSignal,
		onUpdate: undefined,
		ctx: unknown,
	) => Promise<unknown>;
}

interface SentMessage {
	message: { customType: string; content: string; details: Record<string, unknown> };
	options: { triggerTurn?: boolean; deliverAs?: string };
}

describe.skipIf(!tmuxAvailable())("SessionAlertMonitor", () => {
	test("alerts once when output contains the configured literal", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-alert-test-"));
		const alerts: SessionAlert[] = [];
		await instance.spawn({
			command: "printf 'READY one\\n'; sleep 0.1; printf 'READY two\\n'; sleep 0.2",
			cwd,
			name: "output-alert",
			notifyOnOutput: "READY",
		});

		const monitor = new SessionAlertMonitor(instance, (alert) => { alerts.push(alert); }, 20);
		monitor.start();
		await waitFor(() => alerts.length === 1);
		await sleep(300);
		monitor.stop();

		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.kind).toBe("output");
		expect(alerts[0]?.literal).toBe("READY");
		expect(alerts[0]?.matchedLine).toContain("READY");
		expect((await instance.list())[0]?.alerts?.output?.state).toBe("fired");
	});

	test("restores an exit alert after the process has already exited", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-alert-test-"));
		const alerts: SessionAlert[] = [];
		await instance.spawn({
			command: "printf 'finished\\n'",
			cwd,
			name: "exit-alert",
			notifyOnExit: true,
		});
		await instance.view({ id: "exit-alert", waitMs: 2_000 });

		await new SessionAlertMonitor(instance, (alert) => { alerts.push(alert); }).scanOnce();
		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.kind).toBe("exit");
		expect(alerts[0]?.snapshot.exitCode).toBe(0);
		expect(alerts[0]?.snapshot.output).toContain("finished");

		await new SessionAlertMonitor(instance, (alert) => { alerts.push(alert); }).scanOnce();
		expect(alerts).toHaveLength(1);
		expect((await instance.list())[0]?.alerts?.exit?.state).toBe("fired");
	});

	test("does not alert when the terminal is explicitly ended", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-alert-test-"));
		const alerts: SessionAlert[] = [];
		await instance.spawn({ command: "sleep 30", cwd, name: "ended", notifyOnExit: true });
		const monitor = new SessionAlertMonitor(instance, (alert) => { alerts.push(alert); }, 20);
		monitor.start();
		await instance.end("ended");
		await sleep(100);
		monitor.stop();

		expect(alerts).toEqual([]);
		expect(await instance.list()).toEqual([]);
	});

	test("returns immediately and wakes the agent after exit", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-alert-test-"));
		const piSessionId = randomUUID();
		const instance = new TmuxTerminalManager(terminalServerName(piSessionId));
		managers.push(instance);
		const handlers = new Map<string, unknown>();
		const messages: SentMessage[] = [];
		let tool: RegisteredSessionTool | undefined;
		sessionExtension({
			on(event: string, handler: unknown) {
				handlers.set(event, handler);
			},
			registerTool(candidate: RegisteredSessionTool) {
				tool = candidate;
			},
			sendMessage(message: SentMessage["message"], options: SentMessage["options"]) {
				messages.push({ message, options });
			},
		} as unknown as ExtensionAPI);
		const ctx = {
			cwd,
			sessionManager: { getSessionId: () => piSessionId },
		};
		const start = handlers.get("session_start") as ((event: unknown, context: unknown) => void) | undefined;
		const shutdown = handlers.get("session_shutdown") as (() => void) | undefined;
		expect(start).toBeDefined();
		expect(shutdown).toBeDefined();
		expect(tool).toBeDefined();
		start?.({}, ctx);

		await tool?.execute("call-1", {
			op: "spawn",
			command: "sleep 0.2; printf 'complete\\n'",
			name: "extension-alert",
			notifyOnExit: true,
		}, new AbortController().signal, undefined, ctx);
		expect(messages).toHaveLength(0);
		await waitFor(() => messages.length === 1);
		shutdown?.();

		expect(messages[0]?.message.customType).toBe("session-alert");
		expect(messages[0]?.message.content).toContain("extension-alert: exited (0)");
		expect(messages[0]?.message.content).toContain("complete");
		expect(messages[0]?.message.details).toMatchObject({ kind: "exit", id: "extension-alert", exitCode: 0 });
		expect(messages[0]?.options).toEqual({ triggerTurn: true, deliverAs: "followUp" });
	});
});
