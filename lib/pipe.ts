// `pipe`: the same optional argument on every tool whose output is text worth post-processing.
// The rendered output goes to `bash -c <command>` on stdin; what comes back replaces it.
// Tools lift their default size limits when piping, since the pipe is the filter.

import { spawnSync } from "node:child_process";
import { truncateHead } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export const PIPE_MAX_BYTES = 50_000;

export const PipeParam = Type.Optional(
	Type.String({ description: "bash command; the rendered output on stdin, its stdout returned instead. e.g. `rg -n TODO`, `jq -c .`, `sort -u | head`. Lifts the default output limit." }),
);

export function pipe(text: string, command: string, cwd: string): string {
	const r = spawnSync("bash", ["-c", command], { input: text, cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
	if (r.error) throw r.error;
	if (r.status !== 0) throw new Error(`pipe exited ${r.status}: ${r.stderr.trim()}`);
	const t = truncateHead(r.stdout, { maxBytes: PIPE_MAX_BYTES, maxLines: Number.MAX_SAFE_INTEGER });
	return t.truncated ? `${t.content}\n[pipe output truncated: ${t.outputLines} of ${t.totalLines} lines]` : t.content;
}

/** Split a whitespace-separated argument list, honoring single and double quotes, so one string field can name several things. */
export function words(input: string): string[] {
	const out: string[] = [];
	let cur = "";
	let quote: string | undefined;
	let had = false;
	for (const ch of input) {
		if (quote) {
			if (ch === quote) quote = undefined;
			else cur += ch;
		} else if (ch === '"' || ch === "'") {
			quote = ch;
			had = true;
		} else if (/\s/.test(ch)) {
			if (cur || had) out.push(cur);
			cur = "";
			had = false;
		} else cur += ch;
	}
	if (cur || had) out.push(cur);
	return out;
}
