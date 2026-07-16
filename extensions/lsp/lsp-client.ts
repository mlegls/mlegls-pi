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
	Range,
	WorkspaceEdit,
	CodeAction,
	Command,
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

export interface CodeActionEntry {
	title: string;
	kind?: string;
	preferred?: boolean;
	disabled?: string;
	hasEdit: boolean;
	hasCommand: boolean;
}

export interface CodeActionResult {
	actions: CodeActionEntry[];
	edit?: WorkspaceEdit;
	selectedTitle?: string;
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
	rootPath: string;
	process: ChildProcess;
	connection: MessageConnection;
	diagnostics: Map<string, Diagnostic[]>;
	documents: Map<string, number>;
}

export interface RunningServer {
	name: string;
	rootPath: string;
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

function resolveCommand(config: ServerConfig, cwd?: string): string | undefined {
	// If resolveCommand is set, run it to get the actual binary path
	if (config.resolveCommand) {
		try {
			const { execSync } = require("node:child_process");
			const resolved = execSync(config.resolveCommand, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
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

export function isPathInside(rootPath: string, filePath: string): boolean {
	const relative = path.relative(path.resolve(rootPath), path.resolve(filePath));
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

/** Find the nearest project marker by walking from a file toward the workspace root. */
export function findProjectRoot(filePath: string, workspaceRoot: string, detectFiles: string[]): string | undefined {
	const boundary = path.resolve(workspaceRoot);
	const resolvedFile = path.resolve(filePath);
	if (!isPathInside(boundary, resolvedFile)) return undefined;

	let directory = path.dirname(resolvedFile);
	while (isPathInside(boundary, directory)) {
		if (detectFiles.some((file) => fs.existsSync(path.join(directory, file)))) return directory;
		if (directory === boundary) break;
		const parent = path.dirname(directory);
		if (parent === directory) break;
		directory = parent;
	}
	return undefined;
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
	private pendingStarts = new Map<string, Promise<void>>();
	private workspaceRoot = "";
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
		this.workspaceRoot = path.resolve(cwd);

		for (const config of this.serverConfigs) {
			const detected = config.detectFiles.some((f) => fs.existsSync(path.join(this.workspaceRoot, f)));
			if (detected) await this.startServer(config, this.workspaceRoot);
		}
	}

	async startByName(name: string, cwd?: string): Promise<boolean> {
		const rootPath = path.resolve(cwd ?? this.workspaceRoot);
		if (!rootPath) return false;
		if (!this.workspaceRoot) this.workspaceRoot = rootPath;

		const config = this.serverConfigs.find((c) => c.name === name);
		if (!config) return false;

		await this.startServer(config, rootPath);
		return this.connections.has(this.connectionKey(config.name, rootPath));
	}

	async stopByName(name: string): Promise<boolean> {
		const matches = [...this.connections.entries()].filter(([, conn]) => conn.config.name === name);
		if (matches.length === 0) return false;
		await Promise.all(matches.map(([key, conn]) => this.stopConnection(key, conn)));
		return true;
	}

	getRunningNames(): string[] {
		return [...new Set([...this.connections.values()].map((conn) => conn.config.name))];
	}

	getRunningServers(): RunningServer[] {
		return [...this.connections.values()]
			.map((conn) => ({ name: conn.config.name, rootPath: conn.rootPath }))
			.sort((a, b) => a.name.localeCompare(b.name) || a.rootPath.localeCompare(b.rootPath));
	}

	private connectionKey(name: string, rootPath: string): string {
		return `${name}\0${path.resolve(rootPath)}`;
	}

	private async stopConnection(key: string, conn: ServerConnection): Promise<void> {
		try {
			const req = conn.connection.sendRequest("shutdown").catch(() => {});
			await Promise.race([req, new Promise((r) => setTimeout(r, 3000))]);
			try { conn.connection.sendNotification("exit"); } catch {}
			await new Promise((resolve) => setTimeout(resolve, 100));
		} catch {
			/* ignore */
		}
		if (conn.process.exitCode === null) conn.process.kill();
		conn.connection.dispose();
		this.connections.delete(key);
	}

	private async startServer(config: ServerConfig, rootPath: string) {
		rootPath = path.resolve(rootPath);
		const key = this.connectionKey(config.name, rootPath);
		if (this.connections.has(key)) return;
		const pending = this.pendingStarts.get(key);
		if (pending) return pending;

		const start = this.startServerOnce(config, rootPath, key);
		this.pendingStarts.set(key, start);
		try {
			await start;
		} finally {
			this.pendingStarts.delete(key);
		}
	}

	private async startServerOnce(config: ServerConfig, rootPath: string, key: string) {

		const cmd = resolveCommand(config, rootPath);
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
			this.connections.delete(key);
		});

		connection.onNotification("textDocument/publishDiagnostics", (params: PublishDiagnosticsParams) => {
			diagnosticsMap.set(params.uri, params.diagnostics);
		});

		connection.listen();

		proc.on("error", () => {
			this.connections.delete(key);
		});

		proc.on("exit", () => {
			this.connections.delete(key);
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
							rename: { prepareSupport: false },
							codeAction: {
								codeActionLiteralSupport: {
									codeActionKind: {
										valueSet: ["", "quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports", "source.fixAll"],
									},
								},
							},
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

			this.connections.set(key, {
				config,
				rootPath,
				process: proc,
				connection,
				diagnostics: diagnosticsMap,
				documents: new Map(),
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
		return `Running: ${this.getRunningServers().map(({ name, rootPath }) => `${name} (${rootPath})`).join(", ")}`;
	}

	getFooter(): string {
		if (!this.isRunning()) return "LSP ✗";
		const counts = new Map<string, number>();
		for (const { name } of this.getRunningServers()) counts.set(name, (counts.get(name) ?? 0) + 1);
		const labels = [...counts].map(([name, count]) => count > 1 ? `${name}×${count}` : name);
		return `LSP: ${labels.join(", ")}`;
	}

	async getDiagnostics(filePath?: string): Promise<DiagnosticEntry[]> {
		const results: DiagnosticEntry[] = [];
		const resolvedFilter = filePath ? this.resolveFilePath(filePath) : undefined;
		if (filePath) await this.getConnectionsForFile(filePath);

		for (const { config, diagnostics } of this.connections.values()) {
			for (const [uri, diags] of diagnostics) {
				const diagPath = uriToPath(uri);
				if (resolvedFilter && diagPath !== resolvedFilter) continue;
				for (const d of diags) {
					results.push({
						file: diagPath,
						line: d.range.start.line + 1,
						col: d.range.start.character + 1,
						severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
						message: d.message,
						source: d.source ?? config.name,
					});
				}
			}
		}
		return results;
	}

	async lookup(filePath: string, line: number, col: number, action: string): Promise<LookupResult | null> {
		const conns = await this.getConnectionsForFile(filePath);
		if (conns.length === 0) return null;

		const uri = fileUri(this.resolveFilePath(filePath));
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

	async getRenameEdit(filePath: string, line: number, col: number, newName: string): Promise<WorkspaceEdit | null> {
		const conns = await this.getConnectionsForFile(filePath);
		if (conns.length === 0) return null;

		const textDocument = { uri: fileUri(this.resolveFilePath(filePath)) };
		for (const conn of conns) {
			try {
				const result: WorkspaceEdit | null = await conn.connection.sendRequest("textDocument/rename", {
					textDocument,
					position: { line, character: col },
					newName,
				});
				if (result) return result;
			} catch {
				continue;
			}
		}
		return null;
	}

	async getCodeActions(
		filePath: string,
		range: Range,
		selectedTitle?: string,
	): Promise<CodeActionResult> {
		const conns = await this.getConnectionsForFile(filePath);
		if (conns.length === 0) return { actions: [] };

		const resolvedPath = this.resolveFilePath(filePath);
		const uri = fileUri(resolvedPath);
		for (const conn of conns) {
			try {
				const diagnostics = conn.diagnostics.get(uri) ?? [];
				const result: Array<Command | CodeAction> | null = await conn.connection.sendRequest(
					"textDocument/codeAction",
					{ textDocument: { uri }, range, context: { diagnostics } },
				);
				if (!result?.length) continue;

				const actions = result.map((item) => {
					const action = item as CodeAction;
					return {
						title: item.title,
						kind: action.kind,
						preferred: action.isPreferred,
						disabled: action.disabled?.reason,
						hasEdit: !!action.edit,
						hasCommand: "command" in item || !!action.command,
					};
				});

				if (!selectedTitle) return { actions };
				const matches = result.filter((item) => item.title === selectedTitle);
				if (matches.length !== 1) return { actions };
				let selected = matches[0] as CodeAction;
				if (!selected.edit && selected.data !== undefined) {
					try {
						selected = await conn.connection.sendRequest("codeAction/resolve", selected);
					} catch {
						// Some servers return commands rather than resolvable edits.
					}
				}
				return { actions, edit: selected.edit, selectedTitle };
			} catch {
				continue;
			}
		}
		return { actions: [] };
	}

	async getCompletions(filePath: string, line: number, col: number): Promise<CompletionEntry[]> {
		const conns = await this.getConnectionsForFile(filePath);
		if (conns.length === 0) return [];

		const allItems: CompletionEntry[] = [];

		for (const conn of conns) {
			try {
				const result: CompletionList | CompletionItem[] | null = await conn.connection.sendRequest("textDocument/completion", {
					textDocument: { uri: fileUri(this.resolveFilePath(filePath)) },
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
		await this.getConnectionsForFile(filePath);
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

	private resolveFilePath(filePath: string): string {
		return path.resolve(this.workspaceRoot, filePath);
	}

	private async getConnectionsForFile(filePath: string): Promise<ServerConnection[]> {
		if (!this.workspaceRoot) return [];
		const resolvedPath = this.resolveFilePath(filePath);
		if (!isPathInside(this.workspaceRoot, resolvedPath)) return [];

		const ext = path.extname(resolvedPath);
		const configs = this.serverConfigs.filter((config) => config.fileExtensions.includes(ext));
		for (const config of configs) {
			const projectRoot = findProjectRoot(resolvedPath, this.workspaceRoot, config.detectFiles);
			if (projectRoot) await this.startServer(config, projectRoot);
		}

		const matches: ServerConnection[] = [];
		for (const config of configs) {
			const candidates = [...this.connections.values()]
				.filter((conn) => conn.config.name === config.name && isPathInside(conn.rootPath, resolvedPath))
				.sort((a, b) => b.rootPath.length - a.rootPath.length);
			if (candidates[0]) matches.push(candidates[0]);
		}

		await this.synchronizeDocument(resolvedPath, matches);
		return matches;
	}

	private async synchronizeDocument(resolvedPath: string, conns: ServerConnection[]): Promise<void> {
		let content: string;
		try {
			content = await fs.promises.readFile(resolvedPath, "utf-8");
		} catch {
			return;
		}

		const uri = fileUri(resolvedPath);
		const languageId = this.getLanguageId(resolvedPath);
		for (const conn of conns) {
			try {
				const previousVersion = conn.documents.get(uri);
				const version = (previousVersion ?? 0) + 1;
				if (previousVersion === undefined) {
					conn.connection.sendNotification("textDocument/didOpen", {
						textDocument: { uri, languageId, version, text: content },
					});
				} else {
					conn.connection.sendNotification("textDocument/didChange", {
						textDocument: { uri, version },
						contentChanges: [{ text: content }],
					});
				}
				conn.documents.set(uri, version);
			} catch {
				// Ignore notification failures.
			}
		}
	}

	async shutdown() {
		const shutdowns = [...this.connections.entries()].map(async ([name, { connection, process: proc }]) => {
			try {
				const req = connection.sendRequest("shutdown").catch(() => {});
				await Promise.race([req, new Promise((r) => setTimeout(r, 3000))]);
				try { connection.sendNotification("exit"); } catch {}
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch {
				/* ignore */
			}
			if (proc.exitCode === null) proc.kill("SIGTERM");
			connection.dispose();
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
