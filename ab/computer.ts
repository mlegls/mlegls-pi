// Intent-driven UI entry: explicit native target, or an isolated/project-owned browser.
// Literal text comes from quoted spans or --input, never from a model.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Event, UI } from "../lib/computer/native.ts";
import { redact as scrub } from "../lib/computer/redact.ts";

type Target = { pid: number; window_id: number };
 type Header = { intent: string; until: string; apps: string[]; windows?: Target[]; quoted: Record<string, string>; hidden: string[] };
const METHODS = ["list_apps", "list_windows", "get_window_state", "verify_state", "click", "set_value", "type_text", "scroll", "press_key", "drag"] as const;

/** Quoted spans become exact inputs, named by their own text. Apostrophes inside words are not quotes. */
export function quoted(intent: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /(?<![\p{L}\p{N}])(?:"([^"]+)"|'([^']+)'|\x60([^\x60]+)\x60|“([^”]+)”|‘([^’]+)’)(?![\p{L}\p{N}])/gu;
	for (const m of intent.matchAll(re)) { const text = m.slice(1).find(s => s !== undefined)!; out[text.length > 60 ? text.slice(0, 57) + "..." : text] = text; }
	return out;
}
export const placeholders = (text: string) => [...new Set([...text.matchAll(/%([\w-]+)%/g)].map(m => m[1]))];

function inputs(pairs: string[] | undefined, fail: (m: string) => never): Record<string, string> {
	const out: Record<string, string> = {};
	for (const pair of pairs ?? []) { const i = pair.indexOf("="); if (i < 1) fail("--input takes NAME=VALUE, got " + pair); out[pair.slice(0, i)] = pair.slice(i + 1); }
	return out;
}
function target(text: string, fail: (m: string) => never): Target {
	const m = /^(\d+):(\d+)$/.exec(text);
	if (!m) fail("--window takes PID:WINDOW_ID, got " + text);
	return { pid: Number(m[1]), window_id: Number(m[2]) };
}


function compact(e: Event) {
    return { index: e.index, at: e.at, status: e.status, reason: e.reason, showing: e.showing, completion: e.completion, fingerprint: e.fingerprint,
        decision: e.decision && { choice: e.decision.choice, p: e.decision.p },
        selected: e.selected && { id: e.selected.id, description: e.selected.description, window: e.selected.window, input: e.selected.input, field: e.selected.field, action: { method: e.selected.action.method, args: {} } },
        outcome: e.outcome && { structuredContent: e.outcome.structuredContent, isError: e.outcome.isError } };
}
export async function computer(args: string[], stateDir: string, fail: (m: string) => never) {
	const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
		app: { type: "string", multiple: true }, window: { type: "string", multiple: true }, until: { type: "string" },
		input: { type: "string", multiple: true }, resume: { type: "string" }, budget: { type: "string" }, timeout: { type: "string" },
        query: { type: "string" }, json: { type: "boolean" },
        browser: { type: "string" }, url: { type: "string" }, headed: { type: "boolean" },
	} });
	const budget = Number(values.budget ?? 20), timeout = Number(values.timeout ?? 300);
	if (!Number.isInteger(budget) || budget < 1 || !Number.isInteger(timeout) || timeout < 1) fail("--budget and --timeout take positive integers");
	const dir = join(stateDir, "computer");
	mkdirSync(dir, { recursive: true });
	const supplied = inputs(values.input, fail);
    if (values.browser || values.url) {
        if (values.resume || values.app || values.window || values.query) fail("Browser drives use a fresh/project-owned page, not --resume/--app/--window/--query");
        if (values.browser && values.url) fail("Choose --url for an isolated page or --browser for project setup, not both");
        const intent = positionals.join(" ").trim();
        if (!intent || !values.until?.trim()) fail("Browser drives require INTENT and --until describing the visible end state");
        const hidden = placeholders(intent + " " + values.until);
        for (const name of hidden) if (supplied[name] === undefined) fail("missing --input " + name + " for %" + name + "%");
        const { driveBrowser } = await import("./computer-browser.ts");
        return driveBrowser({ module: values.browser && resolve(values.browser), url: values.url, headed: values.headed,
            goal: intent, until: values.until, inputs: { ...quoted(intent), ...supplied }, hidden,
            maxSteps: budget, timeoutMs: timeout * 1000, dir, json: values.json });
    }
    if (values.headed) fail("--headed requires --url");

	let header: Header, history: Event[] = [], id: string;
	if (values.resume) {
		const file = existsSync(values.resume) ? values.resume : join(dir, values.resume + ".jsonl");
		if (!existsSync(file)) fail("no drive " + values.resume + " in " + dir);
		const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
		header = lines[0]; history = lines.slice(1).filter(l => l.index !== undefined); id = file;
        if ((header as any).surface === "browser") fail("Browser traces cannot resume a closed context; reattach through --browser project setup");
        if (positionals.length || values.app || values.window || values.until) fail("--resume continues the recorded intent and target; start a new drive to change them");
	} else {
		const intent = positionals.join(" ").trim();
		if (!intent) fail("ab computer needs an intent, e.g. ab computer \"in TextEdit, replace the body with 'Hello'\"");
        if (!values.until?.trim()) fail("Supply --until with the visible end state; naming a destination is not completion");
        if (!values.app?.length && !values.window?.length) fail("Native drives require --app or --window; browser journeys use --url URL or --browser ./setup.ts");
        header = { intent, until: values.until!, apps: values.app ?? [], windows: values.window?.map(w => target(w, fail)), quoted: quoted(intent), hidden: [] };
		id = join(dir, new Date().toISOString().slice(0, 19).replace(/[:T]/g, "") + "-" + randomUUID().slice(0, 6) + ".jsonl");
	}
	// %name% placeholder values are typed but never shown to Jev or written to the trace; other --input values
	// are ordinary inputs like quoted spans, and persist for --resume.
	const hidden = placeholders(header.intent + " " + header.until);
	for (const [name, value] of Object.entries(supplied)) if (!hidden.includes(name)) header.quoted[name] = value;
	const missing = placeholders(header.intent + " " + header.until).filter(n => supplied[n] === undefined);
	if (missing.length) fail("missing --input for " + missing.map(n => "%" + n + "%").join(", ") + (values.resume ? " (hidden values are not stored; resupply them)" : ""));
	header.hidden = hidden;

	const [sdk, { createCuaRuntime }, lib] = await Promise.all([import("@trycua/cua-driver"), import("../extensions/exec/cua-runtime.ts"), import("../lib/computer.ts")]);
	const runtime = createCuaRuntime(sdk);
	const ui = Object.fromEntries(METHODS.map(m => [m, (a: Record<string, unknown>) => runtime.call(m, a)])) as UI;
	const signal = AbortSignal.timeout(timeout * 1000);
	// Hidden values can still come back in UI text (a visible field's value); keep them out of the trace and output.
    const redact = (text: string) => scrub(text, supplied, hidden);
	try {
        // Resolve only within explicit scope, and refuse ambiguous app windows.
        if (!header.apps.length && !header.windows?.length) throw new Error("Recorded drive lacks an explicit target; start a new drive with --app or --window");
        if (!header.apps.length) header.apps = [...new Set(header.windows!.map(w => String(w.pid)))];
        if (!header.windows?.length) {
            const apps = await ui.list_apps({});
            if (apps.isError) throw new Error("Native app discovery failed");
            const found: Target[] = [];
            for (const app of apps.structuredContent?.apps ?? []) {
                if (!app.running || !header.apps.some(name => [app.name, app.bundle_id, String(app.pid)].some(v => v?.toLowerCase() === name.toLowerCase()))) continue;
                const result = await ui.list_windows({ pid: app.pid, on_screen_only: true });
                if (result.isError) throw new Error("Native window discovery failed");
                for (const w of result.structuredContent?.windows ?? []) if (w.pid === app.pid && (w.layer ?? 0) === 0 && w.is_on_screen !== false) found.push({ pid: w.pid, window_id: w.window_id });
            }
            if (found.length !== 1) throw new Error("Expected one window in --app scope, found " + found.length + "; use --window PID:WINDOW_ID. For an isolated browser use --url URL");
            header.windows = found;
        }
        if (!values.resume) writeFileSync(id, JSON.stringify(scrub(header, supplied, hidden)) + "\n");
        else { const [, ...rest] = readFileSync(id, "utf8").split("\n"); writeFileSync(id, [JSON.stringify(scrub(header, supplied, hidden)), ...rest].join("\n")); }
		const nonWait = history.filter(e => !(e.status === "continue" && e.reason === "Reobserve")).length;
		const options = { ui, apps: header.apps, windows: header.windows, goal: header.intent, until: header.until, inputs: { ...header.quoted, ...Object.fromEntries(hidden.map(n => [n, supplied[n]])) }, hidden,
			maxSteps: nonWait + budget, maxWaits: 5, signal, ...(values.query ? { capture: { query: values.query } } : {}),
			// With no text to enter, a text field is still selectable; choosing it stops with needs-input naming the field.
			...(Object.keys(header.quoted).length || hidden.length ? {} : { resolveInput: () => undefined }),
			onEvent: (e: Event) => { process.stderr.write(redact("step " + e.index + ": " + (e.selected?.description ?? e.status + (e.reason ? " (" + e.reason + ")" : "")) + "\n")); } };
		const start = history.length;
		for (;;) {
			const event = await lib.step(options, history);
			history.push(event);
            appendFileSync(id, JSON.stringify(scrub(compact(event), supplied, hidden)) + "\n");
			if (event.status !== "continue") break;
		}
		const last = history.at(-1)!;
		return report({ status: last.status, reason: last.reason, header, history, id, start, json: values.json, redact });
	} finally {
		await runtime.close();
	}
}

function report(r: { status: string; reason?: string; header: Header; history: Event[]; id: string; start?: number; help?: string; json?: boolean; redact?: (s: string) => string }): void {
	const did = r.history.slice(r.start ?? 0).flatMap(e => e.selected ? [(r.redact ?? String)(e.selected.description)] : []);
	const last = r.history.at(-1);
	const resume = "ab computer --resume " + r.id.replace(/^.*\//, "").replace(/\.jsonl$/, "");
	const unconfirmed = r.reason === "Until never verified while waiting";
	const help = r.help ?? (unconfirmed ? "The actions went through but completion was never confirmed; check the window, or rerun with --until '<what should then be visible>'" : undefined) ?? ({
		done: undefined,
		"needs-input": "Run \x60" + resume + " --input text='…'\x60 with the text to enter" + (r.header.hidden.length ? " (and " + r.header.hidden.map(n => n + "=…").join(" ") + " again)" : ""),
		budget: "Run \x60" + resume + "\x60 to continue with a fresh --budget",
		stuck: "Rephrase the intent, narrow it with --app/--window/--query, or drive this window from exec",
		paused: "Run \x60" + resume + "\x60 to continue", denied: undefined,
		error: "Inspect the trace before resuming; do not blindly replay",
	} as Record<string, string | undefined>)[r.status];
    const out: Record<string, unknown> = { status: r.status, ...(r.reason ? { [r.status === "needs-input" ? "needs" : "reason"]: (r.redact ?? String)(r.reason) } : {}), apps: r.header.apps.join(", "), windows: r.header.windows?.map(w => w.pid + ":" + w.window_id),
		steps: did.length, ...(did.length ? { did } : {}), ...(last?.showing !== undefined ? { until_shown: Number(last.showing.toFixed(2)) } : {}),
		trace: r.id, ...(help ? { help } : {}) };
	if (r.json) console.log(JSON.stringify(out, null, 2));
	else for (const [k, v] of Object.entries(out)) console.log(Array.isArray(v) ? k + ":\n" + v.map(x => "  " + x).join("\n") : k + ": " + v);
    process.exitCode = r.status === "done" ? 0 : 1;
}
