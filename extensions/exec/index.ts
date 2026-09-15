import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { LedgerEntry } from "../outline-read/ledger";
import { Kernel } from "./kernel";

const ENTRY_TYPE = "outline-read";
const REPLACED = new Set(["bash", "sh", "read", "edit", "grep", "find"]);

const API = `Persistent TypeScript REPL. Top-level await and bindings survive calls; only show(...) or console.log(...) emits output. Operations are not transactional: earlier side effects survive a later error. Interrupting resets the kernel and stops its subprocesses.

API:
  await sh\`command\` or sh(command) -> {stdout, stderr, exitCode}; shell output has no editable anchors.
  await find(glob?, {paths?, hidden?}?) -> string[] (ignore-aware).
  await read(path) -> source {path, text, rows, lines(start?,end?), outline()}.
  await grep(pattern: string|RegExp, paths?: string|string[], {glob?,ignoreCase?,literal?,limit?}?) -> selection.
  selection.rows / [...selection] -> {anchor,text,path,line}[]; selection.filter(fn), selection.slice(start?,end?), selection.context(n), await selection.enclosing(), selection.complete.
  await edit\`=abcd\nreplacement\` replaces a line; =abcd wxyz replaces an inclusive range; -abcd deletes; >abcd / <abcd insert after/before. Separate hunks with a blank line. Anchors are unique across files and reject stale targets.
  await replace(selection, (text,row) => newText) uses the same checked edit engine.
  await show(value, ...) renders bounded output; await show(source.outline()) for large files, source.lines(40,80) for a range. Read/search values are not display-truncated.
  notify(promise, label?) requests a one-shot completion/error alert and returns the original promise. Keep a binding to await its result later.

Example: const hits = await grep("TODO", await find("src/**/*.ts")); await show(hits.context(2));
SKILL.md reads are RAW source here: dynamic shell placeholders are NOT executed and skill-relative paths are NOT rewritten. Use explicit paths; execute needed placeholders explicitly with PI_SKILL_DIR and PI_WORKSPACE set. Do not assume the external read-tool skill hooks have run.
Bindings are lost on reload, session switch/fork/tree navigation, interruption, or /exec-reset. File anchors persist with the session; code is never replayed.`;

export default function (pi: ExtensionAPI) {
	let kernel: Kernel | undefined;
	let generation = 0;

	async function reset(ctx?: ExtensionContext) {
		generation++;
		const old = kernel;
		kernel = undefined;
		await old?.dispose();
		if (!ctx) return;
		const current = generation;
		const ledger: LedgerEntry[] = [];
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) ledger.push(entry.data as LedgerEntry);
		}
		kernel = new Kernel({
			cwd: ctx.cwd,
			ledger,
			persist(entry) {
				if (current === generation) pi.appendEntry(ENTRY_TYPE, entry);
			},
			onNotification(event) {
				if (current !== generation) return;
				pi.sendMessage({
					customType: "exec-notification",
					content: [`exec${event.label ? ` (${event.label})` : ""}: ${event.error ? "failed" : "completed"}`, event.output, event.error].filter(Boolean).join("\n"),
					display: true,
				}, { triggerTurn: true, deliverAs: "followUp" });
			},
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		await reset(ctx);
		pi.setActiveTools([...new Set([...pi.getActiveTools().filter((name) => !REPLACED.has(name)), "exec"])]);
	});
	pi.on("session_tree", async (_event, ctx) => { await reset(ctx); });
	pi.on("session_shutdown", async () => { await reset(); });

	pi.registerCommand("exec-reset", {
		description: "Stop exec subprocesses and clear REPL bindings (keep file anchors)",
		handler: async (_args, ctx) => {
			await reset(ctx);
			ctx.ui.notify("Exec kernel reset; bindings cleared, file anchors retained.", "info");
		},
	});

	pi.registerTool({
		name: "exec",
		label: "exec",
		description: API,
		parameters: Type.Object({ code: Type.String({ description: "TypeScript to evaluate in the persistent kernel. Use show(...) to emit results." }) }),
		async execute(_id, { code }, signal, _onUpdate, ctx) {
			if (!kernel) await reset(ctx);
			const result = await kernel!.execute(code, signal);
			return {
				content: [{ type: "text", text: [result.output, result.error].filter(Boolean).join("\n") || "(no output)" }],
				details: { error: result.error },
				...(result.error ? { isError: true } : {}),
			};
		},
	});
}
