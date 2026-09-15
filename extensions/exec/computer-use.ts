import { STATE_ENTRY, journal, replayContext } from "./desktop-restore";
import { captureSummary, discover, discoveryRequested } from "./desktop-discovery";
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
	const outlines = new Map<string, any>();
	let generation = 0;
	let acceptingCalls = false;
	let sessionId: string | undefined;
	let lifecycleAbort = new AbortController();
	let lifecycleWork = Promise.resolve();
	const pending = new Set<Promise<unknown>>();
	type LifecycleHandler = (event: any, ctx: ExtensionContext) => unknown;
	const starts: LifecycleHandler[] = [];
	const stops: LifecycleHandler[] = [];

	async function lifecycle(ctx: ExtensionContext, stopEvent?: unknown, startEvent?: unknown) {
		const current = ++generation;
		acceptingCalls = false;
		lifecycleAbort.abort(new Error("Computer-use session or branch changed"));
		lifecycleAbort = new AbortController();
		lifecycleWork = lifecycleWork.catch(() => {}).then(async () => {
			await Promise.allSettled([...pending]);
			if (stopEvent) for (const handler of stops) await handler(stopEvent, ctx);
			if (current !== generation) return;
			outlines.clear();
			if (startEvent) for (const entry of replayContext(ctx).sessionManager.getBranch() as any[]) {
				const d = entry.message?.details;
				if (d?.outline?.root && d.capture?.stateId) outlines.set(d.capture.stateId, d);
			}
			if (startEvent) for (const handler of starts) await handler(startEvent, replayContext(ctx));
			if (current !== generation) return;
			sessionId = ctx.sessionManager.getSessionId();
			acceptingCalls = startEvent !== undefined;
		});
		return lifecycleWork;
	}
	const names = new Set<string>(Object.values(computerUseTools));
	const registerTool: ExtensionAPI["registerTool"] = (tool) => {
		pi.registerTool(tool);
		if (names.has(tool.name)) tools.set(tool.name, tool);
	};
	await factory(new Proxy(pi, {
		get(target, key) {
			if (key === "registerTool") return registerTool;
			if (key === "on") return (event: string, handler: (...args: any[]) => any) => {
				if (event === "session_start") { starts.push(handler); return; }
				if (event === "session_shutdown") { stops.push(handler); return; }
				return pi.on(event as "session_start", handler);
			};
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}));
	pi.on("session_start", (event, ctx) => lifecycle(ctx, undefined, event));
	pi.on("session_shutdown", (event, ctx) => lifecycle(ctx, event));
	// Upstream has no tree hook. Its shutdown clears resources; its start clears
	// all cached states/output refs even when the destination branch is empty.
	pi.on("session_tree", (_event, ctx) => lifecycle(ctx, { reason: "reload" }, { reason: "reload" }));
	return {
		async call(method, args, ctx, signal) {
			signal.throwIfAborted();
			if (method === "help") {
				const requested = (args as { method?: string } | undefined)?.method;
				if (requested !== undefined && !Object.hasOwn(computerUseTools, requested)) throw new Error("Unknown ui method: " + requested);
				return Object.entries(computerUseTools).filter(([method]) => requested === undefined || method === requested).map(([method, name]) => {
					const tool = tools.get(name);
					if (!tool) throw new Error("Installed pi-computer-use did not register " + name);
					return { ...(method === "search" ? { discovery: { subrole: "Exact AX-normalized subrole", unlabeled: "Filter empty labels", limit: "1..1000, default 50; enables cached-outline discovery", semantics: "Requires stateId from an observed outline. Exact role/subrole/capability, substring text. complete=false for omitted matches or truncated nodes; no native OCR escalation." } } : {}), method, name, description: tool.description, parameters: tool.parameters, promptSnippet: tool.promptSnippet, promptGuidelines: tool.promptGuidelines };
				});
			}
			const current = generation;
			const callerSessionId = ctx.sessionManager.getSessionId();
			signal = AbortSignal.any([signal, lifecycleAbort.signal]);
			function checkCurrent() {
				signal.throwIfAborted();
				if (!acceptingCalls || current !== generation || callerSessionId !== ctx.sessionManager.getSessionId()
					|| (sessionId !== undefined && callerSessionId !== sessionId)) throw new Error("Computer-use session or branch changed");
			}
			checkCurrent();
			if (!Object.hasOwn(computerUseTools, method)) throw new Error(`Unknown ui method: ${method}`);
			if (method === "search" && discoveryRequested(args)) {
				const query = args as any;
				const snapshot = outlines.get(query.stateId);
				if (!snapshot) throw new Error("ui.search discovery needs stateId from an observed full outline; observe again");
				const result = discover(snapshot, query);
				// Let the original executor enforce live state/epoch fences, even for cached reads.
				const verified = await this.call("inspect", { stateId: query.stateId, ref: snapshot.outline.root.ref }, ctx, signal) as any;
				checkCurrent();
				if (verified.isError) return verified;
				return result;
			}
			const name = computerUseTools[method as keyof typeof computerUseTools];
			const tool = tools.get(name);
			if (!tool) throw new Error(`Installed pi-computer-use did not register ${name}`);
			const input = tool.prepareArguments ? tool.prepareArguments(args ?? {}) : args ?? {};
			if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`ui.${method} expects an argument object`);
			const id = `exec-ui-${randomUUID()}`;
			const params = validateToolArguments(tool, { type: "toolCall", id, name, arguments: input });
			const operation = tool.execute(id, params, signal, undefined, ctx);
			pending.add(operation);
			try {
				const result = await operation;
				checkCurrent();
				const record = journal(name, result.details);
				if (record) pi.appendEntry(STATE_ENTRY, record);
				const d = result.details as any;
				const stateId = d?.capture?.stateId ?? d?.stateId;
				if (stateId && d?.outline?.root) outlines.set(stateId, d);
				return { ...result, capture: captureSummary(d) };
			} finally {
				pending.delete(operation);
			}
		},
	};
}
