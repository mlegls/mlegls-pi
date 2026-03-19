import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { LspClientManager } from "./lsp-client";

export default function (pi: ExtensionAPI) {
	const lsp = new LspClientManager();

	// Start LSP servers on session start
	pi.on("session_start", async (_event, ctx) => {
		await lsp.autoDetectAndStart(ctx.cwd);
		ctx.ui.setStatus("lsp", lsp.isRunning() ? "LSP ✓" : "LSP ✗");
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
				.map((d) => `${d.file}:${d.line}:${d.col} [${d.severity}] ${d.message}`)
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
					.map((d) => `  ${d.file}:${d.line} [${d.severity}] ${d.message}`)
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
		description: "Manage LSP servers: /lsp [status|stop|restart]",
		getArgumentCompletions: (prefix: string) => {
			const options = ["status", "stop", "restart"];
			const filtered = options
				.filter((o) => o.startsWith(prefix))
				.map((o) => ({ value: o, label: o }));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			switch (args?.trim()) {
				case "status":
					ctx.ui.notify(lsp.getStatus(), "info");
					break;
				case "stop":
					await lsp.shutdown();
					ctx.ui.setStatus("lsp", "LSP ✗");
					ctx.ui.notify("LSP servers stopped", "info");
					break;
				case "restart":
					await lsp.shutdown();
					await lsp.autoDetectAndStart(ctx.cwd);
					ctx.ui.setStatus("lsp", lsp.isRunning() ? "LSP ✓" : "LSP ✗");
					ctx.ui.notify("LSP servers restarted", "info");
					break;
				default:
					ctx.ui.notify("Usage: /lsp [status|stop|restart]", "info");
			}
		},
	});
}
