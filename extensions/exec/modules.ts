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
		"await write(path, content) -> {path,bytes}; creates parents and overwrites UTF-8 text.",
		"read(imagePath) -> retained ImageFile; show(image) emits actual image content.",
		"await grep(pattern: string|RegExp, paths?: string|string[], {glob?,ignoreCase?,literal?,limit?}?) -> selection.",
		"selection.rows / [...selection] -> {anchor,text,path,line}[]; selection.filter(fn), selection.slice(start?,end?), selection.context(n), await selection.enclosing(), selection.complete.",
		"await edit`=abcd\nreplacement` replaces a line; =abcd wxyz replaces an inclusive range; -abcd deletes; >abcd / <abcd insert after/before. Separate hunks with a blank line. Anchors are unique across files and reject stale targets.",
		"await replace(selection, (text,row) => newText) uses the same checked edit engine."
	],
	"sh": [
		"await sh`command` or sh(command) -> {stdout, stderr, exitCode, stdoutTruncated, stderrTruncated}; nonzero exits resolve. Captures 1 MiB/stream; redirect larger logs to files. Template interpolation is literal shell text, not argument quoting. Shell output has no editable anchors."
	],
	"exa": [
		"exa.search(query, options?), exa.contents(urls, options?) -> structured responses."
	],
	"board": [
		"board.send({topic,body,tags?,data?}), board.read({topic?,tags?,limit?}?) -> {messages,omitted}, board.list({topic?}?), board.subscribe({topic,tags?,wake?,remove?}), board.ack(ids). Reads and wm.wait do not acknowledge; ack only handled message IDs."
	],
	"wm": [
		"wm.spawn({run?,workers:[{handle,prompt,agent?,base?}],wake?,wait?}), wm.wait({handles?,run?,mode?:\"any\"|\"all\",timeoutMs?}?), wm.send(handle,text,{run?}?), wm.capture(handle,{run?,lines?}?), wm.merge(handles,{run?,into?,mode?}?), wm.close(handles,{run?,keepBranch?}?), wm.status(), wm.agents()."
	],
	"term": [
		"term.spawn({terminals:[{command,cwd?,name?,notifyOnExit?,notifyOnOutput?}]}), term.view(id,{lines?,cursor?,waitMs?}?), term.send(id,text,{submit?}?), term.sendRaw(id,keys), term.end(id), term.list().",
		"term.wait({ids,mode?:\"any\"|\"all\",cursors?,waitMs?,lines?}); snapshots and waits stay structured, show renders readable terminal output. Terminals survive kernel reset."
	],
	"ui": [
		"ui.findRoots/observe/search/expand/inspect/act/readText/waitFor(args); await show(await ui.observe()) emits text/images; .details retains state/ref metadata. ui.help(method?) returns upstream schemas and guidelines."
	]
};

export function describeModules(modules: readonly ExecModule[]): string {
	return [
		"Persistent TypeScript REPL. Top-level await and bindings survive calls; only show(...) or console.log(...) emits output. Operations are not transactional: earlier side effects survive a later error. Interrupting resets the kernel and stops its shell subprocesses, not host-owned terminals.",
		"Enabled modules: " + (modules.join(", ") || "none") + ". Module selection limits the provided API, not imports or OS access.",
		"",
		"API:",
		...modules.flatMap(name => API[name]),
		"await show(value, ...) renders bounded output; values/promises and content() blocks preserve order. Text is capped at 50 KiB; images bypass that cap, max 8 images / 20 MiB base64 per cell (visible warning; retained values stay intact).",
		"notify(promise, label?) requests a one-shot completion/error alert with actual content (same text/image bounds) and returns the original promise. Keep a binding to await its result later.",
		...(modules.some(name => name !== "fs" && name !== "sh") ? ["host.call(namespace, method, args) calls enabled host services only (term args are positional arrays; other namespaces use objects)."] : []),
		...(modules.includes("fs") ? ["Read/search values are not display-truncated. Example: const hits = await grep(\"TODO\", await find(\"src/**/*.ts\")); await show(hits.context(2));", "SKILL.md snapshots are RAW source; inner calls do not fire read/bash hooks. Outer tool-result middleware may still rewrite displayed output. Use explicit paths and deliberately execute required placeholders with PI_SKILL_DIR/PI_WORKSPACE; transformed displays do not prove setup succeeded."] : []),
		"Full API reference: " + fileURLToPath(new URL("./README.md", import.meta.url)),
		"Bindings are lost on reload, session switch/fork/tree navigation, interruption, or /exec-reset. File anchors persist with the session; code is never replayed.",
	].join("\n");
}
