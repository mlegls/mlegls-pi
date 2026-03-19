import { spawn, type ChildProcess } from "node:child_process";
import * as rpc from "vscode-jsonrpc/node";
import * as lsp from "vscode-languageserver-protocol";
import * as fs from "node:fs";
import * as path from "node:path";

export interface DiagnosticEntry {
	file: string;
	line: number;
	col: number;
	severity: string;
	message: string;
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

interface ServerConnection {
	process: ChildProcess;
	connection: rpc.MessageConnection;
	diagnostics: Map<string, lsp.Diagnostic[]>;
}

const SERVER_CONFIGS: Record<string, { command: string; args: string[] }> = {
	typescript: { command: "typescript-language-server", args: ["--stdio"] },
	rust: { command: "rust-analyzer", args: [] },
	python: { command: "pylsp", args: [] },
	go: { command: "gopls", args: ["serve"] },
};

export class LspClientManager {
	private connections = new Map<string, ServerConnection>();
	private rootPath = "";

	async autoDetectAndStart(cwd: string) {
		this.rootPath = cwd;

		const detect: Array<{ files: string[]; language: string }> = [
			{ files: ["tsconfig.json", "package.json"], language: "typescript" },
			{ files: ["Cargo.toml"], language: "rust" },
			{ files: ["go.mod"], language: "go" },
			{ files: ["pyproject.toml", "setup.py", "requirements.txt"], language: "python" },
		];

		for (const { files, language } of detect) {
			if (files.some((f) => fs.existsSync(path.join(cwd, f)))) {
				await this.startServer(language, cwd);
			}
		}
	}

	private async startServer(language: string, rootPath: string) {
		if (this.connections.has(language)) return;

		const config = SERVER_CONFIGS[language];
		if (!config) return;

		let proc: ChildProcess;
		try {
			proc = spawn(config.command, config.args, {
				cwd: rootPath,
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch {
			return;
		}

		// Check the process actually started
		if (!proc.stdout || !proc.stdin) {
			proc.kill();
			return;
		}

		const connection = rpc.createMessageConnection(
			new rpc.StreamMessageReader(proc.stdout),
			new rpc.StreamMessageWriter(proc.stdin),
		);

		const diagnosticsMap = new Map<string, lsp.Diagnostic[]>();

		connection.onNotification(lsp.PublishDiagnosticsNotification.type, (params) => {
			diagnosticsMap.set(params.uri, params.diagnostics);
		});

		connection.listen();

		// Handle process errors gracefully
		proc.on("error", () => {
			this.connections.delete(language);
		});

		proc.on("exit", () => {
			this.connections.delete(language);
		});

		try {
			await connection.sendRequest(lsp.InitializeRequest.type, {
				processId: process.pid,
				rootUri: `file://${rootPath}`,
				capabilities: {
					textDocument: {
						completion: { completionItem: { snippetSupport: false } },
						hover: {},
						definition: {},
						references: {},
						publishDiagnostics: {},
					},
				},
			} as lsp.InitializeParams);

			await connection.sendNotification(lsp.InitializedNotification.type, {});

			this.connections.set(language, {
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

	async getDiagnostics(filePath?: string): Promise<DiagnosticEntry[]> {
		const results: DiagnosticEntry[] = [];

		for (const [, { diagnostics }] of this.connections) {
			for (const [uri, diags] of diagnostics) {
				const normalizedUri = uri.replace("file://", "");
				if (filePath) {
					const resolvedPath = path.resolve(this.rootPath, filePath);
					if (normalizedUri !== resolvedPath && !normalizedUri.endsWith(filePath)) {
						continue;
					}
				}
				for (const d of diags) {
					results.push({
						file: normalizedUri,
						line: d.range.start.line + 1,
						col: d.range.start.character + 1,
						severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
						message: d.message,
					});
				}
			}
		}
		return results;
	}

	async lookup(filePath: string, line: number, col: number, action: string): Promise<LookupResult | null> {
		const conn = this.getConnectionForFile(filePath);
		if (!conn) return null;

		const uri = `file://${path.resolve(this.rootPath, filePath)}`;
		const position: lsp.Position = { line, character: col };
		const textDocument = { uri };

		try {
			if (action === "hover") {
				const result = await conn.connection.sendRequest(lsp.HoverRequest.type, {
					textDocument,
					position,
				});
				if (!result) return null;
				const contents =
					typeof result.contents === "string"
						? result.contents
						: "value" in result.contents
							? result.contents.value
							: JSON.stringify(result.contents);
				return { text: contents, type: "hover" };
			}

			if (action === "definition") {
				const result = await conn.connection.sendRequest(lsp.DefinitionRequest.type, {
					textDocument,
					position,
				});
				if (!result) return null;
				const locs = Array.isArray(result) ? result : [result];
				const text = locs
					.map((l: any) => {
						const locUri = (l.uri || l.targetUri)?.replace("file://", "") ?? "unknown";
						const locLine = ((l.range || l.targetRange)?.start?.line ?? 0) + 1;
						return `${locUri}:${locLine}`;
					})
					.join("\n");
				return { text, type: "definition" };
			}

			if (action === "references") {
				const result = await conn.connection.sendRequest(lsp.ReferencesRequest.type, {
					textDocument,
					position,
					context: { includeDeclaration: true },
				});
				if (!result?.length) return null;
				const text = result
					.map((l: lsp.Location) => `${l.uri.replace("file://", "")}:${l.range.start.line + 1}`)
					.join("\n");
				return { text, type: "references", count: result.length };
			}
		} catch {
			return null;
		}

		return null;
	}

	async getCompletions(filePath: string, line: number, col: number): Promise<CompletionEntry[]> {
		const conn = this.getConnectionForFile(filePath);
		if (!conn) return [];

		try {
			const result = await conn.connection.sendRequest(lsp.CompletionRequest.type, {
				textDocument: { uri: `file://${path.resolve(this.rootPath, filePath)}` },
				position: { line, character: col },
			});

			const items = Array.isArray(result) ? result : result?.items ?? [];
			return items.map((i) => ({
				label: i.label,
				kind: lsp.CompletionItemKind[i.kind ?? 1] ?? "Unknown",
				detail: i.detail,
			}));
		} catch {
			return [];
		}
	}

	async notifyFileChanged(filePath: string) {
		const conn = this.getConnectionForFile(filePath);
		if (!conn) return;

		const resolvedPath = path.resolve(this.rootPath, filePath);
		const uri = `file://${resolvedPath}`;

		try {
			const content = fs.readFileSync(resolvedPath, "utf-8");
			const langId = this.getLanguageId(filePath);

			conn.connection.sendNotification(lsp.DidOpenTextDocumentNotification.type, {
				textDocument: { uri, languageId: langId, version: Date.now(), text: content },
			});
		} catch {
			// File may have been deleted
		}
	}

	private getLanguageId(filePath: string): string {
		const ext = path.extname(filePath);
		const map: Record<string, string> = {
			".ts": "typescript",
			".tsx": "typescriptreact",
			".js": "javascript",
			".jsx": "javascriptreact",
			".rs": "rust",
			".go": "go",
			".py": "python",
		};
		return map[ext] ?? "plaintext";
	}

	private getConnectionForFile(filePath: string): ServerConnection | undefined {
		const ext = path.extname(filePath);
		if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) return this.connections.get("typescript");
		if ([".rs"].includes(ext)) return this.connections.get("rust");
		if ([".go"].includes(ext)) return this.connections.get("go");
		if ([".py"].includes(ext)) return this.connections.get("python");
		// Fall back to first available
		return this.connections.values().next().value ?? undefined;
	}

	async shutdown() {
		for (const [, { connection, process: proc }] of this.connections) {
			try {
				await connection.sendRequest(lsp.ShutdownRequest.type);
				connection.sendNotification(lsp.ExitNotification.type);
			} catch {
				/* ignore */
			}
			proc.kill();
		}
		this.connections.clear();
	}
}
