import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { LedgerEntry } from "../../lib/outline-read/ledger";
import { Kernel, mergeText, type KernelLate } from "./kernel";
import type { ContentBlock } from "./image";
import { createExecServices, type ExecServices } from "./services";
import { createComputerUseBridge } from "./computer-use";
import { MODULES, resolveModules, describeModules, resolveProfile, type ExecProfile, type ExecModule } from "./modules";
import { renderCall, renderResult } from "./render";
import { ingressContext } from "./ingress-context";

const ENTRY_TYPE = "outline-read";
const REPLACED = new Set(["write", "session_spawn", "session_wait", "session", "find_roots", "observe_ui", "search_ui", "expand_ui", "inspect_ui", "act_ui", "read_text", "wait_for", "launch_browser", "navigate_browser", "evaluate_browser", "bash", "sh", "read", "edit", "grep", "find", "exa_search", "exa_contents", "wm_spawn", "wm_wait", "wm", "board_send", "board_read", "board_list", "board_subscribe"]);

export default async function (pi: ExtensionAPI) {
	pi.registerFlag("exec-modules", { type: "string", description: "Exec module allowlist: " + MODULES.join(",") + " (* = all, none = core only)" });
	pi.registerFlag("exec-deny-modules", { type: "string", description: "Exec module denylist; overrides --exec-modules" });
	pi.registerFlag("exec-profile", { type: "string", description: "Exec API profile: default or reader (not a security sandbox)" });
	let profile: ExecProfile = "default";
	let modules: ExecModule[] = [...MODULES];
	let configurationError: string | undefined;
	const ui = await createComputerUseBridge(pi);
	let kernel: Kernel | undefined;
	let services: ExecServices | undefined;
	let generation = 0;
	// Output handles (c<cell>.<call>) are numbered per session branch, so they stay unambiguous across kernel resets and reloads.
	let nextCell = 1;
	// Late output waits for a listening point: the next exec result, or the agent settling.
	let queue: KernelLate[] = [];
	let running = 0;
	let busy = false;
	let flushTimer: ReturnType<typeof setTimeout> | undefined;

	function drain(): ContentBlock[] {
		const content = mergeText(queue.flatMap(event => [
			{ type: "text" as const, text: `[${event.handle}]${event.error ? " failed" : ""}\n` },
			...event.content,
			...(event.error ? [{ type: "text" as const, text: event.error + "\n" }] : []),
		]));
		queue = [];
		return content;
	}

	function flush() {
		clearTimeout(flushTimer);
		flushTimer = undefined;
		if (running || busy || queue.every(event => event.passive)) return;
		const handles = queue.map(event => event.handle);
		pi.sendMessage({ customType: "exec-output", content: drain(), display: true, details: { handles } }, { triggerTurn: true, deliverAs: "followUp" });
	}

	function scheduleFlush() {
		if (!flushTimer) flushTimer = setTimeout(flush, 250);
	}

	async function reset(ctx?: ExtensionContext, session = false) {
		generation++;
		const old = kernel;
		kernel = undefined;
		await old?.dispose();
		if (session) services = undefined;
		if (!ctx) return;
		try {
			profile = resolveProfile(process.env.PI_EXEC_PROFILE ?? pi.getFlag("exec-profile"));
			modules = resolveModules(pi.getFlag("exec-modules"), pi.getFlag("exec-deny-modules"));
			if (profile === "reader") modules = modules.filter(name => name === "fs" || name === "exa");
			configurationError = undefined;
		} catch (error) {
			modules = [];
			configurationError = String(error);
		}
		registerExec();
		if (configurationError) throw new Error(configurationError);
		services ??= createExecServices(pi, ctx, { ui });
		const current = generation;
		queue = [];
		if (session) {
			nextCell = 1;
			for (const entry of ctx.sessionManager.getBranch() as any[]) {
				const message = entry.type === "message" ? entry.message : undefined;
				const cell = message?.role === "toolResult" && message.toolName === "exec" ? message.details?.cell : undefined;
				if (typeof cell === "number" && cell >= nextCell) nextCell = cell + 1;
			}
		}
		const ledger: LedgerEntry[] = [];
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) ledger.push(entry.data as LedgerEntry);
		}
		kernel = new Kernel({
			cwd: ctx.cwd,
			sessionFile: ctx.sessionManager.getSessionFile(),
			modules,
			profile,
			call: services.call,
			ledger,
			persist(entry) {
				if (current === generation) pi.appendEntry(ENTRY_TYPE, entry);
			},
			onIngress(event) {
				if (current === generation) pi.appendEntry("exec-ingress", event);
			},
			onLate(event) {
				if (current !== generation) return;
				queue.push(event);
				scheduleFlush();
			},
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		pi.setActiveTools([...new Set([...pi.getActiveTools().filter((name) => !REPLACED.has(name)), "exec"])]);
		await reset(ctx, true);
	});
	pi.on("agent_start", async () => { busy = true; });
	pi.on("agent_settled", async () => { busy = false; flush(); });
	pi.on("session_tree", async (_event, ctx) => { await reset(ctx, true); });
	pi.on("session_shutdown", async () => { await reset(undefined, true); });

	pi.registerCommand("exec-reset", {
		description: "Stop exec subprocesses and clear retained state (keep file anchors)",
		handler: async (_args, ctx) => {
			await reset(ctx);
			ctx.ui.notify("Exec kernel reset; state cleared, file anchors retained.", "info");
		},
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName === "exec" && (event.details as { error?: string } | undefined)?.error) return { isError: true };
	});

	function registerExec() {
		pi.registerTool({
			name: "exec",
			label: "exec",
			renderCall,
			renderResult,
			description: describeModules(modules, profile) + (configurationError ? "\nConfiguration error: " + configurationError : ""),
			parameters: Type.Object({
				code: Type.String({ description: "TypeScript to evaluate in the persistent kernel. Use show(...) to emit results." }),
			}),
			async execute(_id, { code }, signal, onUpdate, ctx) {
				if (configurationError) throw new Error(configurationError);
				if (!kernel) await reset(ctx);
				const cell = nextCell++;
				running++;
				let result;
				try {
					result = await kernel!.execute(code, {
						id: cell, signal, query: ingressContext(ctx, code),
						yieldMs: Number(process.env.PI_EXEC_YIELD_MS) || undefined,
						onUpdate: trace => onUpdate?.({ content: [], details: { trace } }),
						detach: () => ctx.hasPendingMessages(),
					});
				} finally { running--; }
				const content = mergeText([...drain(), ...result.content]);
				if (result.error) content.push({ type: "text", text: result.error });
				if (!content.length) content.push({ type: "text", text: "(no output)" });
				return {
					content,
					details: { piBetterSkills: { version: 1, handling: "explicit" }, cell, trace: result.trace, ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}), ...(result.error ? { error: result.error } : {}) },
				};
			},
		});
		}
	registerExec();
}
