import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_LINES = 200;
const MAX_LINES = 2_000;
const MAX_WAIT_MS = 30_000;
const POLL_MS = 100;
const SESSION_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SAFE_KEY = /^(?:Enter|Escape|Tab|BSpace|Space|Up|Down|Left|Right|Home|End|PPage|NPage|DC|IC|F(?:[1-9]|1[0-2])|C-[A-Za-z@\[\\\]^_?]|M-[A-Za-z0-9])$/;

export interface TerminalSnapshot {
	id: string;
	name: string;
	command: string;
	cwd: string;
	startedAt: string;
	status: "running" | "exited";
	exitCode?: number;
	pid?: number;
	currentCommand?: string;
	output: string;
	cursor: string;
	timedOut?: boolean;
}

export interface TerminalSummary {
	id: string;
	name: string;
	command: string;
	cwd: string;
	startedAt: string;
	status: "running" | "exited";
	exitCode?: number;
	pid?: number;
	currentCommand?: string;
}

interface CommandResult {
	stdout: string;
	stderr: string;
	code: number;
}

interface SpawnOptions {
	command: string;
	cwd: string;
	name?: string;
	signal?: AbortSignal;
}

interface ViewOptions {
	id: string;
	lines?: number;
	cursor?: string;
	waitMs?: number;
	signal?: AbortSignal;
}

function cleanField(value: string | undefined): string {
	return value ?? "";
}

function encodeMetadata(value: string): string {
	return Buffer.from(value, "utf8").toString("base64url");
}

function decodeMetadata(value: string | undefined): string {
	if (!value) return "";
	try {
		return Buffer.from(value, "base64url").toString("utf8");
	} catch {
		return "";
	}
}

function parseOptionalNumber(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function trimCapturedPane(output: string): string {
	const lines = output.replace(/\r/g, "").split("\n");
	while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
	const last = lines.at(-1)?.trim() ?? "";
	if (/^Pane is dead \(status \d+, .+\)$/.test(last)) {
		lines.pop();
		while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
	}
	return lines.join("\n");
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) return Promise.reject(new Error("Terminal wait cancelled"));
	return new Promise((resolveWait, reject) => {
		const timer = setTimeout(done, ms);
		function done() {
			signal?.removeEventListener("abort", aborted);
			resolveWait();
		}
		function aborted() {
			clearTimeout(timer);
			reject(new Error("Terminal wait cancelled"));
		}
		signal?.addEventListener("abort", aborted, { once: true });
	});
}

export function terminalServerName(piSessionId: string): string {
	const digest = createHash("sha256").update(piSessionId).digest("hex").slice(0, 16);
	return `pi-terminal-${digest}`;
}

export function tmuxAvailable(): boolean {
	return spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;
}

export class TmuxTerminalManager {
	constructor(readonly serverName: string) {}

	private async tmux(args: string[], options: { input?: string; signal?: AbortSignal } = {}): Promise<CommandResult> {
		if (options.signal?.aborted) throw new Error("Terminal operation cancelled");
		return await new Promise((resolveCommand, reject) => {
			const child = spawn("tmux", ["-L", this.serverName, ...args], {
				stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
			});
			let stdout = "";
			let stderr = "";
			let settled = false;

			const abort = () => child.kill("SIGTERM");
			options.signal?.addEventListener("abort", abort, { once: true });
			child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
			child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
			child.on("error", (error) => {
				if (settled) return;
				settled = true;
				options.signal?.removeEventListener("abort", abort);
				reject(error);
			});
			child.on("close", (code) => {
				if (settled) return;
				settled = true;
				options.signal?.removeEventListener("abort", abort);
				if (options.signal?.aborted) {
					reject(new Error("Terminal operation cancelled"));
					return;
				}
				resolveCommand({ stdout, stderr, code: code ?? 1 });
			});
			if (options.input !== undefined) child.stdin.end(options.input);
		});
	}

	private async requireTmux(args: string[], options: { input?: string; signal?: AbortSignal } = {}): Promise<string> {
		const result = await this.tmux(args, options);
		if (result.code !== 0) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || `tmux exited with code ${result.code}`);
		}
		return result.stdout;
	}

	private async exists(id: string): Promise<boolean> {
		const result = await this.tmux(["has-session", "-t", id]);
		return result.code === 0;
	}

	private validateId(id: string): void {
		if (!SESSION_NAME.test(id)) {
			throw new Error("Terminal id must be 1-64 characters using letters, numbers, underscore, or hyphen");
		}
	}

	async spawn(options: SpawnOptions): Promise<TerminalSnapshot> {
		const name = options.name?.trim() || `term-${randomUUID().slice(0, 8)}`;
		this.validateId(name);
		if (!options.command.trim()) throw new Error("command is required");
		const cwd = resolve(options.cwd);
		const cwdStat = await stat(cwd).catch(() => null);
		if (!cwdStat?.isDirectory()) throw new Error(`Working directory does not exist: ${cwd}`);
		if (await this.exists(name)) throw new Error(`Terminal session already exists: ${name}`);

		await this.requireTmux([
			"start-server", ";",
			"set-window-option", "-g", "remain-on-exit", "on", ";",
			"set-window-option", "-g", "history-limit", "50000", ";",
			"new-session", "-d", "-s", name, "-c", cwd, "-x", "120", "-y", "40", options.command,
		], { signal: options.signal });

		const startedAt = new Date().toISOString();
		await Promise.all([
			this.requireTmux(["set-option", "-t", name, "@pi_name", name]),
			this.requireTmux(["set-option", "-t", name, "@pi_command", encodeMetadata(options.command)]),
			this.requireTmux(["set-option", "-t", name, "@pi_cwd", encodeMetadata(cwd)]),
			this.requireTmux(["set-option", "-t", name, "@pi_started_at", encodeMetadata(startedAt)]),
		]);

		await wait(50, options.signal);
		return await this.snapshot(name, DEFAULT_LINES);
	}

	private async metadata(id: string): Promise<TerminalSummary> {
		this.validateId(id);
		const format = [
			"#{session_name}", "#{@pi_name}", "#{@pi_command}", "#{@pi_cwd}", "#{@pi_started_at}",
			"#{pane_dead}", "#{pane_dead_status}", "#{pane_pid}", "#{pane_current_command}",
		].join("\t");
		const result = await this.tmux(["display-message", "-p", "-t", id, format]);
		if (result.code !== 0) throw new Error(`Unknown terminal session: ${id}`);
		const fields = result.stdout.trimEnd().split("\t").map(cleanField);
		const dead = fields[5] === "1";
		return {
			id: fields[0] || id,
			name: fields[1] || fields[0] || id,
			command: decodeMetadata(fields[2]),
			cwd: decodeMetadata(fields[3]),
			startedAt: decodeMetadata(fields[4]),
			status: dead ? "exited" : "running",
			...(dead ? { exitCode: parseOptionalNumber(fields[6]) } : {}),
			pid: parseOptionalNumber(fields[7]),
			currentCommand: fields[8] || undefined,
		};
	}

	private async snapshot(id: string, requestedLines: number): Promise<TerminalSnapshot> {
		const lines = Math.max(1, Math.min(MAX_LINES, Math.floor(requestedLines || DEFAULT_LINES)));
		const [summary, capture] = await Promise.all([
			this.metadata(id),
			this.requireTmux(["capture-pane", "-p", "-J", "-S", `-${lines}`, "-t", id]),
		]);
		const output = trimCapturedPane(capture);
		const cursor = createHash("sha256")
			.update(`${summary.status}\0${summary.exitCode ?? ""}\0${output}`)
			.digest("hex")
			.slice(0, 16);
		return { ...summary, output, cursor };
	}

	async view(options: ViewOptions): Promise<TerminalSnapshot> {
		const lines = options.lines ?? DEFAULT_LINES;
		let current = await this.snapshot(options.id, lines);
		const waitMs = Math.max(0, Math.min(MAX_WAIT_MS, Math.floor(options.waitMs ?? 0)));
		if (waitMs === 0 || current.status === "exited") return current;

		const baseline = options.cursor ?? current.cursor;
		if (options.cursor && current.cursor !== options.cursor) return current;
		const deadline = Date.now() + waitMs;
		while (Date.now() < deadline) {
			await wait(Math.min(POLL_MS, deadline - Date.now()), options.signal);
			current = await this.snapshot(options.id, lines);
			if (current.cursor !== baseline || current.status === "exited") return current;
		}
		return { ...current, timedOut: true };
	}

	async send(id: string, text: string, submit = true, signal?: AbortSignal): Promise<TerminalSnapshot> {
		const before = await this.snapshot(id, DEFAULT_LINES);
		if (before.status === "exited") throw new Error(`Terminal session has exited: ${id}`);
		const buffer = `pi-${randomUUID().slice(0, 12)}`;
		await this.requireTmux(["load-buffer", "-b", buffer, "-"], { input: text, signal });
		await this.requireTmux(["paste-buffer", "-b", buffer, "-d", "-t", id], { signal });
		if (submit) await this.requireTmux(["send-keys", "-t", id, "--", "Enter"], { signal });
		await wait(50, signal);
		return await this.snapshot(id, DEFAULT_LINES);
	}

	async sendRaw(id: string, keys: string[], signal?: AbortSignal): Promise<TerminalSnapshot> {
		const before = await this.snapshot(id, DEFAULT_LINES);
		if (before.status === "exited") throw new Error(`Terminal session has exited: ${id}`);
		if (keys.length === 0 || keys.length > 32) throw new Error("keys must contain between 1 and 32 key names");
		const invalid = keys.find((key) => !SAFE_KEY.test(key));
		if (invalid) throw new Error(`Unsupported raw key: ${invalid}`);
		await this.requireTmux(["send-keys", "-t", id, "--", ...keys], { signal });
		await wait(50, signal);
		return await this.snapshot(id, DEFAULT_LINES);
	}

	async end(id: string, signal?: AbortSignal): Promise<TerminalSummary> {
		const summary = await this.metadata(id);
		await this.requireTmux(["kill-session", "-t", id], { signal });
		return summary;
	}

	async list(): Promise<TerminalSummary[]> {
		const format = [
			"#{session_name}", "#{@pi_name}", "#{@pi_command}", "#{@pi_cwd}", "#{@pi_started_at}",
			"#{pane_dead}", "#{pane_dead_status}", "#{pane_pid}", "#{pane_current_command}",
		].join("\t");
		const result = await this.tmux(["list-sessions", "-F", format]);
		if (result.code !== 0) return [];
		return result.stdout.split("\n").filter(Boolean).map((line) => {
			const fields = line.split("\t").map(cleanField);
			const dead = fields[5] === "1";
			return {
				id: fields[0],
				name: fields[1] || fields[0],
				command: decodeMetadata(fields[2]),
				cwd: decodeMetadata(fields[3]),
				startedAt: decodeMetadata(fields[4]),
				status: dead ? "exited" as const : "running" as const,
				...(dead ? { exitCode: parseOptionalNumber(fields[6]) } : {}),
				pid: parseOptionalNumber(fields[7]),
				currentCommand: fields[8] || undefined,
			};
		});
	}

	async killServer(): Promise<void> {
		await this.tmux(["kill-server"]);
	}
}
