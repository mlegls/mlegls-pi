import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const PRESETS: Record<string, string> = {
	small: "openai-codex/gpt-5.4-mini",
	medium: "openai-codex/gpt-5.6-luna",
	large: "openai-codex/gpt-5.6-sol",
};
const MAX_TASKS = 8;
const MAX_CONCURRENCY = 4;

interface DelegatedTask {
	task: string;
	cwd?: string;
}

interface TaskResult {
	task: string;
	model: string;
	output: string;
	error?: string;
}

function piInvocation(args: string[]): { command: string; args: string[] } {
	const script = process.argv[1];
	if (script && !script.startsWith("/$bunfs/root/") && existsSync(script)) {
		return { command: process.execPath, args: [script, ...args] };
	}
	const runtime = path.basename(process.execPath).toLowerCase();
	return /^(node|bun)(\.exe)?$/.test(runtime)
		? { command: "pi", args }
		: { command: process.execPath, args };
}

function resolveModel(value: string | undefined): string {
	if (!value) return PRESETS.small;
	return PRESETS[value] ?? value;
}

async function runTask(task: string, cwd: string, model: string, signal?: AbortSignal): Promise<TaskResult> {
	const args = [
		"-p",
		"--no-session",
		"--no-extensions",
		"--no-skills",
		"--no-prompt-templates",
		"--model",
		model,
		"--tools",
		"read,grep,find,ls,bash",
		"--append-system-prompt",
		"You are a read-only exploration subagent. Investigate the task and return concise findings with relevant file paths. Do not edit files.",
		`Task: ${task}`,
	];
	const invocation = piInvocation(args);

	return await new Promise((resolve) => {
		const child = spawn(invocation.command, invocation.args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let aborted = false;
		child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
		child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
		child.on("error", (error) => resolve({ task, model, output: "", error: error.message }));
		child.on("close", (code) => resolve({
			task,
			model,
			output: stdout.trim(),
			...(code === 0 && !aborted ? {} : { error: aborted ? "aborted" : stderr.trim() || `exited ${code}` }),
		}));
		const abort = () => {
			aborted = true;
			child.kill("SIGTERM");
		};
		if (signal?.aborted) abort();
		else signal?.addEventListener("abort", abort, { once: true });
	});
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index]);
		}
	});
	await Promise.all(workers);
	return results;
}

const Parameters = Type.Object({
	tasks: Type.Array(Type.Object({
		task: Type.String(),
		cwd: Type.Optional(Type.String()),
	}), { minItems: 1, maxItems: MAX_TASKS }),
	model: Type.Optional(Type.String({
		description: "small, medium, large, or provider/model. Defaults to small.",
	})),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "delegate",
		label: "Delegate",
		description: "Run independent read-only exploration tasks in isolated contexts, in parallel when useful.",
		parameters: Parameters,
		async execute(_id, params, signal, onUpdate, ctx) {
			const model = resolveModel(params.model);
			if (!PRESETS[params.model ?? ""] && params.model && !params.model.includes("/")) {
				throw new Error('model must be "small", "medium", "large", or provider/model');
			}
			let completed = 0;
			const tasks = params.tasks as DelegatedTask[];
			const results = await mapLimit(tasks, MAX_CONCURRENCY, async ({ task, cwd }) => {
				const result = await runTask(task, cwd ?? ctx.cwd, model, signal);
				completed++;
				onUpdate?.({ content: [{ type: "text", text: `${completed}/${tasks.length} tasks complete` }] });
				return result;
			});
			const text = results.map((result, index) => {
				const status = result.error ? `failed: ${result.error}` : "completed";
				return `### Task ${index + 1} (${status}, ${result.model})\n\n${result.output || "(no output)"}`;
			}).join("\n\n---\n\n");
			return { content: [{ type: "text", text }], details: { results } };
		},
	});
}
