import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { validateToolArguments } from "@earendil-works/pi-ai";
import * as piCodingAgent from "@earendil-works/pi-coding-agent";
import { getAgentDir, type ExtensionAPI, type ExtensionContext, type ExtensionFactory, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

export const computerUseTools = {
	findRoots: "find_roots",
	observe: "observe_ui",
	search: "search_ui",
	expand: "expand_ui",
	inspect: "inspect_ui",
	act: "act_ui",
	readText: "read_text",
	waitFor: "wait_for",
} as const;

export interface ComputerUseBridge {
	/** Raw tool content (including screenshots) and details; do not stringify for display. */
	call(method: string, args: unknown, ctx: ExtensionContext, signal: AbortSignal): Promise<unknown>;
}

const STATE_ENTRY = "exec-computer-use";

// Upstream restores only native toolResult entries. Project our image-free custom
// journal into that view without changing the actual conversation or session tree.
function replayContext(ctx: ExtensionContext): ExtensionContext {
	const sessionManager = new Proxy(ctx.sessionManager, {
		get(target, key) {
			if (key === "getBranch") return () => target.getBranch().map((entry) => {
				if (entry.type !== "custom" || entry.customType !== STATE_ENTRY) return entry;
				const data = entry.data as { toolName: string; details: unknown };
				return { ...entry, type: "message", message: {
					role: "toolResult", toolName: data.toolName, toolCallId: entry.id,
					content: [], details: data.details, isError: false,
					timestamp: Date.parse(entry.timestamp),
				} };
			});
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return new Proxy(ctx, { get: (target, key) => key === "sessionManager" ? sessionManager : Reflect.get(target, key, target) });
}

/** Resolve the installed extension entry, never a second copy of its stateful bridge internals. */
export async function loadComputerUseFactory(): Promise<ExtensionFactory> {
	const entry = "@injaneity/pi-computer-use/extensions/computer-use.ts";
	let path: string | undefined;
	for (const base of [import.meta.url, join(getAgentDir(), "npm", "package.json")]) {
		try {
			path = createRequire(base).resolve(entry);
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") throw error;
		}
	}
	if (!path) throw new Error("ui requires @injaneity/pi-computer-use; install it with pi install npm:@injaneity/pi-computer-use and disable its independent extension entry before enabling the exec bridge.");
	const factory = await createJiti(import.meta.url, {
		virtualModules: { "@earendil-works/pi-coding-agent": piCodingAgent },
	}).import<ExtensionFactory>(path, { default: true });
	if (typeof factory !== "function") throw new Error("pi-computer-use extension does not export a factory");
	return factory;
}

/**
 * Initialize once during the owning extension's async factory, before session_start.
 * The package's independent extension entry MUST be disabled in Pi's package filter.
 * Every upstream registration is forwarded: upstream retains configuration, setup,
 * commands, session reconstruction, shutdown, and the only computer-use manager.
 *
 * Pi getAllTools() exposes metadata, not executors. Capturing registerTool is the
 * composition seam; neither private Pi registries nor upstream internals are used.
 * Calls validate the original schema and preserve checked actions, state IDs, refs,
 * content, and errors. They are nested exec operations, not separate Pi tool events.
 * The child must render result.content as content blocks so images reach show().
 */
export async function createComputerUseBridge(
	pi: ExtensionAPI,
	factory?: ExtensionFactory,
): Promise<ComputerUseBridge> {
	if (!factory) {
		try { factory = await loadComputerUseFactory(); }
		catch (error) {
			return { async call() { throw new Error("ui unavailable: " + (error instanceof Error ? error.message : String(error)), { cause: error }); } };
		}
	}
	const tools = new Map<string, Omit<ToolDefinition<any, any>, "renderCall" | "renderResult">>();
	const names = new Set<string>(Object.values(computerUseTools));
	const registerTool: ExtensionAPI["registerTool"] = (tool) => {
		pi.registerTool(tool);
		if (names.has(tool.name)) tools.set(tool.name, tool);
	};
	await factory(new Proxy(pi, {
		get(target, key) {
			if (key === "registerTool") return registerTool;
			if (key === "on") return (event: string, handler: (...args: any[]) => any) => {
				return pi.on(event as "session_start", event === "session_start"
					? (event, ctx) => handler(event, replayContext(ctx))
					: handler);
			};
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}));
	return {
		async call(method, args, ctx, signal) {
			signal.throwIfAborted();
			if (method === "help") {
				const requested = (args as { method?: string } | undefined)?.method;
				if (requested !== undefined && !Object.hasOwn(computerUseTools, requested)) throw new Error("Unknown ui method: " + requested);
				return Object.entries(computerUseTools).filter(([method]) => requested === undefined || method === requested).map(([method, name]) => {
					const tool = tools.get(name);
					if (!tool) throw new Error("Installed pi-computer-use did not register " + name);
					return { method, name, description: tool.description, parameters: tool.parameters, promptSnippet: tool.promptSnippet, promptGuidelines: tool.promptGuidelines };
				});
			}
			if (!Object.hasOwn(computerUseTools, method)) throw new Error(`Unknown ui method: ${method}`);
			const name = computerUseTools[method as keyof typeof computerUseTools];
			const tool = tools.get(name);
			if (!tool) throw new Error(`Installed pi-computer-use did not register ${name}`);
			const input = tool.prepareArguments ? tool.prepareArguments(args ?? {}) : args ?? {};
			if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`ui.${method} expects an argument object`);
			const id = `exec-ui-${randomUUID()}`;
			const params = validateToolArguments(tool, { type: "toolCall", id, name, arguments: input });
			const result = await tool.execute(id, params, signal, undefined, ctx);
			pi.appendEntry(STATE_ENTRY, { toolName: name, details: result.details });
			return result;
		},
	};
}
