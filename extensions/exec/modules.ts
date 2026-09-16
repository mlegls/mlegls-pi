import { fileURLToPath } from "node:url";

export const MODULES = ["fs", "sh", "exa", "board", "wm", "term", "ui"] as const;
export type ExecModule = typeof MODULES[number];

function parse(value: unknown, flag: string, fallback: readonly ExecModule[]): readonly ExecModule[] {
	if (value === undefined) return fallback;
	if (typeof value !== "string") throw new Error(flag + " expects comma-separated module names");
	if (value.trim() === "none") return [];
	const names = value.split(",").map(name => name.trim()).filter(Boolean);
	for (const name of names) {
		if (name !== "*" && !MODULES.includes(name as ExecModule)) {
			throw new Error(flag + ": unknown module " + JSON.stringify(name) + "; choose " + MODULES.join(", ") + ", * or none");
		}
	}
	return names.includes("*") ? MODULES : names as ExecModule[];
}

/** Select the advertised/callable surface, not a security sandbox. Deny wins. */
export function resolveModules(allow?: unknown, deny?: unknown): ExecModule[] {
	const allowed = new Set(parse(allow, "--exec-modules", MODULES));
	const denied = new Set(parse(deny, "--exec-deny-modules", []));
	return MODULES.filter(name => allowed.has(name) && !denied.has(name));
}

const API: Record<ExecModule, string[]> = {
	"fs": [
		"await find(glob?, {paths?, hidden?}?) -> string[] (ignore-aware).",
		"await read(path) -> source {path, text, rows, lines(start?,end?), outline()}.",
		"await loadSkill(path) -> retained {path,text,commands,content()}; explicit non-anchored skill loading, expands original dynamic shell placeholders once per call with PI_SKILL_DIR/PI_WORKSPACE. show() never reruns them.",
		"await write(path, content) -> {path,bytes}; creates parents and overwrites UTF-8 text.",
		"read(imagePath) -> retained ImageFile; show(image) emits actual image content.",
		"await grep(pattern: string|RegExp, paths?: string|string[]|source|selection, {glob?,ignoreCase?,literal?,limit?}?) -> selection; options may be second argument when paths are omitted. Sources/selections select files, not row ranges.",
		"selection.rows / [...selection] -> {anchor,text,path,line}[]; selection.filter(fn), selection.slice(start?,end?), selection.map(rowFn) -> array, selection.join(separator=\"\\n\") -> row text, selection.context(n), await selection.enclosing(), selection.complete.",
		"await edit`=abcd\nreplacement` replaces a line; =abcd wxyz replaces an inclusive range; -abcd deletes; >abcd / <abcd insert after/before (empty body inserts a blank line). Separate hunks with a blank line. edit.raw`...` preserves raw template segments; default edit tags remain cooked. Anchors are unique across files and reject stale targets.",
		"await replace(selection, (text,row) => newText) uses the same checked edit engine."
	],
	"sh": [
		"await sh.raw`command` (preferred for shell backslashes/regex/heredocs), sh`command`, or sh(command) -> {stdout, stderr, exitCode, stdoutTruncated, stderrTruncated}; nonzero exits resolve. Captures 1 MiB/stream; redirect larger logs to files. sh.raw`...` preserves backslashes in template segments; sh`...` cooks JS escapes (e.g. \\n becomes a newline). Template interpolation is literal shell text, not argument quoting. Shell output has no editable anchors."
	],
	"exa": [
		"exa.search(query, options?), exa.contents(urls, options?) -> structured responses."
	],
	"board": [
		"board.send({topic,body,tags?,data?}), board.read({topic?,tags?,limit?,fields?:\"full\"|\"meta\",bodyChars?}?) -> {messages,omitted,total}, board.list({topic?}?), board.subscribe({topic,tags?,wake?,remove?}), board.ack(ids), board.help(method?). Filter tags accept an expression string or an array requiring all listed tags (empty = unrestricted). Use fields:\"meta\" for compact previews (bodyChars defaults 120, 0 omits body); bodyTruncated marks snippets. Pass limit:total to include omitted older matches. Reads do not acknowledge; ack only handled message IDs."
	],
	"wm": [
		"wm.spawn({run?,workers:[{handle,prompt,agent?,base?}],wake?,wait?}), wm.wait({handles?,run?,mode?:\"any\"|\"all\",timeoutMs?}?), wm.send(handle,text,{run?}?), wm.capture(handle,{run?,lines?}?), wm.merge(handles,{run?,into?,mode?}?), wm.close(handles,{run?,keepBranch?}?), wm.status() (handle/paneId records), wm.agents(), wm.help(method?). Waits do not acknowledge reports."
	],
	"term": [
		"term.spawn({terminals:[{command,cwd?,name?,notifyOnExit?,notifyOnOutput?}]}), term.view(id,{lines?,cursor?,waitMs?}?), term.send(id,text,{submit?}?), term.sendRaw(id,keys), term.end(id), term.list().",
		"term.wait({ids,mode?:\"any\"|\"all\",cursors?,waitMs?,lines?}); snapshots and waits stay structured, show renders readable terminal output. Terminals survive kernel reset."
	],
	"ui": [
		"ui.findRoots/observe/search/expand/inspect/act/readText/waitFor(args); await show(await ui.observe()) emits text/images; .capture is concise metadata; .details retains full state/ref data. ui.search({stateId,subrole?,unlabeled?,limit?,...}) searches the cached outline with explicit completeness; native search otherwise stays unchanged. ui.help(method?) returns upstream schemas and guidelines."
	]
};

export function describeModules(modules: readonly ExecModule[]): string {
	return [
		"TypeScript execution with fresh scope per call and a persistent kernel. const/let/var and function declarations are cell-local and reusable next call. Retain values/promises explicitly with state.name = value; inspect Object.keys(state), delete state.name to release. Only show(...) or console.log(...) emits output. Operations are not transactional: earlier side effects and state writes survive a later error. Never blindly retry a failed cell. Interrupting resets the kernel and stops its shell subprocesses, not host-owned terminals.",
		"Cells have a 30s host-enforced deadline. Pass timeoutMs on the exec call to override for that call only (positive integer milliseconds). Timeout clears kernel state, kills shell subprocesses, and aborts host calls; captured output is preserved, side effects may remain. Use term or retained promises for long-running work.",
		"Enabled modules: " + (modules.join(", ") || "none") + ". Module selection limits the provided API, not imports or OS access.",
		"Enabled API names, state, and __exec are reserved at cell top level: redeclarations fail before execution. Nested scopes may shadow them. __exec holds the enabled capabilities; registry and API namespaces are frozen. state is a mutable null-prototype object; its binding cannot be reassigned. Module selection is not a security sandbox.",
		"",
		"API:",
		...modules.flatMap(name => API[name]),
		"await show(value, ...) renders bounded output; values/promises and content() blocks preserve order. Text is capped at 16 KiB per cell; show.large(value, ...) raises that cell to a 50 KiB ceiling. Omission notices count rendered UTF-8 bytes and suggest slicing/retrying; images bypass that cap, max 8 images / 20 MiB base64 per cell (visible warning; retained values stay intact).",
		"notify(promise, label?) requests a one-shot completion/error alert with actual content (same text/image bounds) and returns the original promise. Save it in state to await its result in a later call.",
		...(modules.some(name => name !== "fs" && name !== "sh") ? ["host.call(namespace, method, args) calls enabled host services only (term args are positional arrays; other namespaces use objects)."] : []),
		...(modules.includes("fs") ? ["Read/search values are not display-truncated. Example: const hits = await grep(\"TODO\", await find(\"src/**/*.ts\")); await show(hits.context(2));", "read/grep SKILL.md snapshots are RAW editable source; use loadSkill(path) to activate dynamic shell blocks explicitly. Exec-owned results opt out of compatible pi-better-skills middleware; inner calls do not fire read/bash hooks."] : []),
		"Full API reference: " + fileURLToPath(new URL("./README.md", import.meta.url)),
		"state is cleared on reload, session switch/fork/tree navigation, interruption, or /exec-reset. File anchors persist with the session; code is never replayed.",
	].join("\n");
}
