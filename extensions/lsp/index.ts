import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { LspClientManager, loadServerConfigs } from "./lsp-client";
import * as path from "node:path";

const CONFIG_FILE = "servers.json";

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
		async execute(_toolCallId, params) {
			const filePath = params.path?.replace(/^@/, "");
			const diagnostics = await lsp.getDiagnostics(filePath);

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
		async execute(_toolCallId, params) {
			const filePath = params.path.replace(/^@/, "");
			const result = await lsp.lookup(filePath, params.line - 1, params.column - 1, params.action);

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
		async execute(_toolCallId, params) {
			const filePath = params.path.replace(/^@/, "");
			const items = await lsp.getCompletions(filePath, params.line - 1, params.column - 1);

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

	// === Notify LSP when files are written/edited ===
	pi.on("tool_result", async (event) => {
		if ((event.toolName === "write" || event.toolName === "edit") && lsp.isRunning()) {
			const filePath = (event.input as any)?.path;
			if (filePath) {
				await lsp.notifyFileChanged(filePath);
			}
		}
	});

	// === Inject current diagnostics into context before agent starts ===
	pi.on("before_agent_start", async () => {
		if (!lsp.isRunning()) return;

		const diagnostics = await lsp.getDiagnostics();
		if (diagnostics.length > 0) {
			const summary =
				`Current LSP diagnostics (${diagnostics.length} issues):\n` +
				diagnostics
					.slice(0, 20)
					.map((d) => `  ${d.file}:${d.line} [${d.severity}] (${d.source}) ${d.message}`)
					.join("\n") +
				(diagnostics.length > 20 ? `\n  ... and ${diagnostics.length - 20} more` : "");

			return {
				message: {
					customType: "lsp-diagnostics",
					content: summary,
					display: false,
				},
			};
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
					const running = lsp.getRunningNames();
					const configs = lsp.getConfigs();
					if (running.length === 0) {
						ctx.ui.notify("No LSP servers running", "info");
					} else {
						const lines = configs.map((c) => {
							const active = running.includes(c.name);
							return `  ${active ? "●" : "○"} ${c.name} (${c.command})`;
						});
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
					const running = new Set(lsp.getRunningNames());
					const lines = configs.map((c) => {
						const status = running.has(c.name) ? "●" : "○";
						return `  ${status} ${c.name}: ${c.command} ${c.args.join(" ")} [${c.fileExtensions.join(", ")}]`;
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
