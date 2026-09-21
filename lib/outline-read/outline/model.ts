/**
 * Fallback outline from a small model via `pi -p` with no extensions, for
 * file types no structural source supports. Results are cached by content.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { OutlineReadConfig } from "../config";
import type { OutlineNode } from "./types";

const SYSTEM_PROMPT = "You produce structural outlines of files for a code-reading tool. Output only JSON.";

const TIMEOUT_MS = 90_000;

function prompt(name: string): string {
	return [
		`The input is the file \`${name}\` with line numbers as \`N│text\`.`,
		"List its sections and nested subsections: the units a reader would jump to (top-level keys or tables, functions, rules, chapters, record groups).",
		"A section starts at the line that names or opens it (a comment banner counts when it introduces the block below). Prefer fewer, larger sections: usually 5-30 total, each at least ~8 lines unless the file is a flat list of short entries. Nest only where the file has real hierarchy.",
		'Output only a JSON array, in file order, nested by containment: [{"name":"short label","kind":"section|function|key|rule|entry","startLine":N,"children":[...]}]',
	].join(" ");
}

interface RawNode {
	name?: unknown;
	kind?: unknown;
	startLine?: unknown;
	children?: unknown;
}

/** Turn the model's start-line tree into nodes with end lines and bodies. */
export function parseOutlineJson(output: string, totalLines: number): OutlineNode[] | null {
	const start = output.indexOf("[");
	const end = output.lastIndexOf("]");
	if (start < 0 || end <= start) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(output.slice(start, end + 1));
	} catch {
		return null;
	}
	if (!Array.isArray(raw)) return null;

	const convert = (items: unknown[], parentStart: number, parentEnd: number): OutlineNode[] => {
		const valid = items
			.filter((item): item is RawNode => typeof item === "object" && item !== null)
			.map((item) => ({
				name: typeof item.name === "string" ? item.name : "",
				kind: typeof item.kind === "string" ? item.kind : "section",
				startLine: typeof item.startLine === "number" ? Math.floor(item.startLine) : Number.NaN,
				children: Array.isArray(item.children) ? item.children : [],
			}))
			.filter((item) => item.name && item.startLine > parentStart && item.startLine <= parentEnd)
			.sort((a, b) => a.startLine - b.startLine)
			.filter((item, i, all) => i === 0 || item.startLine !== all[i - 1].startLine);
		return valid.map((item, i) => {
			const endLine = i + 1 < valid.length ? valid[i + 1].startLine - 1 : parentEnd;
			return {
				name: item.name,
				kind: item.kind,
				startLine: item.startLine,
				endLine,
				body: item.startLine < endLine ? { startLine: item.startLine + 1, endLine } : undefined,
				children: convert(item.children, item.startLine, endLine),
			};
		});
	};
	return convert(raw, 0, totalLines);
}

function cachePath(model: string, thinking: string, text: string): string {
	const dir = join(getAgentDir(), "outline-read-cache");
	mkdirSync(dir, { recursive: true });
	const key = createHash("sha256").update(`${model}:${thinking}`).update("\0").update(text).digest("hex");
	return join(dir, `${key}.json`);
}

function runPi(args: string[], stdin: string, signal?: AbortSignal): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("pi", args, { stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
		const onAbort = () => child.kill();
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("error", reject);
		child.on("close", (code) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			if (code === 0) resolve(stdout);
			else reject(new Error(`pi exited with ${code}: ${stderr.trim().split("\n").pop() ?? ""}`));
		});
		child.stdin.end(stdin);
	});
}

export async function outlineWithModel(
	path: string,
	text: string,
	{ model, thinking }: OutlineReadConfig["fallback"],
	signal?: AbortSignal,
): Promise<OutlineNode[] | null> {
	const lines = text.split("\n");
	const cache = cachePath(model, thinking, text);
	try {
		return JSON.parse(readFileSync(cache, "utf8"));
	} catch {}

	const width = String(lines.length).length;
	const numbered = lines.map((line, i) => `${String(i + 1).padStart(width)}│${line}`).join("\n");
	const args = [
		"-p",
		"--no-extensions",
		"--no-skills",
		"--no-prompt-templates",
		"--no-context-files",
		"--no-session",
		"--no-tools",
		"--model",
		model,
		"--thinking",
		thinking,
		"--system-prompt",
		SYSTEM_PROMPT,
		prompt(basename(path)),
	];
	const output = await runPi(args, numbered, signal);
	const nodes = parseOutlineJson(output, lines.length);
	if (nodes) writeFileSync(cache, JSON.stringify(nodes));
	return nodes;
}
