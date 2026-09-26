import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { create as createIngress } from "../../lib/ingress.ts";
import { segments } from "../../lib/raw.ts";
import { createImageFile, detectImageMimeType, type ContentBlock } from "../exec/image";
import { ingressContext } from "../exec/ingress-context";
import { filterReads } from "../ingress-policy";

// One asynchronous bash tool, after Unreal Agent: a call returns when its command
// finishes or after a yield window with a handle; a detached command's result is
// delivered by itself later, so the model never polls. Enabled by PI_TOOL_MODE=bash,
// which also keeps exec from taking over the tool set.

const BIN = resolve(dirname(new URL(import.meta.url).pathname), "../../bin");
const REPLACED = ["read", "edit", "write", "grep", "find", "ls", "exec"];
const HEAD = 8 * 1024, TAIL = 32 * 1024, BUDGET = 16 * 1024;
// An unhandled failure anywhere in a composed command reports itself and the script goes on
// (unlike set -e). ERR skips if/while conditions and the left of && and ||, so expected
// failures stay quiet; set -E carries the trap into functions and substitutions (a failing
// function reports inside and again at its call). Line numbers are the command's own:
// bash -c counts from 0 in 3.2 and from 1 in 5, so they are relative to the prelude's line.
// stderr joins stdout so the merged output keeps its order; reports go to a saved copy of
// that stream, so a failure inside $(...) is reported rather than captured into the value.
// A fixed fd, since macOS's bash 3.2 has no {var} allocation.
export const PRELUDE = "exec 2>&1 19>&1; set -E; __ab_line=$LINENO; trap 'echo \"[exit $? at line $((LINENO - __ab_line)): $BASH_COMMAND]\" >&19' ERR\n";
const REPORT = /^\[exit \d+ at line \d+: .*\]$/;
/** Identical reports (a failing command in a loop) collapse into their first, suffixed ×N; the log keeps every one. */
export function collapseReports(text: string): string {
	const lines = text.split("\n");
	const counts = new Map<string, number>();
	for (const line of lines) if (REPORT.test(line)) counts.set(line, (counts.get(line) ?? 0) + 1);
	if (![...counts.values()].some(n => n > 1)) return text;
	const seen = new Set<string>();
	return lines.flatMap(line => {
		const n = counts.get(line);
		if (n === undefined) return [line];
		if (seen.has(line)) return [];
		seen.add(line);
		return [n > 1 ? line + " ×" + n : line];
	}).join("\n");
}
// Seconds a call waits before returning a handle; PI_BASH_YIELD_S=0 makes every call return at once.
const YIELD_S = process.env.PI_BASH_YIELD_S !== undefined && Number.isFinite(Number(process.env.PI_BASH_YIELD_S)) ? Number(process.env.PI_BASH_YIELD_S) : 10;

interface Job {
	handle: string; command: string; pid: number; started: number; log: string;
	chunks: Buffer[]; size: number; attach: string;
	done: Promise<number | string>; detached: boolean; child: ChildProcess;
}

export default function (pi: ExtensionAPI) {
	if (process.env.PI_TOOL_MODE !== "bash") return;
	let state = join(tmpdir(), "ab-" + process.pid);
	let sessionId: string | undefined;
	let next = 1;
	let late: { job: Job; code: number | string }[] = [];
	let busy = false;
	// Every wake-up re-reads the whole context, so completions close together share one:
	// a flush waits SETTLE_MS after the latest completion, and at most MAX_SETTLE_MS after the first.
	const SETTLE_MS = 500, MAX_SETTLE_MS = 2000;
	let settle: ReturnType<typeof setTimeout> | undefined, firstLate = 0;
	let lastCtx: ExtensionContext | undefined;
	let generation = 0;
	const jobs = new Map<string, Job>();
	const ingress = createIngress({
		record: event => pi.appendEntry("exec-ingress", event),
		retain: (id, text) => { mkdirSync(join(state, "ingress"), { recursive: true }); writeFileSync(join(state, "ingress", id), text); },
	});

	pi.on("session_start", async (_event, ctx) => {
		lastCtx = ctx;
		busy = false;
		const file = ctx.sessionManager.getSessionFile();
		state = file ? file.replace(/\.jsonl$/, "") + ".ab" : state;
		sessionId = ctx.sessionManager.getSessionId();
		mkdirSync(state, { recursive: true });
		pi.setActiveTools([...new Set([...pi.getActiveTools().filter(name => !REPLACED.includes(name)), "bash"])]);
	});
	pi.on("agent_start", async () => { busy = true; });
	pi.on("agent_settled", async (_event, ctx) => { busy = false; lastCtx = ctx; await flush(); });
	pi.on("model_select", async (_event, ctx) => { lastCtx = ctx; });
	pi.on("session_shutdown", async () => {
		generation++;
		clearTimeout(settle); settle = undefined;
		late = [];
		lastCtx = undefined;
		for (const job of jobs.values()) kill(job);
	});

	function start(command: string, cwd: string): Job {
		const handle = "h" + next++;
		mkdirSync(join(state, "out"), { recursive: true });
		const log = join(state, "out", handle + ".log");
		const attach = join(state, "out", handle + ".attach");
		const abStateRoot = process.env.AB_STATE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab");
		// PI_BASH_PATH puts directories ahead of the user's PATH for agent commands only,
		// e.g. GNU userland on macOS, where models expect GNU sed/grep/date.
		const path = [BIN, process.env.PI_BASH_PATH, process.env.PATH].filter(Boolean).join(":");
		// PI_SESSION_ID lets commands record provenance (e.g. tracker `author: session:<id>`).
		const env = { ...process.env, PATH: path, AB_STATE: abStateRoot, AB_SESSION_STATE: state, AB_OUT: attach, ...(sessionId && { PI_SESSION_ID: sessionId }) };
		// Own process group, so interrupting kills the command's children too.
		const child = spawn("bash", ["-c", PRELUDE + command], { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
		const file = createWriteStream(log);
		const job: Job = { handle, command, pid: child.pid ?? 0, started: Date.now(), log, attach, chunks: [], size: 0, detached: false, child, done: undefined as any };
		const take = (chunk: Buffer) => {
			file.write(chunk);
			// Keep the head and a rolling tail in memory; the log file has everything.
			job.size += chunk.length;
			job.chunks.push(chunk);
			let kept = job.chunks.reduce((n, c) => n + c.length, 0);
			while (job.chunks.length > 2 && kept - job.chunks[1].length > HEAD + TAIL) { kept -= job.chunks[1].length; job.chunks.splice(1, 1); }
		};
		child.stdout!.on("data", take);
		child.stderr!.on("data", take);
		job.done = new Promise(resolve => {
			child.once("error", error => resolve(String(error)));
			child.once("close", (code, signal) => { file.end(); jobs.delete(handle); resolve(code ?? signal ?? "?"); });
		});
		jobs.set(handle, job);
		return job;
	}

	function kill(job: Job) { try { process.kill(-job.pid, "SIGTERM"); } catch {} }

	async function output(job: Job, code: number | string | undefined, ctx: ExtensionContext | undefined, options: { raw?: boolean; focus?: string } = {}): Promise<ContentBlock[]> {
		let text = collapseReports(readFileSync(job.log, "utf8"));
		if (Buffer.byteLength(text) > HEAD + TAIL) {
			const buffer = Buffer.from(text);
			text = buffer.subarray(0, HEAD).toString() + "\n…[" + (buffer.length - HEAD - TAIL) + " bytes omitted; full output: " + job.log + "]…\n" + buffer.subarray(buffer.length - TAIL).toString();
		}
		const parts = segments(text);
		const rawBytes = parts.reduce((n, p) => n + (p.raw ? Buffer.byteLength(p.text) : 0), 0);
		const loose = parts.filter(p => !p.raw), looseBytes = loose.reduce((n, p) => n + Buffer.byteLength(p.text), 0);
		// Exact regions spend the budget first; the rest shares what is left in proportion to size.
		const budget = (p: { text: string }) => Math.max(1024, Math.floor((BUDGET - rawBytes) * Buffer.byteLength(p.text) / Math.max(1, looseBytes)));
		text = (await Promise.all(parts.map(p => p.raw || options.raw || !ctx || !filterReads(ctx.model) ? p.text : ingress.filter(p.text, ingressContext(ctx, job.command), budget(p), options.focus)))).join("");
		const notes: string[] = [];
		if (job.detached) notes.push(job.handle + " finished after " + Math.round((Date.now() - job.started) / 1000) + "s: " + job.command.split("\n")[0].slice(0, 120));
		if (code === undefined) notes.push(job.handle + " still running (pid " + job.pid + ", " + Math.round((Date.now() - job.started) / 1000) + "s); its result arrives when it finishes — don't poll. kill -- -" + job.pid + " stops it; output so far is in " + job.log);
		else if (code !== 0) notes.push("[exit " + code + "]");
		const content: ContentBlock[] = [];
		const body = [job.detached ? "[" + notes.shift() + "]" : "", text.trimEnd(), ...notes.map(n => n.startsWith("[") ? n : "[" + n + "]")].filter(Boolean).join("\n");
		content.push({ type: "text", text: body || "(no output)" });
		if (code !== undefined && existsSync(job.attach)) {
			for (const line of readFileSync(job.attach, "utf8").split("\n")) {
				if (!line) continue;
				const event = JSON.parse(line);
				if (event.type !== "image") continue;
				try {
					const mime = await detectImageMimeType(event.path);
					if (!mime) throw new Error("unsupported image");
					content.push(...(await createImageFile(event.path, await readFile(event.path), mime)).content());
				} catch (error) { content.push({ type: "text", text: "[image " + event.path + ": " + String(error) + "]" }); }
			}
			rmSync(job.attach, { force: true });
		}
		return content;
	}

	async function drain(ctx: ExtensionContext | undefined): Promise<ContentBlock[]> {
		const ready = late; late = [];
		const current = generation;
		const out: ContentBlock[] = [];
		for (const { job, code } of ready) {
			if (current !== generation) break;
			out.push(...await output(job, code, ctx));
		}
		return out;
	}

	function schedule() {
		if (busy) return;
		const now = Date.now();
		if (!settle) firstLate = now;
		clearTimeout(settle);
		settle = setTimeout(() => { settle = undefined; void flush(); }, Math.min(SETTLE_MS, Math.max(0, firstLate + MAX_SETTLE_MS - now)));
	}

	async function flush() {
		clearTimeout(settle); settle = undefined;
		if (busy || !late.length) return;
		const current = generation;
		const content = await drain(lastCtx);
		if (current !== generation) return;
		pi.sendMessage({ customType: "bash-output", content, display: true }, { triggerTurn: true, deliverAs: "followUp" });
	}

	pi.registerTool({
		name: "bash",
		label: "bash",
		description: [
			"Run a bash command in the workspace (GNU userland: coreutils, sed -i, mktemp take GNU flags, not macOS BSD ones). The call returns when the command finishes, or after wait seconds (default " + YIELD_S + ") with a handle while it keeps running; its result then arrives by itself. Don't poll or sleep for it. Independent commands can be parallel calls in one turn.",
			"A failing command inside a script prints [exit N at line L: cmd] and the script continues; conditions and || handle failures silently. Identical reports collapse into the first, suffixed ×N.",
			"Output is read with attention to the conversation: skimmed or omitted parts carry an ing-… id that ab pull recovers. A skim is not evidence for edits or exact claims: ab pull the page you need rather than rerunning the command. To keep one command's output exact, CMD | ab raw, or ab raw CMD ARG… to include its stderr and exit status; raw: true makes the whole call exact. focus names what to look for. Long output keeps head and tail; the full log path is shown.",
			"Read and search files with ab read PATH[:50-80] and ab grep PATTERN rather than cat/sed/head: every row carries an anchor (N abcd│text), and ab edit targets anchors, so a change sends only its new lines, with no old text to quote and no whole-file rewrite. ab edit takes hunks on stdin (ab edit <<'EOF' ... EOF): =abcd or =abcd wxyz replaces, -abcd deletes, >abcd / <abcd insert after/before; hunks are separated by a blank line and a stale anchor is rejected, never misapplied. Create new files with cat > path <<'EOF'.",
			"Edit bodies are literal new text, not unified diffs: omit +/− markers and old/context lines. A single anchor replaces one old line, even with a multiline body; use both endpoints for an old block. Escape header-like content before its sigil (e.g. an indented \\<time).",
			"ab also has images (ab view), skills (ab skill), a TypeScript code graph (ab code) and lib/ adapters; ab CMD --help for each. exa-cli for web search.",
		].join("\n"),
		parameters: Type.Object({
			command: Type.String({ description: "Bash source; runs with bash -c in the workspace." }),
			wait: Type.Optional(Type.Number({ description: "Seconds to wait before returning a handle (default " + YIELD_S + ", 0 returns immediately)." })),
			focus: Type.Optional(Type.String({ description: "What to look for in the output." })),
			raw: Type.Optional(Type.Boolean({ description: "Exact output, no attention filtering." })),
		}),
		async execute(_id, { command, wait, focus, raw }, signal, _onUpdate, ctx) {
			lastCtx = ctx;
			const current = generation;
			const job = start(command, ctx.cwd);
			const window = Math.max(0, wait ?? YIELD_S) * 1000;
			let timer: ReturnType<typeof setTimeout> | undefined, poll: ReturnType<typeof setInterval> | undefined;
			const aborted = new Promise<"abort">(resolve => signal?.addEventListener("abort", () => resolve("abort"), { once: true }));
			// A steering message detaches the command rather than waiting out the window.
			const steered = new Promise<"yield">(resolve => { poll = setInterval(() => { if (ctx.hasPendingMessages()) resolve("yield"); }, 250); });
			const outcome = await Promise.race([job.done, aborted, steered, new Promise<"yield">(resolve => { timer = setTimeout(() => resolve("yield"), window); })]);
			clearTimeout(timer); clearInterval(poll);
			if (outcome === "abort") { kill(job); await job.done; }
			const earlier = await drain(ctx);
			if (outcome === "yield") {
				const running = await output(job, undefined, ctx, { raw: true });
				job.detached = true;
				void job.done.then(code => { if (current !== generation) return; late.push({ job, code }); schedule(); });
				return { content: [...earlier, ...running], details: { handle: job.handle, pid: job.pid, running: true } };
			}
			const code = outcome === "abort" ? "interrupted" : outcome;
			return { content: [...earlier, ...await output(job, code, ctx, { raw, focus })], details: { handle: job.handle, exitCode: code } };
		},
	});
}
