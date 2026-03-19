import { spawn, type ChildProcess } from "node:child_process";
import {
	createMessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
	type MessageConnection,
} from "vscode-languageserver-protocol/node.js";
import type {
	Diagnostic,
	PublishDiagnosticsParams,
	Hover,
	Definition,
	Location,
	CompletionList,
	CompletionItem,
	Position,
} from "vscode-languageserver-protocol";
import { CompletionItemKind } from "vscode-languageserver-protocol";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const INIT_TIMEOUT_MS = 15_000;

export interface DiagnosticEntry {
	file: string;
	line: number;
	col: number;
	severity: string;
	message: string;
	source?: string;
}

export interface LookupResult {
	text: string;
	type: string;
	count?: number;
}

export interface CompletionEntry {
	label: string;
	kind: string;
	detail?: string;
}

export interface ServerConfig {
	name: string;
	command: string;
	args: string[];
	detectFiles: string[];
	fileExtensions: string[];
	languageIds: Record<string, string>;
	/** Shell command to resolve the actual binary path (e.g. for tsgo native binary) */
	resolveCommand?: string;
}

interface ServerConnection {
	config: ServerConfig;
	process: ChildProcess;
	connection: MessageConnection;
	diagnostics: Map<string, Diagnostic[]>;
}

/** Extra paths to search for commands beyond $PATH */
const EXTRA_SEARCH_PATHS = [
	"/usr/local/bin",
	"/opt/homebrew/bin",
	`${process.env.HOME}/.cargo/bin`,
	`${process.env.HOME}/go/bin`,
	`${process.env.HOME}/.pub-cache/bin`,
];

function which(cmd: string): string | undefined {
	const pathDirs = process.env.PATH?.split(path.delimiter) ?? [];
	const searchPaths = [...pathDirs, ...EXTRA_SEARCH_PATHS];
	const ext = process.platform === "win32" ? ".exe" : "";

	for (const dir of searchPaths) {
		const full = path.join(dir, cmd + ext);
		try {
			if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
		} catch {}
	}
	return undefined;
}

function resolveCommand(config: ServerConfig): string | undefined {
	// If resolveCommand is set, run it to get the actual binary path
	if (config.resolveCommand) {
		try {
			const { execSync } = require("node:child_process");
			const resolved = execSync(config.resolveCommand, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
			if (resolved && fs.existsSync(resolved)) return resolved;
		} catch {}
	}

	return which(config.command);
}

function fileUri(filePath: string): string {
	return pathToFileURL(filePath).toString();
}

function uriToPath(uri: string): string {
	try {
		return fileURLToPath(uri);
	} catch {
		return uri.replace(/^file:\/\//, "");
	}
}

function timeoutPromise<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		promise.then(
			(r) => { clearTimeout(timer); resolve(r); },
			(e) => { clearTimeout(timer); reject(e); },
		);
	});
}

export function loadServerConfigs(configPath: string): ServerConfig[] {
	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(raw);
		return parsed.servers ?? [];
	} catch {
		return [];
	}
}

export class LspClientManager {
	private connections = new Map<string, ServerConnection>();
	private rootPath = "";
	private serverConfigs: ServerConfig[] = [];

	constructor(configs?: ServerConfig[]) {
		if (configs) {
			this.serverConfigs = configs;
		}
	}

	setConfigs(configs: ServerConfig[]) {
		this.serverConfigs = configs;
	}

	getConfigs(): ServerConfig[] {
		return this.serverConfigs;
	}

	async autoDetectAndStart(cwd: string) {
		this.rootPath = cwd;

		for (const config of this.serverConfigs) {
			const detected = config.detectFiles.some((f) => fs.existsSync(path.join(cwd, f)));
			if (detected) {
				await this.startServer(config, cwd);
			}
		}
	}

	async startByName(name: string, cwd?: string): Promise<boolean> {
		const rootPath = cwd ?? this.rootPath;
		if (!rootPath) return false;
		this.rootPath = rootPath;

		const config = this.serverConfigs.find((c) => c.name === name);
		if (!config) return false;
		if (this.connections.has(name)) return true;

		await this.startServer(config, rootPath);
		return this.connections.has(name);
	}

	async stopByName(name: string): Promise<boolean> {
		const conn = this.connections.get(name);
		if (!conn) return false;

		try {
			const req = conn.connection.sendRequest("shutdown").catch(() => {});
			await Promise.race([req, new Promise((r) => setTimeout(r, 3000))]);
			try { conn.connection.sendNotification("exit"); } catch {}
		} catch {
			/* ignore */
		}
		conn.process.kill();
		this.connections.delete(name);
		return true;
	}

	getRunningNames(): string[] {
		return [...this.connections.keys()];
	}

	private async startServer(config: ServerConfig, rootPath: string) {
		if (this.connections.has(config.name)) return;

		const cmd = resolveCommand(config);
		if (!cmd) return; // Command not found, skip silently

		let proc: ChildProcess;
		try {
			proc = spawn(cmd, config.args, {
				cwd: rootPath,
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch {
			return;
		}

		if (!proc.stdout || !proc.stdin) {
			proc.kill();
			return;
		}

		// Wait for process to actually spawn (catches ENOENT etc.)
		try {
			await new Promise<void>((resolve, reject) => {
				const onSpawn = () => { cleanup(); resolve(); };
				const onError = (err: Error) => {
					cleanup();
					reject(new Error(`Failed to spawn "${config.name}" (${cmd}): ${err.message}`));
				};
				const cleanup = () => {
					proc.removeListener("spawn", onSpawn);
					proc.removeListener("error", onError);
				};
				proc.on("spawn", onSpawn);
				proc.on("error", onError);
			});
		} catch {
			return;
		}

		// Discard stderr to prevent blocking
		proc.stderr?.resume();

		// Patch stdin.write to silently drop writes when the stream is destroyed.
		// Without this, fire-and-forget notifications (sendNotification) can cause
		// ERR_STREAM_DESTROYED rejections that propagate as unhandled.
		const stdin = proc.stdin;
		const originalWrite = stdin.write;
		stdin.write = function (this: typeof stdin, ...args: any[]): boolean {
			if (this.destroyed) {
				const cb = args[args.length - 1];
				if (typeof cb === "function") process.nextTick(cb);
				return false;
			}
			return originalWrite.apply(this, args as any);
		} as any;

		const connection = createMessageConnection(
			new StreamMessageReader(proc.stdout),
			new StreamMessageWriter(stdin),
		);

		const diagnosticsMap = new Map<string, Diagnostic[]>();

		connection.onError(([error]) => {
			console.error(`LSP ${config.name} connection error:`, error);
		});

		connection.onClose(() => {
			this.connections.delete(config.name);
		});

		connection.onNotification("textDocument/publishDiagnostics", (params: PublishDiagnosticsParams) => {
			diagnosticsMap.set(params.uri, params.diagnostics);
		});

		connection.listen();

		proc.on("error", () => {
			this.connections.delete(config.name);
		});

		proc.on("exit", () => {
			this.connections.delete(config.name);
		});

		try {
			const rootUri = fileUri(rootPath);
			const initResult = await timeoutPromise(
				connection.sendRequest("initialize", {
					processId: process.pid,
					rootUri,
					workspaceFolders: [{ uri: rootUri, name: path.basename(rootPath) }],
					capabilities: {
						textDocument: {
							synchronization: { didSave: true, dynamicRegistration: false },
							completion: { completionItem: { snippetSupport: false } },
							hover: { contentFormat: ["plaintext", "markdown"] },
							definition: {},
							references: {},
							publishDiagnostics: { relatedInformation: true },
						},
						workspace: {
							workspaceFolders: true,
						},
					},
				}),
				INIT_TIMEOUT_MS,
				`${config.name} initialize`,
			);

			connection.sendNotification("initialized", {});

			this.connections.set(config.name, {
				config,
				process: proc,
				connection,
				diagnostics: diagnosticsMap,
			});
		} catch {
			proc.kill();
		}
	}

	isRunning(): boolean {
		return this.connections.size > 0;
	}

	getStatus(): string {
		if (!this.isRunning()) return "No LSP servers running";
		return `Running: ${[...this.connections.keys()].join(", ")}`;
	}

	getFooter(): string {
		if (!this.isRunning()) return "LSP ✗";
		const names = [...this.connections.keys()];
		return `LSP: ${names.join(", ")}`;
	}

	async getDiagnostics(filePath?: string): Promise<DiagnosticEntry[]> {
		const results: DiagnosticEntry[] = [];

		for (const [serverName, { diagnostics }] of this.connections) {
			for (const [uri, diags] of diagnostics) {
				const diagPath = uriToPath(uri);
				if (filePath) {
					const resolvedPath = path.resolve(this.rootPath, filePath);
					if (diagPath !== resolvedPath && !diagPath.endsWith(filePath)) {
						continue;
					}
				}
				for (const d of diags) {
					results.push({
						file: diagPath,
						line: d.range.start.line + 1,
						col: d.range.start.character + 1,
						severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
						message: d.message,
						source: d.source ?? serverName,
					});
				}
			}
		}
		return results;
	}

	async lookup(filePath: string, line: number, col: number, action: string): Promise<LookupResult | null> {
		const conns = this.getConnectionsForFile(filePath);
		if (conns.length === 0) return null;

		const uri = fileUri(path.resolve(this.rootPath, filePath));
		const position: Position = { line, character: col };
		const textDocument = { uri };

		for (const conn of conns) {
			try {
				if (action === "hover") {
					const result: Hover | null = await conn.connection.sendRequest("textDocument/hover", {
						textDocument,
						position,
					});
					if (!result) continue;
					const contents =
						typeof result.contents === "string"
							? result.contents
							: "value" in result.contents
								? result.contents.value
								: JSON.stringify(result.contents);
					return { text: contents, type: "hover" };
				}

				if (action === "definition") {
					const result: Definition | null = await conn.connection.sendRequest("textDocument/definition", {
						textDocument,
						position,
					});
					if (!result) continue;
					const locs = Array.isArray(result) ? result : [result];
					const text = locs
						.map((l: any) => {
							const locPath = uriToPath(l.uri || l.targetUri || "");
							const locLine = ((l.range || l.targetRange)?.start?.line ?? 0) + 1;
							return `${locPath}:${locLine}`;
						})
						.join("\n");
					return { text, type: "definition" };
				}

				if (action === "references") {
					const result: Location[] | null = await conn.connection.sendRequest("textDocument/references", {
						textDocument,
						position,
						context: { includeDeclaration: true },
					});
					if (!result?.length) continue;
					const text = result
						.map((l: Location) => `${uriToPath(l.uri)}:${l.range.start.line + 1}`)
						.join("\n");
					return { text, type: "references", count: result.length };
				}
			} catch {
				continue;
			}
		}

		return null;
	}

	async getCompletions(filePath: string, line: number, col: number): Promise<CompletionEntry[]> {
		const conns = this.getConnectionsForFile(filePath);
		if (conns.length === 0) return [];

		const allItems: CompletionEntry[] = [];

		for (const conn of conns) {
			try {
				const result: CompletionList | CompletionItem[] | null = await conn.connection.sendRequest("textDocument/completion", {
					textDocument: { uri: fileUri(path.resolve(this.rootPath, filePath)) },
					position: { line, character: col },
				});

				const items = Array.isArray(result) ? result : result?.items ?? [];
				allItems.push(
					...items.map((i) => ({
						label: i.label,
						kind: CompletionItemKind[i.kind ?? 1] ?? "Unknown",
						detail: i.detail,
					})),
				);
			} catch {
				continue;
			}
		}

		return allItems;
	}

	async notifyFileChanged(filePath: string) {
		const conns = this.getConnectionsForFile(filePath);
		if (conns.length === 0) return;

		const resolvedPath = path.resolve(this.rootPath, filePath);
		const uri = fileUri(resolvedPath);

		let content: string;
		try {
			content = fs.readFileSync(resolvedPath, "utf-8");
		} catch {
			return;
		}

		const langId = this.getLanguageId(filePath);

		for (const conn of conns) {
			try {
				conn.connection.sendNotification("textDocument/didOpen", {
					textDocument: { uri, languageId: langId, version: Date.now(), text: content },
				});
			} catch {
				// Ignore notification failures
			}
		}
	}

	private getLanguageId(filePath: string): string {
		const ext = path.extname(filePath);

		for (const config of this.serverConfigs) {
			if (config.languageIds[ext]) {
				return config.languageIds[ext];
			}
		}

		return "plaintext";
	}

	private getConnectionsForFile(filePath: string): ServerConnection[] {
		const ext = path.extname(filePath);
		const matches: ServerConnection[] = [];

		for (const [, conn] of this.connections) {
			if (conn.config.fileExtensions.includes(ext)) {
				matches.push(conn);
			}
		}

		return matches;
	}

	async shutdown() {
		const shutdowns = [...this.connections.entries()].map(async ([name, { connection, process: proc }]) => {
			try {
				const req = connection.sendRequest("shutdown").catch(() => {});
				await Promise.race([req, new Promise((r) => setTimeout(r, 3000))]);
				try { connection.sendNotification("exit"); } catch {}
			} catch {
				/* ignore */
			}
			proc.kill("SIGTERM");
			// Force kill after 2s
			setTimeout(() => {
				if (!proc.killed) proc.kill("SIGKILL");
			}, 2000);
			this.connections.delete(name);
		});
		await Promise.all(shutdowns);
		this.connections.clear();
	}
}
