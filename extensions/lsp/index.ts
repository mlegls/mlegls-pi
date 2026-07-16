import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { TextEdit, WorkspaceEdit } from "vscode-languageserver-protocol";
import { LspClientManager, loadServerConfigs } from "./lsp-client";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_FILE = "servers.json";

interface FileEdits {
	path: string;
	edits: TextEdit[];
}

function workspaceEditFiles(edit: WorkspaceEdit, cwd: string): FileEdits[] {
	const byPath = new Map<string, TextEdit[]>();
	const add = (uri: string, edits: TextEdit[]) => {
		const filePath = fileURLToPath(uri);
		const relative = path.relative(cwd, filePath);
		if (relative.startsWith("..") || path.isAbsolute(relative)) {
			throw new Error(`LSP edit targets a file outside the workspace: ${filePath}`);
		}
		byPath.set(filePath, [...(byPath.get(filePath) ?? []), ...edits]);
	};

	for (const [uri, edits] of Object.entries(edit.changes ?? {})) add(uri, edits);
	for (const change of edit.documentChanges ?? []) {
		if (!("textDocument" in change)) {
			throw new Error("LSP file create, rename, and delete operations are not supported");
		}
		add(change.textDocument.uri, change.edits);
	}

	return [...byPath.entries()]
		.map(([filePath, edits]) => ({ path: filePath, edits }))
		.sort((a, b) => a.path.localeCompare(b.path));
}

function positionOffset(text: string, line: number, character: number): number {
	const lines = text.split("\n");
	if (line < 0 || line >= lines.length || character < 0 || character > lines[line].length) {
		throw new Error(`Invalid LSP edit position ${line + 1}:${character + 1}`);
	}
	let offset = 0;
	for (let i = 0; i < line; i++) offset += lines[i].length + 1;
	return offset + character;
}

async function applyWorkspaceEdit(edit: WorkspaceEdit, cwd: string): Promise<FileEdits[]> {
	const files = workspaceEditFiles(edit, cwd);
	if (files.length === 0) throw new Error("The LSP action returned no file edits");

	const writeFiles = async () => {
		for (const file of files) {
			const original = await fs.readFile(file.path, "utf-8");
			const edits = file.edits.map((item) => ({
				item,
				start: positionOffset(original, item.range.start.line, item.range.start.character),
				end: positionOffset(original, item.range.end.line, item.range.end.character),
			})).sort((a, b) => b.start - a.start || b.end - a.end);

			for (let i = 1; i < edits.length; i++) {
				if (edits[i - 1].start < edits[i].end) throw new Error(`Overlapping LSP edits for ${file.path}`);
			}

			let updated = original;
			for (const { item, start, end } of edits) {
				updated = updated.slice(0, start) + item.newText + updated.slice(end);
			}
			await fs.writeFile(file.path, updated, "utf-8");
		}
	};

	const applyQueued = async (index: number): Promise<void> => {
		if (index >= files.length) return writeFiles();
		await withFileMutationQueue(files[index].path, async () => applyQueued(index + 1));
	};

	await applyQueued(0);
	return files;
}

export default function (pi: ExtensionAPI) {
	const configPath = path.join(__dirname, CONFIG_FILE);
	const configs = loadServerConfigs(configPath);
	const lsp = new LspClientManager(configs);

	// Start LSP servers on session start
	pi.on("session_start", async (_event, ctx) => {
		try {
			await lsp.autoDetectAndStart(ctx.cwd);
		} catch {
			// Don't let LSP startup failures crash pi
		}
		ctx.ui.setStatus("lsp", lsp.getFooter());
	});

	// Shutdown servers on exit
	pi.on("session_shutdown", async () => {
		await lsp.shutdown();
	});

	// === Tool 1: Get diagnostics (errors/warnings) ===
	pi.registerTool({
		name: "lsp_diagnostics",
		label: "LSP Diagnostics",
		description: "Get compiler errors, warnings, and lint issues for a file or the whole project",
		promptSnippet: "Get compiler errors and warnings from the language server",
		promptGuidelines: [
			"Use lsp_diagnostics after editing files to check for errors before finishing.",
			"Use lsp_diagnostics when the user reports build or type errors.",
		],
		parameters: Type.Object({
			path: Type.Optional(Type.String({ description: "File path (omit for all open files)" })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const filePath = params.path?.replace(/^@/, "");
			const diagnostics = await lsp.getDiagnostics(filePath);
			ctx.ui.setStatus("lsp", lsp.getFooter());

			if (diagnostics.length === 0) {
				return {
					content: [{ type: "text" as const, text: "No diagnostics found." }],
					details: { count: 0 },
				};
			}

			const text = diagnostics
				.map((d) => `${d.file}:${d.line}:${d.col} [${d.severity}] (${d.source}) ${d.message}`)
				.join("\n");

			return {
				content: [{ type: "text" as const, text }],
				details: { count: diagnostics.length, diagnostics },
			};
		},
	});

	// === Tool 2: Go to definition / find references / hover ===
	pi.registerTool({
		name: "lsp_lookup",
		label: "LSP Lookup",
		description: "Find definition, references, or type info for a symbol at a location",
		promptSnippet: "Find definition, references, or hover info for a symbol",
		parameters: Type.Object({
			path: Type.String({ description: "File path" }),
			line: Type.Number({ description: "Line number (1-indexed)" }),
			column: Type.Number({ description: "Column number (1-indexed)" }),
			action: StringEnum(["definition", "references", "hover"] as const, {
				description: "What to look up",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const filePath = params.path.replace(/^@/, "");
			const result = await lsp.lookup(filePath, params.line - 1, params.column - 1, params.action);
			ctx.ui.setStatus("lsp", lsp.getFooter());

			if (!result) {
				return {
					content: [{ type: "text" as const, text: "No results found." }],
					details: {},
				};
			}

			return {
				content: [{ type: "text" as const, text: result.text }],
				details: result,
			};
		},
	});

	// === Tool 3: Get completions (useful for API discovery) ===
	pi.registerTool({
		name: "lsp_completions",
		label: "LSP Completions",
		description: "Get code completions at a position to discover available APIs and methods",
		promptSnippet: "Get code completions at a file position",
		parameters: Type.Object({
			path: Type.String({ description: "File path" }),
			line: Type.Number({ description: "Line number (1-indexed)" }),
			column: Type.Number({ description: "Column number (1-indexed)" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const filePath = params.path.replace(/^@/, "");
			const items = await lsp.getCompletions(filePath, params.line - 1, params.column - 1);
			ctx.ui.setStatus("lsp", lsp.getFooter());

			if (items.length === 0) {
				return {
					content: [{ type: "text" as const, text: "No completions." }],
					details: { count: 0 },
				};
			}

			const text = items
				.slice(0, 50)
				.map((i) => `${i.label} (${i.kind})${i.detail ? ` ${i.detail}` : ""}`)
				.join("\n");

			const truncated = items.length > 50 ? `\n\n[Showing 50 of ${items.length} completions]` : "";

			return {
				content: [{ type: "text" as const, text: text + truncated }],
				details: { count: items.length },
			};
		},
	});

	// === Tool 4: Rename a symbol and apply the workspace edit ===
	pi.registerTool({
		name: "lsp_rename",
		label: "LSP Rename",
		description: "Rename a symbol across the workspace using the language server and apply all returned edits",
		promptSnippet: "Rename a symbol safely across files using the language server",
		promptGuidelines: [
			"Use lsp_rename instead of manual search-and-replace when renaming a code symbol across files.",
		],
		parameters: Type.Object({
			path: Type.String({ description: "File containing the symbol" }),
			line: Type.Number({ description: "Symbol line number (1-indexed)" }),
			column: Type.Number({ description: "Symbol column number (1-indexed)" }),
			newName: Type.String({ description: "New symbol name" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const filePath = params.path.replace(/^@/, "");
			const edit = await lsp.getRenameEdit(filePath, params.line - 1, params.column - 1, params.newName);
			ctx.ui.setStatus("lsp", lsp.getFooter());
			if (!edit) throw new Error("The language server did not return a rename edit");

			const files = await applyWorkspaceEdit(edit, ctx.cwd);
			for (const file of files) await lsp.notifyFileChanged(file.path);
			const editCount = files.reduce((count, file) => count + file.edits.length, 0);
			return {
				content: [{ type: "text" as const, text: `Renamed symbol to ${params.newName}: ${editCount} edits in ${files.length} files.` }],
				details: { files: files.map((file) => file.path), editCount },
			};
		},
	});

	// === Tool 5: List or apply LSP code actions ===
	pi.registerTool({
		name: "lsp_code_actions",
		label: "LSP Code Actions",
		description: "List code actions at a source range, or apply one edit-based action by its exact title",
		promptSnippet: "List and apply language-server code actions and quick fixes",
		promptGuidelines: [
			"Use lsp_code_actions with action 'list' before applying a quick fix, then apply an edit-based action by its exact title.",
		],
		parameters: Type.Object({
			path: Type.String({ description: "Source file path" }),
			line: Type.Number({ description: "Start line (1-indexed)" }),
			column: Type.Number({ description: "Start column (1-indexed)" }),
			endLine: Type.Optional(Type.Number({ description: "End line (1-indexed); defaults to start line" })),
			endColumn: Type.Optional(Type.Number({ description: "End column (1-indexed); defaults to start column" })),
			action: StringEnum(["list", "apply"] as const, { description: "List available actions or apply one" }),
			title: Type.Optional(Type.String({ description: "Exact action title; required when applying" })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (params.action === "apply" && !params.title) throw new Error("title is required when applying a code action");
			const filePath = params.path.replace(/^@/, "");
			const result = await lsp.getCodeActions(filePath, {
				start: { line: params.line - 1, character: params.column - 1 },
				end: {
					line: (params.endLine ?? params.line) - 1,
					character: (params.endColumn ?? params.column) - 1,
				},
			}, params.action === "apply" ? params.title : undefined);
			ctx.ui.setStatus("lsp", lsp.getFooter());

			if (params.action === "list") {
				if (result.actions.length === 0) return { content: [{ type: "text" as const, text: "No code actions available." }], details: { actions: [] } };
				const text = result.actions.map((item) => {
					const flags = [item.kind, item.preferred ? "preferred" : undefined, item.hasEdit ? "editable" : "command-only", item.disabled ? `disabled: ${item.disabled}` : undefined].filter(Boolean);
					return `${item.title}${flags.length ? ` (${flags.join(", ")})` : ""}`;
				}).join("\n");
				return { content: [{ type: "text" as const, text }], details: { actions: result.actions } };
			}

			if (!result.selectedTitle) throw new Error(`Code action title was not found or was ambiguous: ${params.title}`);
			if (!result.edit) throw new Error(`Code action cannot be applied because it has no workspace edit: ${params.title}`);
			const files = await applyWorkspaceEdit(result.edit, ctx.cwd);
			for (const file of files) await lsp.notifyFileChanged(file.path);
			const editCount = files.reduce((count, file) => count + file.edits.length, 0);
			return {
				content: [{ type: "text" as const, text: `Applied “${result.selectedTitle}”: ${editCount} edits in ${files.length} files.` }],
				details: { title: result.selectedTitle, files: files.map((file) => file.path), editCount },
			};
		},
	});

	// Lazily discover project roots and open files after successful file access.
	pi.on("tool_result", async (event, ctx) => {
		if (!event.isError && (event.toolName === "read" || event.toolName === "write" || event.toolName === "edit")) {
			const filePath = (event.input as any)?.path;
			if (filePath) {
				await lsp.notifyFileChanged(filePath);
				ctx.ui.setStatus("lsp", lsp.getFooter());
			}
		}
	});

	// === /lsp command for manual control ===
	pi.registerCommand("lsp", {
		description: "Manage LSP servers: /lsp [status|start|stop|restart|list]",
		getArgumentCompletions: (prefix: string) => {
			const subcommands = ["status", "start", "stop", "restart", "list"];
			const parts = prefix.split(/\s+/);
			const sub = parts[0] ?? "";
			const arg = parts[1] ?? "";

			// Completing the subcommand
			if (parts.length <= 1) {
				const filtered = subcommands
					.filter((s) => s.startsWith(sub))
					.map((s) => ({ value: s, label: s }));
				return filtered.length > 0 ? filtered : null;
			}

			// Completing server name for start/stop/restart
			if (sub === "start") {
				const running = new Set(lsp.getRunningNames());
				const stopped = lsp
					.getConfigs()
					.filter((c) => !running.has(c.name))
					.map((c) => c.name);
				const filtered = stopped
					.filter((n) => n.startsWith(arg))
					.map((n) => ({ value: `${sub} ${n}`, label: n }));
				return filtered.length > 0 ? filtered : null;
			}

			if (sub === "stop" || sub === "restart") {
				const running = lsp.getRunningNames();
				const filtered = running
					.filter((n) => n.startsWith(arg))
					.map((n) => ({ value: `${sub} ${n}`, label: n }));
				return filtered.length > 0 ? filtered : null;
			}

			return null;
		},
		handler: async (args, ctx) => {
			const parts = args?.trim().split(/\s+/) ?? [];
			const sub = parts[0];
			const serverName = parts[1];

			switch (sub) {
				case "status": {
					const running = lsp.getRunningServers();
					if (running.length === 0) {
						ctx.ui.notify("No LSP servers running", "info");
					} else {
						const lines = running.map(({ name, rootPath }) => `  ● ${name} (${rootPath})`);
						ctx.ui.notify(`LSP servers:\n${lines.join("\n")}`, "info");
					}
					break;
				}
				case "start": {
					if (serverName) {
						const ok = await lsp.startByName(serverName, ctx.cwd);
						ctx.ui.setStatus("lsp", lsp.getFooter());
						ctx.ui.notify(ok ? `Started ${serverName}` : `Failed to start ${serverName}`, ok ? "info" : "error");
					} else {
						// Start all detected
						await lsp.autoDetectAndStart(ctx.cwd);
						ctx.ui.setStatus("lsp", lsp.getFooter());
						ctx.ui.notify(lsp.isRunning() ? `Started: ${lsp.getRunningNames().join(", ")}` : "No servers detected", "info");
					}
					break;
				}
				case "stop": {
					if (serverName) {
						const ok = await lsp.stopByName(serverName);
						ctx.ui.setStatus("lsp", lsp.getFooter());
						ctx.ui.notify(ok ? `Stopped ${serverName}` : `${serverName} is not running`, ok ? "info" : "error");
					} else {
						await lsp.shutdown();
						ctx.ui.setStatus("lsp", lsp.getFooter());
						ctx.ui.notify("All LSP servers stopped", "info");
					}
					break;
				}
				case "restart": {
					// Reload config on restart
					lsp.setConfigs(loadServerConfigs(configPath));
					if (serverName) {
						await lsp.stopByName(serverName);
						const ok = await lsp.startByName(serverName, ctx.cwd);
						ctx.ui.setStatus("lsp", lsp.getFooter());
						ctx.ui.notify(ok ? `Restarted ${serverName}` : `Failed to restart ${serverName}`, ok ? "info" : "error");
					} else {
						await lsp.shutdown();
						await lsp.autoDetectAndStart(ctx.cwd);
						ctx.ui.setStatus("lsp", lsp.getFooter());
						ctx.ui.notify("LSP servers restarted", "info");
					}
					break;
				}
				case "list": {
					const configs = lsp.getConfigs();
					const running = lsp.getRunningServers();
					const lines = configs.map((c) => {
						const roots = running.filter((server) => server.name === c.name).map((server) => server.rootPath);
						const status = roots.length > 0 ? "●" : "○";
						const suffix = roots.length > 0 ? ` — ${roots.join(", ")}` : "";
						return `  ${status} ${c.name}: ${c.command} ${c.args.join(" ")} [${c.fileExtensions.join(", ")}]${suffix}`;
					});
					ctx.ui.notify(`Configured servers:\n${lines.join("\n")}`, "info");
					break;
				}
				default:
					ctx.ui.notify("Usage: /lsp [status|start|stop|restart|list] [server]", "info");
			}
		},
	});
}
