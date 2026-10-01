/**
 * warpgrep: Morph's WarpGrep subagent (a small RL-trained search model driving ripgrep/read/ls locally,
 * <=6 turns) as one tool call that returns the relevant line ranges, served like read/grep (bare or anchored) so edit can
 * use them directly. Registered only when a Morph key is configured (MORPH_API_KEY or auth.json "morph").
 *
 * The SDK drops the model's token usage, so a fetch wrapper scoped by AsyncLocalStorage sums the usage of
 * each Morph completion; every call is appended to ~/.cache/profile/warpgrep.jsonl for cost accounting.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { truncateHead, truncateLine, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { formatRow } from "./anchors";
import type { GrepDeps } from "./grep";

export interface Usage { calls: number; prompt: number; completion: number; cached: number; }
const LOG = join(homedir(), ".cache", "profile", "warpgrep.jsonl");
const scope = new AsyncLocalStorage<Usage>();

export function morphKey(): string | undefined {
	if (process.env.MORPH_API_KEY) return process.env.MORPH_API_KEY;
	try { return JSON.parse(readFileSync(join(homedir(), ".pi", "agent", "auth.json"), "utf8")).morph?.key; } catch { return undefined; }
}

let wrapped = false;
function meterFetch() {
	if (wrapped) return;
	wrapped = true;
	const inner = globalThis.fetch;
	globalThis.fetch = (async (input: any, init?: any) => {
		const res = await inner(input, init);
		const u = scope.getStore();
		const url = typeof input === "string" ? input : input?.url ?? String(input);
		if (u && url.includes("morphllm.com") && url.includes("/chat/completions")) {
			res.clone().json().then((d: any) => {
				u.calls++;
				u.prompt += d?.usage?.prompt_tokens ?? 0;
				u.completion += d?.usage?.completion_tokens ?? 0;
				u.cached += d?.usage?.prompt_tokens_details?.cached_tokens ?? 0;
			}, () => {});
		}
		return res;
	}) as typeof fetch;
}

export function registerWarpGrepTool(pi: ExtensionAPI, deps: GrepDeps, key: string): void {
	meterFetch();
	pi.registerTool({
		name: "warpgrep",
		label: "warpgrep",
		description:
			"Answer a natural-language question about the local codebase (\"how does X work\", \"where is Y handled\", \"what calls Z\") with a fast search subagent " +
			"that runs ripgrep/read/ls for you over several turns and returns only the relevant line ranges" + (deps.plain ? ". " : ", anchored for edit. ") +
			"One call replaces an exploratory chain of grep and read. For an exact identifier or string, grep is cheaper.",
		promptSnippet: "Search the codebase with a natural-language question; returns the relevant line ranges",
		promptGuidelines: [
			"Orienting in unfamiliar code: start with warpgrep instead of a chain of grep/read; read or grep afterwards only for what it missed.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "What to find, in natural language, with any names you already know" }),
			path: Type.Optional(Type.String({ description: "Directory to search (default: current directory)" })),
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			const { WarpGrepClient } = await import("@morphllm/morphsdk");
			const root = resolve(ctx.cwd, params.path ?? ".");
			const usage: Usage = { calls: 0, prompt: 0, completion: 0, cached: 0 };
			const t0 = Date.now();
			let turns = 0;
			const result = await scope.run(usage, async () => {
				const gen = new WarpGrepClient({ morphApiKey: key, timeout: 60_000 }).execute({ searchTerm: params.query, repoRoot: root, streamSteps: true } as any) as any;
				for (;;) {
					if (signal?.aborted) throw new Error("aborted");
					const { value, done } = await gen.next();
					if (done) return value;
					turns = value?.turn ?? turns;
				}
			});
			const ms = Date.now() - t0;
			const ok = result?.success && result.contexts?.length;
			const sections: string[] = [];
			for (const c of ok ? result.contexts : []) {
				const file = resolve(root, c.file);
				const raw = await readFile(file, "utf8").catch(() => null);
				if (raw === null || raw.includes("\0")) { sections.push(c.file + "\n" + c.content); continue; }
				const lines = raw.split("\n");
				if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
				const { ledger, changed } = deps.ledger.sync(file, lines);
				if (changed) deps.persist(file);
				const ranges: [number, number][] = !c.lines || c.lines === "*" ? [[1, lines.length]] : c.lines;
				const out = [c.file + " " + ranges.map(([s, e]) => s + "-" + e).join(",")];
				let last = 0;
				for (const [s, e] of [...ranges].sort((a, b) => a[0] - b[0])) {
					if (last && s > last + 1) out.push("    ⋯");
					for (let n = Math.max(s, last + 1, 1); n <= Math.min(e, lines.length); n++)
						out.push(String(n).padStart(5) + " " + (deps.plain ? truncateLine(lines[n - 1]).text : formatRow(ledger.lines[n - 1].anchor, truncateLine(lines[n - 1]).text)));
					last = Math.max(last, e);
				}
				sections.push(out.join("\n"));
			}
			const body = ok ? sections.join("\n\n") : "No relevant code found" + (result?.error ? ": " + result.error : "") + ". Fall back to grep/read.";
			const t = truncateHead(body, { maxLines: Number.MAX_SAFE_INTEGER });
			const text = t.content + (t.truncated ? "\n\n[50KB limit reached; narrow the query or read the listed ranges]" : "");
			const details = { turns, ms, usage, contexts: result?.contexts?.length ?? 0, outChars: text.length };
			try {
				mkdirSync(join(homedir(), ".cache", "profile"), { recursive: true });
				appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), session: ctx.sessionManager.getSessionId?.(), cwd: ctx.cwd, query: params.query, ...details, ok: !!ok }) + "\n");
			} catch {}
			return { content: [{ type: "text" as const, text }], details };
		},
	});
}
