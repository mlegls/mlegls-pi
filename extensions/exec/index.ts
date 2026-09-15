import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { LedgerEntry } from "../outline-read/ledger";
import { Kernel } from "./kernel";
import { createExecServices, type ExecServices } from "./services";

const ENTRY_TYPE = "outline-read";
const REPLACED = new Set(["bash", "sh", "read", "edit", "grep", "find", "exa_search", "exa_contents", "wm_spawn", "wm_wait", "wm", "board_send", "board_read", "board_list", "board_subscribe"]);

const API = `Persistent TypeScript REPL. Top-level await and bindings survive calls; only show(...) or console.log(...) emits output. Operations are not transactional: earlier side effects survive a later error. Interrupting resets the kernel and stops its subprocesses.

API:
  await sh\`command\` or sh(command) -> {stdout, stderr, exitCode, stdoutTruncated, stderrTruncated}; nonzero exits resolve. Captures 1 MiB/stream; redirect larger logs to files. Template interpolation is literal shell text, not argument quoting. Shell output has no editable anchors.
  await find(glob?, {paths?, hidden?}?) -> string[] (ignore-aware).
  await read(path) -> source {path, text, rows, lines(start?,end?), outline()}.
  read(imagePath) -> retained ImageFile; show(image) emits actual image content.
  await grep(pattern: string|RegExp, paths?: string|string[], {glob?,ignoreCase?,literal?,limit?}?) -> selection.
  selection.rows / [...selection] -> {anchor,text,path,line}[]; selection.filter(fn), selection.slice(start?,end?), selection.context(n), await selection.enclosing(), selection.complete.
  await edit\`=abcd\nreplacement\` replaces a line; =abcd wxyz replaces an inclusive range; -abcd deletes; >abcd / <abcd insert after/before. Separate hunks with a blank line. Anchors are unique across files and reject stale targets.
  await replace(selection, (text,row) => newText) uses the same checked edit engine.
  await show(value, ...) renders bounded output; await show(source.outline()) for large files, source.lines(40,80) for a range. Read/search values are not display-truncated.
  show accepts values/promises and content() blocks in order. Text is capped at 50 KiB; images bypass that cap, max 8 images / 20 MiB base64 per cell (visible warning; retained values stay intact).
  exa.search(query, options?), exa.contents(urls, options?) -> structured responses.
  board.send({topic,body,tags?,data?}), board.read({topic?,tags?,limit?}?) -> {messages,omitted}, board.list({topic?}?), board.subscribe({topic,tags?,wake?,remove?}), board.ack(ids). Reads and wm.wait do not acknowledge; ack only handled message IDs.
  wm.spawn({run?,workers:[{handle,prompt,agent?,base?}],wake?,wait?}), wm.wait({handles?,run?,mode?:"any"|"all",timeoutMs?}?), wm.send(handle,text,{run?}?), wm.capture(handle,{run?,lines?}?), wm.merge(handles,{run?,into?,mode?}?), wm.close(handles,{run?,keepBranch?}?), wm.status(), wm.agents().
  host.call(namespace, method, args) calls the same exa/board/wm services.
  notify(promise, label?) requests a one-shot completion/error alert with actual content (same text/image bounds) and returns the original promise. Keep a binding to await its result later.

Example: const hits = await grep("TODO", await find("src/**/*.ts")); await show(hits.context(2));
SKILL.md snapshots are RAW source; inner calls do not fire read/bash hooks. Outer middleware may still rewrite displayed output (even mangle anchored shell blocks). Use explicit paths and deliberately execute needed placeholders with PI_SKILL_DIR/PI_WORKSPACE; transformed displays do not prove setup succeeded.
Full API reference: ${fileURLToPath(new URL("./README.md", import.meta.url))}
Bindings are lost on reload, session switch/fork/tree navigation, interruption, or /exec-reset. File anchors persist with the session; code is never replayed.`;

export default function (pi: ExtensionAPI) {
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
		services ??= createExecServices(pi, ctx);
		const current = generation;
		const ledger: LedgerEntry[] = [];
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) ledger.push(entry.data as LedgerEntry);
		}
		kernel = new Kernel({
			cwd: ctx.cwd,
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
		await reset(ctx, true);
		pi.setActiveTools([...new Set([...pi.getActiveTools().filter((name) => !REPLACED.has(name)), "exec"])]);
	});
	pi.on("session_tree", async (_event, ctx) => { await reset(ctx, true); });
	pi.on("session_shutdown", async () => { await reset(undefined, true); });

	pi.registerCommand("exec-reset", {
		description: "Stop exec subprocesses and clear REPL bindings (keep file anchors)",
		handler: async (_args, ctx) => {
			await reset(ctx);
			ctx.ui.notify("Exec kernel reset; bindings cleared, file anchors retained.", "info");
		},
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName === "exec" && (event.details as { error?: string } | undefined)?.error) return { isError: true };
	});

	pi.registerTool({
		name: "exec",
		label: "exec",
		description: API,
		parameters: Type.Object({ code: Type.String({ description: "TypeScript to evaluate in the persistent kernel. Use show(...) to emit results." }) }),
		async execute(_id, { code }, signal, _onUpdate, ctx) {
			if (!kernel) await reset(ctx);
			const result = await kernel!.execute(code, signal);
			const content = [...result.content];
			if (result.error) content.push({ type: "text", text: result.error });
			if (!content.length) content.push({ type: "text", text: "(no output)" });
			return {
				content,
				details: result.error ? { error: result.error } : {},
			};
		},
	});
}
