import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateTail,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { pipe, PipeParam } from "../../lib/pipe";
import { SessionAlertMonitor, type SessionAlert } from "./alerts";
import {
	terminalServerName,
	tmuxAvailable,
	TmuxTerminalManager,
	type TerminalSnapshot,
	type TerminalSummary,
	type WaitResult,
} from "./tmux";

const Operations = ["view", "send", "send_raw", "end", "list"] as const;
const WaitModes = ["any", "all"] as const;
type Op = "spawn" | "wait" | typeof Operations[number];

const SpawnParameters = Type.Object({
	terminals: Type.Array(
		Type.Object({
			command: Type.String({ description: "Shell command to run inside the terminal." }),
			cwd: Type.Optional(Type.String({ description: "Working directory, relative to the current workspace by default." })),
			name: Type.Optional(Type.String({ description: "Memorable id using letters, numbers, underscore, or hyphen." })),
			notifyOnExit: Type.Optional(Type.Boolean({ description: "Wake the agent once when the process exits." })),
			notifyOnOutput: Type.Optional(Type.String({ description: "Wake the agent once when recent rendered terminal output contains this case-sensitive literal.", minLength: 1 })),
		}),
		{ minItems: 1, maxItems: 16, description: "Terminals to start, in parallel." },
	),
	pipe: PipeParam,
});

const WaitParameters = Type.Object({
	ids: Type.Array(Type.String(), { description: "Terminal ids to watch together.", minItems: 1, maxItems: 16 }),
	mode: Type.Optional(StringEnum(WaitModes, { description: "any returns on the first output change or exit; all returns once every terminal has exited. Defaults to any." })),
	cursors: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "Map of terminal id to cursor from previous views; detects changes since those cursors." })),
	waitMs: Type.Optional(Type.Number({ description: "Wait up to this many milliseconds. Maximum 30000; defaults to 30000." })),
	lines: Type.Optional(Type.Number({ description: "Trailing terminal lines to capture. Defaults to 200; maximum 2000." })),
	pipe: PipeParam,
});

const Parameters = Type.Object({
	op: StringEnum(Operations, { description: "Operation to perform." }),
	id: Type.Optional(Type.String({ description: "Terminal id returned by session_spawn or list." })),
	text: Type.Optional(Type.String({ description: "send: literal text to paste into the terminal." })),
	submit: Type.Optional(Type.Boolean({ description: "send: press Enter after pasting. Defaults to true." })),
	keys: Type.Optional(Type.Array(Type.String(), {
		description: "send_raw: named keys such as C-c, C-d, Enter, Escape, Up, or F1.",
		minItems: 1,
		maxItems: 32,
	})),
	lines: Type.Optional(Type.Number({ description: "view: trailing terminal lines to capture. Defaults to 200; maximum 2000." })),
	cursor: Type.Optional(Type.String({ description: "view: cursor from a previous view; return when output or status changes." })),
	waitMs: Type.Optional(Type.Number({ description: "view: wait up to this many milliseconds for a change. Maximum 30000; defaults to 0." })),
	pipe: PipeParam,
});

interface SessionDetails {
	op: Op;
	snapshot?: Omit<TerminalSnapshot, "output"> & { outputPreview: string };
	snapshots?: Array<Omit<TerminalSnapshot, "output"> & { outputPreview: string }>;
	sessions?: TerminalSummary[];
	ended?: TerminalSummary;
	fullOutputPath?: string;
	truncated?: boolean;
	wait?: {
		mode: typeof WaitModes[number];
		changed: string[];
		timedOut?: boolean;
		snapshots: Array<Omit<TerminalSnapshot, "output">>;
	};
}

function requireString(value: string | undefined, field: string): string {
	if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
	return value;
}

function summarize(snapshot: TerminalSnapshot): string {
	const state = snapshot.status === "running"
		? `running${snapshot.pid ? ` (pid ${snapshot.pid})` : ""}`
		: `exited${snapshot.exitCode === undefined ? "" : ` (${snapshot.exitCode})`}`;
	return `${snapshot.id}: ${state}`;
}

function summarizeArmedAlerts(terminal: Pick<TerminalSummary, "alerts">): string {
	const alerts: string[] = [];
	if (terminal.alerts?.exit?.state === "armed") alerts.push("exit");
	if (terminal.alerts?.output?.state === "armed") alerts.push(`output ${JSON.stringify(terminal.alerts.output.literal)}`);
	return alerts.length > 0 ? `\nAlerts: ${alerts.join(", ")}` : "";
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

async function renderOutput(snapshot: TerminalSnapshot): Promise<{
	output: string;
	preview: string;
	fullOutputPath?: string;
	truncated: boolean;
}> {
	const truncation = truncateTail(snapshot.output, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});
	let output = truncation.content || "(no terminal output)";
	let fullOutputPath: string | undefined;
	if (truncation.truncated) {
		const directory = await mkdtemp(join(tmpdir(), "pi-terminal-"));
		fullOutputPath = join(directory, `${snapshot.id}.log`);
		await writeFile(fullOutputPath, snapshot.output, "utf8");
		output += `\n\n[Output truncated: showing the latest ${truncation.outputLines} of ${truncation.totalLines} lines`;
		output += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
		output += ` Full captured output: ${fullOutputPath}]`;
	}
	return { output, preview: truncation.content, fullOutputPath, truncated: truncation.truncated };
}

/** With `through`, the untruncated output goes through bash instead of being capped. */
async function presentSnapshot(op: Op, snapshot: TerminalSnapshot, through?: { command: string; cwd: string }): Promise<{
	content: Array<{ type: "text"; text: string }>;
	details: SessionDetails;
}> {
	const { output, preview, fullOutputPath, truncated } = through
		? { output: pipe(snapshot.output, through.command, through.cwd), preview: "", fullOutputPath: undefined, truncated: false }
		: await renderOutput(snapshot);
	const timeout = snapshot.timedOut ? "\nNo change before the wait timeout." : "";
	const text = `${summarize(snapshot)}${summarizeArmedAlerts(snapshot)}\nCursor: ${snapshot.cursor}${timeout}\n\n${output}`;
	const { output: _fullOutput, ...metadata } = snapshot;
	return {
		content: [{ type: "text", text }],
		details: {
			op,
			snapshot: { ...metadata, outputPreview: preview },
			fullOutputPath,
			truncated,
		},
	};
}

async function presentWait(result: WaitResult, through?: { command: string; cwd: string }): Promise<{
	content: Array<{ type: "text"; text: string }>;
	details: SessionDetails;
}> {
	const header = result.timedOut
		? `No ${result.mode === "all" ? "completion" : "change"} before the wait timeout.`
		: result.mode === "all"
			? "All terminals have exited."
			: `Changed: ${result.changed.join(", ")}`;
	const summaries = result.snapshots
		.map((snapshot) => `- ${summarize(snapshot)}, cursor: ${snapshot.cursor}`)
		.join("\n");
	let text = `wait(${result.mode})\n${header}\n${summaries}`;

	let fullOutputPath: string | undefined;
	let truncated: boolean | undefined;
	const winner = result.mode === "any" && !result.timedOut
		? result.snapshots.find((snapshot) => snapshot.id === result.changed[0])
		: undefined;
	if (winner) {
		const rendered = through
			? { output: pipe(winner.output, through.command, through.cwd), fullOutputPath: undefined, truncated: false }
			: await renderOutput(winner);
		fullOutputPath = rendered.fullOutputPath;
		truncated = rendered.truncated;
		text += `\n\nOutput of ${winner.id}:\n\n${rendered.output}`;
	}

	return {
		content: [{ type: "text", text }],
		details: {
			op: "wait",
			wait: {
				mode: result.mode,
				changed: result.changed,
				timedOut: result.timedOut,
				snapshots: result.snapshots.map(({ output: _output, ...metadata }) => metadata),
			},
			fullOutputPath,
			truncated,
		},
	};
}

function formatList(sessions: TerminalSummary[]): string {
	if (sessions.length === 0) return "No terminal sessions for this Pi session.";
	return sessions.map((session) => {
		const status = session.status === "running"
			? `running${session.pid ? `, pid ${session.pid}` : ""}`
			: `exited${session.exitCode === undefined ? "" : `, code ${session.exitCode}`}`;
		const alerts = summarizeArmedAlerts(session);
		return `- ${session.id} (${status})\n  command: ${session.command || "(unknown)"}\n  cwd: ${session.cwd || "(unknown)"}${alerts}`;
	}).join("\n");
}

export default function (pi: ExtensionAPI) {
	let alertMonitor: SessionAlertMonitor | undefined;

	pi.on("session_start", (_event, ctx) => {
		alertMonitor?.stop();
		alertMonitor = undefined;
		if (!tmuxAvailable()) return;
		const manager = new TmuxTerminalManager(terminalServerName(ctx.sessionManager.getSessionId()));
		alertMonitor = new SessionAlertMonitor(manager, (alert) => sendSessionAlert(pi, alert));
		alertMonitor.start();
	});

	pi.on("session_shutdown", () => {
		alertMonitor?.stop();
		alertMonitor = undefined;
	});

	const managerFor = (ctx: { sessionManager: { getSessionId(): string } }) => {
		if (!tmuxAvailable()) throw new Error("tmux is required for the session tools but was not found on PATH");
		return new TmuxTerminalManager(terminalServerName(ctx.sessionManager.getSessionId()));
	};
	const through = (command: string | undefined, cwd: string) => (command ? { command, cwd } : undefined);

	const renderSnapshotResult = (details: SessionDetails, expanded: boolean, theme: Parameters<NonNullable<Parameters<ExtensionAPI["registerTool"]>[0]["renderResult"]>>[2]) => {
		const snaps = details.snapshots ?? (details.snapshot ? [details.snapshot] : []);
		const lines = snaps.map((snapshot) => {
			let text = theme.fg(snapshot.status === "running" ? "success" : "muted", summarize({ ...snapshot, output: snapshot.outputPreview }));
			if (expanded && snapshot.outputPreview) text += `\n${theme.fg("dim", snapshot.outputPreview)}`;
			return text;
		});
		if (details.truncated) lines[lines.length - 1] += theme.fg("warning", " (output truncated)");
		return new Text(lines.join("\n"), 0, 0);
	};

	pi.registerTool({
		name: "session_spawn",
		label: "Spawn Terminals",
		description: "Start one or more persistent interactive terminals (isolated tmux server), in parallel: long-running commands, servers, shells, REPLs. Each returns its id, status, cursor, and first output. notifyOnExit wakes the agent once when a process ends; notifyOnOutput once when recent output contains a literal. Prefer bash for short non-interactive commands.",
		promptSnippet: "Start persistent terminal processes, shells, and REPLs (several per call)",
		promptGuidelines: [
			"Use session_spawn for long-running or interactive terminal processes, listing every one you need in a single call; use bash for short commands that exit normally.",
			"Use notifyOnExit or notifyOnOutput only when continuing unrelated work. When waiting for readiness or completion in the current task, use session view or session_wait instead; notifications queue a follow-up turn and may arrive after the terminal is stopped.",
		],
		parameters: SpawnParameters,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const manager = managerFor(ctx);
			const snapshots = await Promise.all(params.terminals.map((t) => manager.spawn({
				command: requireString(t.command, "command"),
				cwd: resolve(ctx.cwd, t.cwd ?? "."),
				name: t.name,
				notifyOnExit: t.notifyOnExit,
				notifyOnOutput: t.notifyOnOutput,
				signal,
			})));
			if (params.terminals.some((t) => t.notifyOnExit || t.notifyOnOutput !== undefined)) alertMonitor?.start();
			const presented = await Promise.all(snapshots.map((snapshot) => presentSnapshot("spawn", snapshot, through(params.pipe, ctx.cwd))));
			return {
				content: [{ type: "text", text: presented.map((p) => p.content[0]!.text).join("\n\n---\n\n") }],
				details: {
					op: "spawn",
					snapshots: presented.map((p) => p.details.snapshot!),
					truncated: presented.some((p) => p.details.truncated),
					fullOutputPath: presented.map((p) => p.details.fullOutputPath).filter(Boolean).join(" "),
				} satisfies SessionDetails,
			};
		},
		renderCall(args, theme) {
			const ts = (args.terminals ?? []) as Array<{ command: string; name?: string }>;
			let text = theme.fg("toolTitle", theme.bold("session_spawn"));
			for (const t of ts) text += `\n  ${t.name ? theme.fg("muted", `${t.name}  `) : ""}${theme.fg("dim", t.command)}`;
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Starting terminals..."), 0, 0);
			const details = result.details as SessionDetails | undefined;
			if (!details) return new Text(theme.fg("error", "Spawn failed"), 0, 0);
			return renderSnapshotResult(details, expanded, theme);
		},
	});

	pi.registerTool({
		name: "session_wait",
		label: "Wait for Terminals",
		description: `Block on several terminals at once: mode any returns on the first output change or exit (with that terminal's output), mode all once every terminal has exited. Pass cursors from earlier views to detect changes since then. Captured output is limited to ${DEFAULT_MAX_LINES} lines and ${formatSize(DEFAULT_MAX_BYTES)} unless piped.`,
		promptSnippet: "Wait on several terminals for change or exit",
		promptGuidelines: ["Use session_wait to watch several terminals concurrently instead of polling them one by one."],
		parameters: WaitParameters,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const manager = managerFor(ctx);
			const result = await manager.waitMany({
				ids: params.ids,
				mode: params.mode ?? "any",
				cursors: params.cursors,
				waitMs: params.waitMs,
				lines: params.lines,
				signal,
			});
			return await presentWait(result, through(params.pipe, ctx.cwd));
		},
		renderCall(args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("session_wait ")) + theme.fg("accent", args.mode ?? "any") + ` ${theme.fg("muted", (args.ids ?? []).join(", "))}`, 0, 0);
		},
		renderResult(result, { isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Waiting for terminals..."), 0, 0);
			const details = result.details as SessionDetails | undefined;
			if (!details?.wait) return new Text(theme.fg("error", "Wait failed"), 0, 0);
			if (details.wait.timedOut) return new Text(theme.fg("warning", `wait(${details.wait.mode}) timed out`), 0, 0);
			const outcome = details.wait.mode === "all" ? "all exited" : `changed: ${details.wait.changed.join(", ")}`;
			return new Text(theme.fg("success", `wait(${details.wait.mode}) ${outcome}`), 0, 0);
		},
	});

	pi.registerTool({
		name: "session",
		label: "Terminal Session",
		description: `Drive terminals started with session_spawn. view for bounded output/status (waitMs to block for a change since cursor); send to paste normal text; send_raw only for control or navigation keys; end to terminate; list to rediscover ids. Captured output is limited to ${DEFAULT_MAX_LINES} lines and ${formatSize(DEFAULT_MAX_BYTES)} unless piped (\`pipe\` runs the full output through bash).`,
		promptSnippet: "View, type into, and end terminal sessions",
		promptGuidelines: [
			"Use session send for normal text and session send_raw only for control or navigation keys.",
		],
		parameters: Parameters,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const manager = managerFor(ctx);
			const via = through(params.pipe, ctx.cwd);
			switch (params.op) {
				case "view": {
					const snapshot = await manager.view({
						id: requireString(params.id, "id"),
						lines: params.lines,
						cursor: params.cursor,
						waitMs: params.waitMs,
						signal,
					});
					return await presentSnapshot("view", snapshot, via);
				}
				case "send": {
					if (params.text === undefined) throw new Error("text is required");
					const snapshot = await manager.send(
						requireString(params.id, "id"),
						params.text,
						params.submit ?? true,
						signal,
					);
					return await presentSnapshot("send", snapshot, via);
				}
				case "send_raw": {
					const snapshot = await manager.sendRaw(
						requireString(params.id, "id"),
						params.keys ?? [],
						signal,
					);
					return await presentSnapshot("send_raw", snapshot, via);
				}
				case "end": {
					const ended = await manager.end(requireString(params.id, "id"), signal);
					return {
						content: [{ type: "text", text: `Ended terminal session ${ended.id}.` }],
						details: { op: "end", ended } satisfies SessionDetails,
					};
				}
				case "list": {
					const sessions = await manager.list();
					const text = formatList(sessions);
					return {
						content: [{ type: "text", text: via ? pipe(text, via.command, via.cwd) : text }],
						details: { op: "list", sessions } satisfies SessionDetails,
					};
				}
			}
		},
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("session ")) + theme.fg("accent", args.op);
			if (args.id) text += ` ${theme.fg("muted", args.id)}`;
			if (args.op === "send" && args.text) text += `\n  ${theme.fg("dim", args.text.split("\n")[0]!.slice(0, 120))}`;
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Waiting for terminal..."), 0, 0);
			const details = result.details as SessionDetails | undefined;
			if (!details) return new Text(theme.fg("error", "Terminal operation failed"), 0, 0);
			if (details.sessions) return new Text(theme.fg("success", `${details.sessions.length} terminal session(s)`), 0, 0);
			if (details.ended) return new Text(theme.fg("success", `Ended ${details.ended.id}`), 0, 0);
			if (details.snapshot) return renderSnapshotResult(details, expanded, theme);
			return new Text(theme.fg("success", "Done"), 0, 0);
		},
	});
}
