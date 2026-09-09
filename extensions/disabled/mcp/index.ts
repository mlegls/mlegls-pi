import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type ServerConfig = { type?: string; command: string; args?: string[]; env?: Record<string, string> };
type Connection = { client: Client; transport: StdioClientTransport; tools: string[] };

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
const registryPath = () => process.env.MCP_REGISTRY || path.join(homedir(), ".config/mcp/servers.json");

export default function (pi: ExtensionAPI) {
	const connections = new Map<string, Connection>();

	async function stop(name: string) {
		const connection = connections.get(name);
		if (!connection) throw new Error(`MCP server is not running: ${name}`);
		pi.setActiveTools(pi.getActiveTools().filter((tool) => !connection.tools.includes(tool)));
		connections.delete(name);
		await connection.client.close();
	}

	pi.registerCommand("mcp", {
		description: "Start, stop, or list manually managed MCP servers",
		handler: async (input, ctx) => {
			const [action = "status", name] = input.trim().split(/\s+/);
			if (action === "status" || action === "list") {
				const running = [...connections.keys()];
				ctx.ui.notify(running.length ? `MCP running: ${running.join(", ")}` : "No MCP servers running", "info");
				return;
			}
			if (!name || !["start", "stop"].includes(action)) {
				ctx.ui.notify("Usage: /mcp start <name> | /mcp stop <name> | /mcp status", "error");
				return;
			}
			try {
				if (action === "stop") {
					await stop(name);
					ctx.ui.notify(`Stopped MCP server: ${name}`, "info");
					return;
				}
				if (connections.has(name)) throw new Error(`MCP server is already running: ${name}`);
				const registry = JSON.parse(await readFile(registryPath(), "utf8")) as Record<string, ServerConfig>;
				const config = registry[name];
				if (!config) throw new Error(`Unknown MCP server: ${name}`);
				if (config.type && config.type !== "stdio") throw new Error("Pi MCP currently supports stdio servers only");

				const transport = new StdioClientTransport({
					command: config.command,
					args: config.args,
					env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
					cwd: ctx.cwd,
					stderr: "pipe",
				});
				const client = new Client({ name: "mlegls-pi", version: "0.1.0" });
				await client.connect(transport);
				const listed = await client.listTools();
				const toolNames: string[] = [];
				for (const tool of listed.tools) {
					const exposedName = `mcp_${safeName(name)}_${safeName(tool.name)}`;
					toolNames.push(exposedName);
					pi.registerTool({
						name: exposedName,
						label: `${name}: ${tool.name}`,
						description: tool.description || `MCP tool ${tool.name} from ${name}`,
						parameters: Type.Unsafe(tool.inputSchema),
						async execute(_id, params) {
							const result = await client.callTool({ name: tool.name, arguments: params as Record<string, unknown> });
							return { content: [{ type: "text", text: JSON.stringify(result.content) }], details: result };
						},
					});
				}
				connections.set(name, { client, transport, tools: toolNames });
				pi.setActiveTools([...new Set([...pi.getActiveTools(), ...toolNames])]);
				ctx.ui.notify(`Started ${name}: ${toolNames.length} tools enabled`, "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});

	pi.on("session_shutdown", async () => {
		await Promise.allSettled([...connections.values()].map((connection) => connection.client.close()));
		connections.clear();
	});
}
