import { resolve } from "node:path";
import { truncateTail, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SessionAlertMonitor, type SessionAlert } from "./alerts";
import { terminalServerName, tmuxAvailable, TmuxTerminalManager, type TerminalSnapshot, type TerminalSummary, type WaitResult } from "./tmux";

export type TerminalResult = TerminalSnapshot | TerminalSnapshot[] | TerminalSummary | TerminalSummary[] | WaitResult | { id: string; ended: true };

/** Host-only event bus seam. args are the positional arguments of term[method](...). */
export interface TerminalRequest {
	method: string;
	args: unknown[];
	signal?: AbortSignal;
	handled?: boolean;
	resolve(result: TerminalResult): void;
	reject(error: unknown): void;
}

function object(value: unknown, field: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
	return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
	return value;
}

function strings(value: unknown, field: string, max: number): string[] {
	if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new Error(`${field} must contain between 1 and ${max} entries`);
	return value.map((entry) => string(entry, field));
}

type Primitive = { string: string; number: number; boolean: boolean };
function optional<T extends keyof Primitive>(value: unknown, field: string, type: T): Primitive[T] | undefined {
	if (value !== undefined && (typeof value !== type || (type === "number" && !Number.isFinite(value)))) throw new Error(`${field} must be a ${type}`);
	return value as Primitive[T] | undefined;
}

function summarize(snapshot: TerminalSnapshot): string {
	const state = snapshot.status === "running"
		? `running${snapshot.pid ? ` (pid ${snapshot.pid})` : ""}`
		: `exited${snapshot.exitCode === undefined ? "" : ` (${snapshot.exitCode})`}`;
	return `${snapshot.id}: ${state}`;
}

function sendSessionAlert(pi: ExtensionAPI, alert: SessionAlert): void {
	const tail = truncateTail(alert.snapshot.output, { maxLines: 50, maxBytes: 5_000 });
	const heading = alert.kind === "exit"
		? `${summarize(alert.snapshot)}.`
		: `${alert.snapshot.id}: output matched ${JSON.stringify(alert.literal)}.`;
	const matched = alert.matchedLine ? `\nMatched line: ${alert.matchedLine.slice(0, 1_000)}` : "";
	const output = tail.content ? `\n\nRecent terminal output:\n${tail.content}` : "";
	const truncated = tail.truncated ? "\n[Output truncated.]" : "";
	pi.sendMessage({
		customType: "session-alert",
		content: `${heading}${matched}${output}${truncated}`,
		display: true,
		details: {
			kind: alert.kind,
			id: alert.snapshot.id,
			literal: alert.literal,
			exitCode: alert.snapshot.exitCode,
			command: alert.snapshot.command,
			cwd: alert.snapshot.cwd,
			cursor: alert.snapshot.cursor,
		},
	}, { triggerTurn: true, deliverAs: "followUp" });
}

/** Owns the tmux/alert lifecycle independently of the disposable exec kernel. */
export default function (pi: ExtensionAPI) {
	let context: ExtensionContext | undefined;
	let manager: TmuxTerminalManager | undefined;
	let alertMonitor: SessionAlertMonitor | undefined;
	let generation = new AbortController();

	pi.on("session_start", (_event, ctx) => {
		generation.abort();
		generation = new AbortController();
		alertMonitor?.stop();
		alertMonitor = undefined;
		manager = undefined;
		context = ctx;
		if (!tmuxAvailable()) return;
		manager = new TmuxTerminalManager(terminalServerName(ctx.sessionManager.getSessionId()));
		alertMonitor = new SessionAlertMonitor(manager, (alert) => sendSessionAlert(pi, alert));
		alertMonitor.start();
	});

	pi.on("session_shutdown", () => {
		generation.abort();
		alertMonitor?.stop();
		alertMonitor = undefined;
		manager = undefined;
		context = undefined;
		// Do not kill the server: terminal ids, processes and alert state survive restoration.
	});

	pi.on("session_tree", (_event, ctx) => {
		generation.abort();
		generation = new AbortController();
		context = ctx;
	});

	async function call(method: string, args: unknown[], signal?: AbortSignal): Promise<TerminalResult> {
		signal = signal ? AbortSignal.any([signal, generation.signal]) : generation.signal;
		signal?.throwIfAborted();
		if (!context) throw new Error("Terminal service has no active Pi session");
		if (!manager) throw new Error("tmux is required for term but was not found on PATH");
		const currentManager = manager;
		const currentMonitor = alertMonitor;
		const cwd = context.cwd;
		if (!Array.isArray(args)) throw new Error("term arguments must be positional");
		switch (method) {
			case "spawn": {
				const { terminals } = object(args[0], "spawn options");
				if (!Array.isArray(terminals) || terminals.length === 0 || terminals.length > 16) throw new Error("terminals must contain between 1 and 16 entries");
				const options = terminals.map((value) => {
					const t = object(value, "terminal");
					return {
						command: string(t.command, "command"),
						cwd: resolve(cwd, optional(t.cwd, "cwd", "string") ?? "."),
						name: optional(t.name, "name", "string"),
						notifyOnExit: optional(t.notifyOnExit, "notifyOnExit", "boolean"),
						notifyOnOutput: optional(t.notifyOnOutput, "notifyOnOutput", "string"),
						signal,
					};
				});
				return await Promise.all(options.map(async (t) => {
					try { return await currentManager.spawn(t); }
					finally {
						// A cancelled or partially failed spawn may already have armed alerts.
						if (currentMonitor === alertMonitor && (t.notifyOnExit || t.notifyOnOutput !== undefined)) currentMonitor?.start();
					}
				}));
			}
			case "wait": {
				const options = object(args[0], "wait options");
				const mode = options.mode ?? "any";
				if (mode !== "any" && mode !== "all") throw new Error("mode must be any or all");
				const cursors = options.cursors === undefined ? undefined : object(options.cursors, "cursors");
				if (cursors) for (const value of Object.values(cursors)) optional(value, "cursor", "string");
				return await currentManager.waitMany({
					ids: strings(options.ids, "ids", 16), mode,
					cursors: cursors as Record<string, string> | undefined,
					waitMs: optional(options.waitMs, "waitMs", "number"),
					lines: optional(options.lines, "lines", "number"), signal,
				});
			}
			case "view": {
				const options = object(args[1] ?? {}, "view options");
				return await currentManager.view({
					id: string(args[0], "id"),
					cursor: optional(options.cursor, "cursor", "string"),
					waitMs: optional(options.waitMs, "waitMs", "number"),
					lines: optional(options.lines, "lines", "number"), signal,
				});
			}
			case "send": {
				const options = object(args[2] ?? {}, "send options");
				if (typeof args[1] !== "string") throw new Error("text is required");
				return await currentManager.send(string(args[0], "id"), args[1], optional(options.submit, "submit", "boolean") ?? true, signal);
			}
			case "sendRaw": return await currentManager.sendRaw(string(args[0], "id"), strings(args[1], "keys", 32), signal);
			case "end": {
				const previous = await currentManager.end(string(args[0], "id"), signal);
				return { id: previous.id, ended: true };
			}
			case "list": return await currentManager.list();
			default: throw new Error(`${method} is not a terminal method`);
		}
	}

	pi.events.on("term:request", (payload) => {
		const request = payload as TerminalRequest;
		request.handled = true;
		void call(request.method, request.args, request.signal).then(request.resolve, request.reject);
	});
}
