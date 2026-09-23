import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { create as createIngress } from "../../lib/ingress.ts";
import { createImageFile, detectImageMimeType, type ContentBlock } from "../exec/image";
import { ingressContext } from "../exec/ingress-context";

// One asynchronous bash tool, after Unreal Agent: a call returns when its command
// finishes or after a yield window with a handle; a detached command's result is
// delivered by itself later, so the model never polls. Enabled by PI_TOOL_MODE=bash,
// which also keeps exec from taking over the tool set.

const BIN = resolve(dirname(new URL(import.meta.url).pathname), "../../bin");
const REPLACED = ["read", "edit", "write", "grep", "find", "ls", "exec"];
const HEAD = 8 * 1024, TAIL = 32 * 1024, BUDGET = 16 * 1024;

interface Job {
	handle: string; command: string; pid: number; started: number; log: string;
	chunks: Buffer[]; size: number; attach: string;
	done: Promise<number | string>; detached: boolean; child: ChildProcess;
}

export default function (pi: ExtensionAPI) {
	if (process.env.PI_TOOL_MODE !== "bash") return;
	let state = join(tmpdir(), "ab-" + process.pid);
	let next = 1;
	let late: { job: Job; code: number | string }[] = [];
	let busy = false;
	let lastCtx: ExtensionContext | undefined;
	const jobs = new Map<string, Job>();
	const ingress = createIngress({
		record: event => pi.appendEntry("exec-ingress", event),
		retain: (id, text) => { mkdirSync(join(state, "ingress"), { recursive: true }); writeFileSync(join(state, "ingress", id), text); },
	});

	pi.on("session_start", async (_event, ctx) => {
		const file = ctx.sessionManager.getSessionFile();
		state = file ? file.replace(/\.jsonl$/, "") + ".ab" : state;
		mkdirSync(state, { recursive: true });
		pi.setActiveTools([...new Set([...pi.getActiveTools().filter(name => !REPLACED.includes(name)), "bash"])]);
	});
	pi.on("agent_start", async () => { busy = true; });
	pi.on("agent_settled", async (_event, ctx) => { busy = false; lastCtx = ctx; await flush(); });
	pi.on("session_shutdown", async () => { for (const job of jobs.values()) kill(job); });

	function start(command: string, cwd: string): Job {
		const handle = "h" + next++;
		mkdirSync(join(state, "out"), { recursive: true });
		const log = join(state, "out", handle + ".log");
		const attach = join(state, "out", handle + ".attach");
		const env = { ...process.env, PATH: BIN + ":" + process.env.PATH, AB_STATE: state, AB_OUT: attach };
		// Own process group, so interrupting kills the command's children too.
		const child = spawn("bash", ["-c", command], { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
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
		let text = readFileSync(job.log, "utf8");
		if (Buffer.byteLength(text) > HEAD + TAIL) {
			const buffer = Buffer.from(text);
			text = buffer.subarray(0, HEAD).toString() + "\n…[" + (buffer.length - HEAD - TAIL) + " bytes omitted; full output: " + job.log + "]…\n" + buffer.subarray(buffer.length - TAIL).toString();
		}
		if (!options.raw && ctx) text = await ingress.filter(text, ingressContext(ctx, job.command), BUDGET, options.focus);
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
		const out: ContentBlock[] = [];
		for (const { job, code } of ready) out.push(...await output(job, code, ctx));
		return out;
	}

	async function flush() {
		if (busy || !late.length) return;
		const content = await drain(lastCtx);
		pi.sendMessage({ customType: "bash-output", content, display: true }, { triggerTurn: true, deliverAs: "followUp" });
	}

	pi.registerTool({
		name: "bash",
		label: "bash",
		description: [
			"Run a bash command in the workspace. The call returns when the command finishes, or after wait seconds (default 10) with a handle while it keeps running; its result then arrives by itself. Don't poll or sleep for it. Independent commands can be parallel calls in one turn.",
			"Output is read with attention to the conversation: skimmed or omitted parts carry an ing-… id that ab pull recovers. raw: true returns exact output; focus names what to look for. Long output keeps head and tail; the full log path is shown.",
			"ab --help: anchored read/grep/edit (ab read prints N abcd│text rows; ab edit takes =abcd hunks on stdin), images (ab view), skills (ab skill), TypeScript code graph (ab code), web search (exa), lib/ adapters. Write files with cat > path <<'EOF'.",
		].join("\n"),
		parameters: Type.Object({
			command: Type.String({ description: "Bash source; runs with bash -c in the workspace." }),
			wait: Type.Optional(Type.Number({ description: "Seconds to wait before returning a handle (default 10, 0 returns immediately)." })),
			focus: Type.Optional(Type.String({ description: "What to look for in the output." })),
			raw: Type.Optional(Type.Boolean({ description: "Exact output, no attention filtering." })),
		}),
		async execute(_id, { command, wait, focus, raw }, signal, _onUpdate, ctx) {
			lastCtx = ctx;
			const job = start(command, ctx.cwd);
			const window = Math.max(0, wait ?? (Number(process.env.PI_BASH_YIELD_S) || 10)) * 1000;
			let timer: ReturnType<typeof setTimeout> | undefined, poll: ReturnType<typeof setInterval> | undefined;
			const aborted = new Promise<"abort">(resolve => signal?.addEventListener("abort", () => resolve("abort"), { once: true }));
			// A steering message detaches the command rather than waiting out the window.
			const steered = new Promise<"yield">(resolve => { poll = setInterval(() => { if (ctx.hasPendingMessages()) resolve("yield"); }, 250); });
			const outcome = await Promise.race([job.done, aborted, steered, new Promise<"yield">(resolve => { timer = setTimeout(() => resolve("yield"), window); })]);
			clearTimeout(timer); clearInterval(poll);
			if (outcome === "abort") { kill(job); await job.done; }
			const earlier = await drain(ctx);
			if (outcome === "yield") {
				job.detached = true;
				void job.done.then(code => { late.push({ job, code }); if (!busy) void flush(); });
				return { content: [...earlier, ...await output(job, undefined, ctx, { raw: true })], details: { handle: job.handle, pid: job.pid, running: true } };
			}
			const code = outcome === "abort" ? "interrupted" : outcome;
			return { content: [...earlier, ...await output(job, code, ctx, { raw, focus })], details: { handle: job.handle, exitCode: code } };
		},
	});
}
