import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { LedgerEntry } from "../outline-read/ledger";
import { Kernel } from "./kernel";
import { createExecServices, type ExecServices } from "./services";
import { createComputerUseBridge } from "./computer-use";
import { MODULES, resolveModules, describeModules, type ExecModule } from "./modules";
import { renderCall, renderResult } from "./render";

const ENTRY_TYPE = "outline-read";
const REPLACED = new Set(["write", "session_spawn", "session_wait", "session", "find_roots", "observe_ui", "search_ui", "expand_ui", "inspect_ui", "act_ui", "read_text", "wait_for", "launch_browser", "navigate_browser", "evaluate_browser", "bash", "sh", "read", "edit", "grep", "find", "exa_search", "exa_contents", "wm_spawn", "wm_wait", "wm", "board_send", "board_read", "board_list", "board_subscribe"]);

export default async function (pi: ExtensionAPI) {
	pi.registerFlag("exec-modules", { type: "string", description: "Exec module allowlist: " + MODULES.join(",") + " (* = all, none = core only)" });
	pi.registerFlag("exec-deny-modules", { type: "string", description: "Exec module denylist; overrides --exec-modules" });
	let modules: ExecModule[] = [...MODULES];
	let configurationError: string | undefined;
	const ui = await createComputerUseBridge(pi);
	let kernel: Kernel | undefined;
	let services: ExecServices | undefined;
	let generation = 0;

	async function reset(ctx?: ExtensionContext, session = false) {
		generation++;
		const old = kernel;
		kernel = undefined;
		await old?.dispose();
		if (session) services = undefined;
		if (!ctx) return;
		try {
			modules = resolveModules(pi.getFlag("exec-modules"), pi.getFlag("exec-deny-modules"));
			configurationError = undefined;
		} catch (error) {
			modules = [];
			configurationError = String(error);
		}
		registerExec();
		if (configurationError) throw new Error(configurationError);
		services ??= createExecServices(pi, ctx, { ui });
		const current = generation;
		const ledger: LedgerEntry[] = [];
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) ledger.push(entry.data as LedgerEntry);
		}
		kernel = new Kernel({
			cwd: ctx.cwd,
			sessionFile: ctx.sessionManager.getSessionFile(),
			modules,
			call: services.call,
			ledger,
			persist(entry) {
				if (current === generation) pi.appendEntry(ENTRY_TYPE, entry);
			},
			onNotification(event) {
				if (current !== generation) return;
				pi.sendMessage({
					customType: "exec-notification",
					content: [{ type: "text", text: `exec${event.label ? ` (${event.label})` : ""}: ${event.error ? "failed" : "completed"}` }, ...event.content, ...(event.error ? [{ type: "text" as const, text: event.error }] : [])],
					display: true,
				}, { triggerTurn: true, deliverAs: "followUp" });
			},
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		pi.setActiveTools([...new Set([...pi.getActiveTools().filter((name) => !REPLACED.has(name)), "exec"])]);
		await reset(ctx, true);
	});
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
			description: describeModules(modules) + (configurationError ? "\nConfiguration error: " + configurationError : ""),
			parameters: Type.Object({
				code: Type.String({ description: "TypeScript to evaluate in the persistent kernel. Use show(...) to emit results." }),
				timeoutMs: Type.Optional(Type.Integer({ minimum: 1, maximum: 2_147_483_647, description: "Host-enforced deadline for this call only, in milliseconds (default 30000). Timeout clears kernel state and stops shell subprocesses; bounded partial output survives. Use term for long work; side effects may remain." })),
			}),
			async execute(_id, { code, timeoutMs }, signal, onUpdate, ctx) {
				if (configurationError) throw new Error(configurationError);
				if (!kernel) await reset(ctx);
				const result = await kernel!.execute(code, signal, trace => onUpdate?.({ content: [], details: { trace } }), timeoutMs);
				const content = [...result.content];
				if (result.error) content.push({ type: "text", text: result.error });
				if (!content.length) content.push({ type: "text", text: "(no output)" });
				return {
					content,
					details: { piBetterSkills: { version: 1, handling: "explicit" }, trace: result.trace, ...(result.error ? { error: result.error } : {}) },
				};
			},
		});
		}
	registerExec();
}
