import { executionHost } from "../../lib/execution-host.ts";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const MODULES = ["fs", "sh", "exa", "board", "wm", "term", "ui"] as const;
export type ExecProfile = "default" | "reader";
export function resolveProfile(value: unknown): ExecProfile {
	if (value === undefined || value === "default") return "default";
	if (value === "reader") return "reader";
	throw new Error("exec-profile expects default or reader");
}

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
/** Native hosts substitute their own coordination; standalone retains wm/board. */
export const HOST_MODULES: readonly ExecModule[] = ["board", "wm"];

export function resolveModules(allow?: unknown, deny?: unknown, env: NodeJS.ProcessEnv = process.env): ExecModule[] {
	const allowed = new Set(parse(allow, "--exec-modules", MODULES));
	const denied = new Set(parse(deny, "--exec-deny-modules", []));
	if (executionHost(env) !== "wm") for (const m of HOST_MODULES) denied.add(m);
	return MODULES.filter(name => allowed.has(name) && !denied.has(name));
}

export const LIB_DIR = fileURLToPath(new URL("../../lib/", import.meta.url));

const BINDING = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set<string>([
	...MODULES, "show", "wait", "console", "state", "__exec", "host", "project",
	"eval", "arguments", "await", "break", "case", "catch", "class", "const", "continue",
	"debugger", "default", "delete", "do", "else", "enum", "export", "extends", "false",
	"finally", "for", "function", "if", "import", "in", "instanceof", "let", "new", "null",
	"return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "var",
	"void", "while", "with", "yield", "implements", "interface", "package", "private",
	"protected", "public",
]);

export type CellModule = { name: string; path: string; scope: "lib" | "project" };

function stem(file: string): string | undefined {
	if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file.endsWith(".d.ts")) return;
	const name = file.slice(0, -3);
	if (BINDING.test(name) && !RESERVED.has(name)) return name;
}

async function listed(dir: string): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	let entries;
	try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const name = stem(entry.name);
		if (name) out.set(name, join(dir, entry.name));
	}
	return out;
}

/** lib/<name>.ts in cell as <name>; cwd .pi/exec/<name>.ts shadows it, or becomes project.<name>. */
export async function resolveCellModules(cwd: string, libDir = LIB_DIR): Promise<CellModule[]> {
	const lib = await listed(libDir);
	const local = await listed(join(cwd, ".pi", "exec"));
	const modules: CellModule[] = [];
	for (const name of [...lib.keys()].sort()) {
		modules.push({ name, path: local.get(name) ?? lib.get(name)!, scope: "lib" });
		local.delete(name);
	}
	for (const name of [...local.keys()].sort()) {
		modules.push({ name, path: local.get(name)!, scope: "project" });
	}
	return modules;
}

const API: Record<ExecModule, string[]> = {
	"fs": [
		"await find(glob?, {paths?, hidden?}?) -> string[] (ignore-aware).",
		"await read(path) -> source {path, text, rows, lines(start?,end?), outline()}.",
		"await loadSkill(path) -> retained {path,text,commands,content()}; explicit non-anchored skill loading, expands original dynamic shell placeholders once per call with PI_SKILL_DIR/PI_WORKSPACE. show() never reruns them.",
		"await write(path, content) -> {path,bytes}; creates parents and overwrites UTF-8 text. For backticks or ${, pass a double-quoted string or lines.join(\"\\n\").",
		"read(imagePath) -> retained ImageFile; show(image) emits actual image content.",
		"await grep(pattern: string|RegExp, paths?: string|string[]|source|selection, {glob?,ignoreCase?,literal?,limit?}?) -> selection; options may be second argument when paths are omitted. Sources/selections select files, not row ranges.",
		"selection.rows / [...selection] -> {anchor,text,path,line}[]; selection.filter(fn), selection.slice(start?,end?), selection.map(rowFn) -> array, selection.join(separator=\"\\n\") -> row text, selection.context(n), await selection.enclosing(), selection.complete.",
		"await edit`=abcd\nreplacement` replaces a line; =abcd wxyz replaces an inclusive range; -abcd deletes; >abcd / <abcd insert after/before (empty body inserts a blank line). Separate hunks with a blank line; an unescaped header-like body line or lone @path is an error. edit.raw`...` preserves raw template segments; default edit tags remain cooked. Copy anchors from abcd│text, not line numbers. Use a separate @path token: =abcd wxyz @src/file.ts. A backslash-escaped header is the only way to write one as content. Anchors are unique across files and reject stale targets.",
		"await edit([{replace: rowOrAnchorOrPair, text}, {delete: rowOrAnchorOrPair}, {before: rowOrAnchor, text}, {after: rowOrAnchor, text}]) uses the same checked engine with literal text; pairs are [first,last] inclusive. Rejections throw; partial failures name files already changed.",
		"await replace(selection, (text,row) => newText) uses the same checked edit engine."
	],
	"sh": [
		"await sh.raw`command` (preferred for shell backslashes/regex/heredocs), sh`command`, or sh(command) -> {stdout, stderr, exitCode, stdoutTruncated, stderrTruncated}; nonzero exits resolve. Captures 1 MiB/stream; redirect larger logs to files. sh.raw`...` preserves backslashes in template segments; sh`...` cooks JS escapes (e.g. \\n becomes a newline). Template interpolation is literal shell text, not argument quoting. Shell output has no editable anchors. For backticks or ${, pass a double-quoted string or lines.join(\"\\n\") rather than a tagged template."
	],
	"exa": [
		"exa.search(query, options?), exa.contents(urls, options?) -> structured responses."
	],
	"board": [
		"board.send({topic,body,tags?,data?}), board.read({topic?,tags?,limit?,fields?:\"full\"|\"meta\",bodyChars?}?) -> {messages,omitted,total}, board.list({topic?}?), board.subscribe({topic,tags?,wake?,remove?}), board.ack(ids), board.help(method?). Filter tags accept an expression string or an array requiring all listed tags (empty = unrestricted). Use fields:\"meta\" for compact previews (bodyChars defaults 120, 0 omits body); bodyTruncated marks snippets. Pass limit:total to include omitted older matches. Reads do not acknowledge; ack only handled message IDs."
	],
	"wm": [
		"wm.spawn({run?,workers:[{handle,prompt,model?,effort?,command?,agent?,base?}],wake?,wait?}), wm.wait({handles?,run?,mode?:\"any\"|\"all\",timeoutMs?}?), wm.send(handle,text,{run?}?), wm.capture(handle,{run?,lines?}?), wm.merge(handles,{run?,into?,mode?}?), wm.close(handles,{run?,keepBranch?}?), wm.status() (handle/paneId records), wm.agents(), wm.help(method?). Waits do not acknowledge reports."
	],
	"term": [
		"term.spawn({terminals:[{command,cwd?,name?,notifyOnExit?,notifyOnOutput?}]}), term.view(id,{lines?,cursor?,waitMs?}?), term.send(id,text,{submit?}?), term.sendRaw(id,keys), term.end(id), term.list().",
		"term.wait({ids,mode?:\"any\"|\"all\",cursors?,waitMs?,lines?}); snapshots and waits stay structured, show renders readable terminal output. Terminals survive kernel reset."
	],
	"ui": [
		"ui exposes Cua native tools: list_apps/list_windows/get_window_state/verify_state/click/type_text/press_key/set_value/scroll/drag. Snake_case arguments and .structuredContent are native Cua; show(result) emits ordered text/images. ui.help(name?) returns installed native schemas plus exec policy; ui.reset() restarts a wedged driver (idle session_ended recovers by itself). Exact pid/window_id required; no desktop/frontmost fallback. Exec owns session. Observe before each write; use current element_token or snapshot_id. Background by default; delivery_mode:foreground is explicit opt-in, never a retry. Writes and verify_state consume action observations, including errors. Tokens do not survive reload/session changes. No old refs, outline, search or act API."
	]
};

export function describeModules(modules: readonly ExecModule[], profile: ExecProfile = "default", env: NodeJS.ProcessEnv = process.env): string {
	if (profile === "reader") return [
		"Reader API in a persistent TypeScript kernel. Use state to retain values, show(...) to emit output, and ordinary TypeScript to batch/filter reads. A cell yields after 10s with what it has shown; later output arrives by handle. Fresh lexical scope per cell; state persists until reset.",
		"This profile limits the supplied API, not imports or OS access; it is not a security sandbox. No write/edit, shell, skill execution, UI, terminal, coordination, or auto-loaded lib/project helpers are supplied.",
		...(modules.includes("fs") ? API.fs.filter(line => ["await find(", "await read(", "read(imagePath", "await grep(", "selection."].some(prefix => line.startsWith(prefix))) : []),
		...(modules.includes("exa") ? API.exa : []),
		"await show(value, ...) renders output (8 KiB per show call); show.large gives that call 32 KiB. show(value, {focus:\"reading intent\"}) refines implicit context; Jev keeps exact passages, extracts skims, or omits. show.raw bypasses this; show.pull(id) retrieves skimmed/omitted originals. Source text and selections are retained untruncated. console.log also renders output.",
		"Read skill files as reference only: this profile does not execute their shell placeholders.",
	].join("\n");
	return [
		...(executionHost(env) === "orca" ? ["Orca coordination is available as the auto-loaded orca library. wm/board are replaced inside Orca. Use orca.runs.create/use/current, orca.workers.submit/confirmStart/show/read/list/release/retain, orca.check/ack/send/ask/reply; submit creates a Pi child and submits its spec in one call (model and effort required). submit enrolls a bootstrap terminal and starts Pi with a prompt-file argument; it requires turn-start evidence; unconfirmed throws with the retained receipt and stops a dispatch wave. Inspect that attempt before completion waits; never retry on input acceptance alone. Receipts retain native IDs and recovery data. Use show(orca.check({wait:true})) for waits; the result arrives by handle. Never auto-ack displayed mail. See docs/orca.md and orca skills get orchestration for the lifecycle contract."] : executionHost(env) === "paseo" ? ["Inside Paseo (PASEO_AGENT_ID), use the native SDK via paseo.withClient(c => ...): c.agents.ref(ID).waitForFinish(), .timeline.refetch(), .send(message). Use paseo.connect() for streaming and close it in finally; CLI wait/logs/send remain manual recovery tools. dispatch.dispatch launches prepared assignments; retain native receipts, inspect uncertain creation before retrying. Parent owns dependencies and concurrency. A completed turn is not assignment completion: final output begins done/blocked/needs-input; questions go to the parent ID. See docs/paseo.md. wm/board are replaced only inside native hosts."] : ["Standalone coordination uses wm/board; dispatch.dispatch launches prepared assignments with explicit model/effort and parent-scoped capacity. See docs/dispatch.md."]),
		"TypeScript execution with fresh scope per call and a persistent kernel. Local variables and functions do not persist between calls; their names may be redeclared in later calls. Retain values/promises explicitly with state.name = value; inspect Object.keys(state), delete state.name to release. Only show(...) or console.log(...) emits output. Operations are not transactional: earlier side effects and state writes survive a later error. Never blindly retry a failed cell.",
		"Cells never time out; results are asynchronous. Each exec call is cell cN and each show/console.log call in it is handle cN.k. The tool result returns when the cell and its shows finish, or after 10s with whatever has been shown plus the pending handles; later output then arrives by handle at the next exec result, or wakes you if you are idle. Cells run concurrently in one kernel: a later cell may start while an earlier one still writes state. Not calling show means you do not need to see the result; errors are always reported. show.sync(...) holds this result until that value is shown; wait(\"c7\", \"c8.2\") holds it until those handles settle (c7 = the cell body and all its shows). Prefer doing other work, or ending your turn, over waiting. A user message arriving while a result is held yields it at once. Interrupting detaches running cells without waking you later; only a kernel that cannot answer within 1s is reset (state cleared, shells stopped). Host-owned terminals are unaffected.",
		"Enabled modules: " + (modules.join(", ") || "none") + ". Module selection limits the provided API, not imports or OS access.",
		"lib/<name>.ts is in cell scope as <name> except names already in the exec API. Project .pi/exec/<name>.ts shadows that file; a stem that is not in lib is project.<name>. /exec-reset reloads them.",
		"computer (auto-loaded): prefer computer.run(options), computer.step(options, priorEvents), or computer.walk([{label,expect,budget?}], options) for goal-directed browser/desktop interaction; Jev selects actions. run/step options: {ui,apps,goal,until,inputs?,...}; walk supplies goal/until per step. Native: ui; browser: ui: computer.browser(page), apps: [\"page\"] with a caller-owned Playwright page. Example: show(computer.run({ui,apps:[\"TextEdit\"],goal:\"Replace the document body\",until:\"The body is exactly Hello\",inputs:{text:\"Hello\"}})); the result arrives by handle when the drive ends. Use direct tools for inspection, setup, deterministic replay, debugging, or unsupported actions; prefer chrome-devtools-axi when a browser CLI is needed. Read " + fileURLToPath(new URL("../../docs/computer.md", import.meta.url)) + " for setup, verification, and recording.",
		"code (auto-loaded, TypeScript projects): code.index(root?, tsconfig?) -> {defs({name?,file?,kind?,exported?}), def(name, file?), callers(d), callees(d), tests(d), dead(), impact(d), similar(d,{by?,kinds?,n?}), around(d,{hops?}) -> text, children(d), lineage(d), file(path), await rows(d), files, refs}; shortcuts code.defs/def/callers/callees/tests/dead/similar/around/rows use cwd. Definitions are top-level statements and the functions, classes, members, and function-valued variables nested in them, named by dot path (\"Index.similar\"; def(\"similar\") matches the last segment) with {name,kind,parent?,file,path,line,endLine,exported,signature,body}; references are checker-resolved (call|type|member|value), owned by the innermost definition, not name matches. Each call re-indexes incrementally. rows(d) is the definition's anchored rows for edit/replace.",
		"Enabled API names, state, and __exec are reserved at cell top level: redeclarations fail before execution. Nested scopes may shadow them. __exec holds the enabled capabilities; registry and API namespaces are frozen. state is a mutable null-prototype object; its binding cannot be reassigned. Module selection is not a security sandbox.",
		"",
		"API:",
		...modules.flatMap(name => API[name]),
		"await show(value, ...) renders bounded output once its values/promises resolve; values within one call keep their order, separate calls render as each resolves. Text is capped at 8 KiB per show call (handle); show.large(value, ...) gives that call 32 KiB. Omission notices count rendered UTF-8 bytes and suggest slicing; images bypass that cap, max 8 images / 20 MiB base64 per cell (visible warning; retained values stay intact).",
		"show(value, {focus: \"reading intent\"}) reads with explicit attention; without focus, attention comes from the conversation tail and current cell. Jev chooses 100/75/50/25/0% retention; local LLMLingua compresses prose skims. 25% gives keyword cues, not assertions. Code and anchored evidence use exact excerpts. Pull before relying on skimmed details. A trailing object with only a string focus field is reserved as options; other variadic values remain content. await show.raw(value, ...) bypasses semantic filtering; await show.pull(\"ing-…\") displays a skimmed/omitted original without rescoring. Both retain normal byte/image caps. Loaded skills and images bypass filtering; scorer failure keeps original text with a warning.",
		...(modules.some(name => name !== "fs" && name !== "sh") ? ["host.call(namespace, method, args) calls enabled host services only (term args are positional arrays; other namespaces use objects)."] : []),
		...(modules.includes("fs") ? ["Read/search values are not display-truncated. Example: const hits = await grep(\"TODO\", await find(\"src/**/*.ts\")); await show(hits.context(2));", "read/grep SKILL.md snapshots are RAW editable source; use loadSkill(path) to activate dynamic shell blocks explicitly. Exec-owned results opt out of compatible pi-better-skills middleware; inner calls do not fire read/bash hooks."] : []),
		"Full API reference: " + fileURLToPath(new URL("./README.md", import.meta.url)),
		"state is cleared on reload, session switch/fork/tree navigation, a wedged-kernel interrupt, or /exec-reset. File anchors persist with the session; code is never replayed.",
	].join("\n");
}
