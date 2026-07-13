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
import {
	terminalServerName,
	tmuxAvailable,
	TmuxTerminalManager,
	type TerminalSnapshot,
	type TerminalSummary,
} from "./tmux";

const Operations = ["spawn", "view", "send", "send_raw", "end", "list"] as const;
const Parameters = Type.Object({
	op: StringEnum(Operations, { description: "Operation to perform." }),
	id: Type.Optional(Type.String({ description: "Terminal id returned by spawn or list." })),
	command: Type.Optional(Type.String({ description: "spawn: shell command to run inside the terminal." })),
	cwd: Type.Optional(Type.String({ description: "spawn: working directory, relative to the current workspace by default." })),
	name: Type.Optional(Type.String({ description: "spawn: memorable id using letters, numbers, underscore, or hyphen." })),
	text: Type.Optional(Type.String({ description: "send: literal text to paste into the terminal." })),
	submit: Type.Optional(Type.Boolean({ description: "send: press Enter after pasting. Defaults to true." })),
	keys: Type.Optional(Type.Array(Type.String(), {
		description: "send_raw: named keys such as C-c, C-d, Enter, Escape, Up, or F1.",
		minItems: 1,
		maxItems: 32,
	})),
	lines: Type.Optional(Type.Number({ description: "view: trailing terminal lines to capture. Defaults to 200; maximum 2000." })),
	cursor: Type.Optional(Type.String({ description: "view: cursor from a previous view; return when output or status changes." })),
	waitMs: Type.Optional(Type.Number({ description: "view: wait up to this many milliseconds for a change. Maximum 30000." })),
});

interface SessionDetails {
	op: typeof Operations[number];
	snapshot?: Omit<TerminalSnapshot, "output"> & { outputPreview: string };
	sessions?: TerminalSummary[];
	ended?: TerminalSummary;
	fullOutputPath?: string;
	truncated?: boolean;
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

async function presentSnapshot(op: typeof Operations[number], snapshot: TerminalSnapshot): Promise<{
	content: Array<{ type: "text"; text: string }>;
	details: SessionDetails;
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
	const timeout = snapshot.timedOut ? "\nNo change before the wait timeout." : "";
	const text = `${summarize(snapshot)}\nCursor: ${snapshot.cursor}${timeout}\n\n${output}`;
	const { output: _fullOutput, ...metadata } = snapshot;
	return {
		content: [{ type: "text", text }],
		details: {
			op,
			snapshot: { ...metadata, outputPreview: truncation.content },
			fullOutputPath,
			truncated: truncation.truncated,
		},
	};
}

function formatList(sessions: TerminalSummary[]): string {
	if (sessions.length === 0) return "No terminal sessions for this Pi session.";
	return sessions.map((session) => {
		const status = session.status === "running"
			? `running${session.pid ? `, pid ${session.pid}` : ""}`
			: `exited${session.exitCode === undefined ? "" : `, code ${session.exitCode}`}`;
		return `- ${session.id} (${status})\n  command: ${session.command || "(unknown)"}\n  cwd: ${session.cwd || "(unknown)"}`;
	}).join("\n");
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "session",
		label: "Terminal Session",
		description: `Manage persistent interactive terminals backed by an isolated tmux server. Use spawn for long-running commands, servers, shells, and REPLs; view for bounded output/status; send to paste normal text; send_raw only for control or navigation keys; end to terminate; list to rediscover ids. Prefer bash for short non-interactive commands. Captured output is limited to ${DEFAULT_MAX_LINES} lines and ${formatSize(DEFAULT_MAX_BYTES)}.`,
		promptSnippet: "Manage persistent terminal processes, shells, and REPLs",
		promptGuidelines: [
			"Use session for long-running or interactive terminal processes; use bash for short commands that exit normally.",
			"Use session send for normal text and session send_raw only for control or navigation keys.",
		],
		parameters: Parameters,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (!tmuxAvailable()) throw new Error("tmux is required for the session tool but was not found on PATH");
			const manager = new TmuxTerminalManager(terminalServerName(ctx.sessionManager.getSessionId()));
			switch (params.op) {
				case "spawn": {
					const snapshot = await manager.spawn({
						command: requireString(params.command, "command"),
						cwd: resolve(ctx.cwd, params.cwd ?? "."),
						name: params.name,
						signal,
					});
					return await presentSnapshot("spawn", snapshot);
				}
				case "view": {
					const snapshot = await manager.view({
						id: requireString(params.id, "id"),
						lines: params.lines,
						cursor: params.cursor,
						waitMs: params.waitMs,
						signal,
					});
					return await presentSnapshot("view", snapshot);
				}
				case "send": {
					if (params.text === undefined) throw new Error("text is required");
					const snapshot = await manager.send(
						requireString(params.id, "id"),
						params.text,
						params.submit ?? true,
						signal,
					);
					return await presentSnapshot("send", snapshot);
				}
				case "send_raw": {
					const snapshot = await manager.sendRaw(
						requireString(params.id, "id"),
						params.keys ?? [],
						signal,
					);
					return await presentSnapshot("send_raw", snapshot);
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
					return {
						content: [{ type: "text", text: formatList(sessions) }],
						details: { op: "list", sessions } satisfies SessionDetails,
					};
				}
			}
		},
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("session ")) + theme.fg("accent", args.op);
			if (args.id) text += ` ${theme.fg("muted", args.id)}`;
			else if (args.name) text += ` ${theme.fg("muted", args.name)}`;
			if (args.op === "spawn" && args.command) text += `\n  ${theme.fg("dim", args.command)}`;
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Waiting for terminal..."), 0, 0);
			const details = result.details as SessionDetails | undefined;
			if (!details) return new Text(theme.fg("error", "Terminal operation failed"), 0, 0);
			if (details.sessions) return new Text(theme.fg("success", `${details.sessions.length} terminal session(s)`), 0, 0);
			if (details.ended) return new Text(theme.fg("success", `Ended ${details.ended.id}`), 0, 0);
			if (details.snapshot) {
				let text = theme.fg(details.snapshot.status === "running" ? "success" : "muted", summarize({
					...details.snapshot,
					output: details.snapshot.outputPreview,
				}));
				if (details.truncated) text += theme.fg("warning", " (output truncated)");
				if (expanded && details.snapshot.outputPreview) text += `\n${theme.fg("dim", details.snapshot.outputPreview)}`;
				return new Text(text, 0, 0);
			}
			return new Text(theme.fg("success", "Done"), 0, 0);
		},
	});
}
