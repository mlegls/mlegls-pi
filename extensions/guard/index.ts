// Refuse host-wide kills by pattern. Many workers share this host: `pkill -f 'bun test'` from one checkout killed
// other workers' pi processes, whose argv carried their bootstrap prompt (docs/issues/workers-crash-on-uncaught-epipe.md
// has the neighbouring history). Stop what you started by pid, or through the process tool or the checkout's own stop task.
//
// Workers also may not bypass a project's git hooks: drivers committed with `git -c core.hooksPath=/dev/null commit`, and the
// commits escaped concept's pre-commit formatter (concept docs/attachments/worker-commits-escape-the-pre-commit-formatter).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parse } from "../../lib/report.ts";

const KILL_BY_PATTERN = /(^|[\s;&|(`$])(pkill|killall)(\s|$)/;

/** The git hook bypasses a worker reaches for, in a shell command; the reason, or undefined. */
export function hookBypass(command: string): string | undefined {
	for (const segment of command.split(/&&|\|\||[;|\n]/)) {
		if (/(?:^|\s)-c\s*core\.hookspath=/i.test(segment) || /\bconfig\b.*\bcore\.hookspath\s+(?!-)\S/i.test(segment) && !/--(?:get|unset)/.test(segment)) return "core.hooksPath";
		if (/\bgit\b.*\s--no-verify\b/.test(segment)) return "--no-verify";
		// commit's -n is --no-verify, alone or among short flags (-an); -m/-F arguments are not flags.
		// Only inspect commit's suffix: an outer command (e.g. tmux -n) has its own flags.
		const commitArgs = segment.match(/\bgit\b.*?\bcommit\b(.*)/)?.[1];
		if (commitArgs && /\s-(?!-)[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(commitArgs.replace(/(-[a-zA-Z]*[mF])\s+("[^"]*"|'[^']*'|\S+)/g, "$1"))) return "commit -n";
		if (/\bHUSKY=0\b|\bHUSKY_SKIP_HOOKS=(?:1|true)\b/.test(segment)) return "HUSKY";
	}
}

export default function (pi: ExtensionAPI) {
	const worker = !!process.env.PI_WM_HANDLE;
	// Correct the report before bb publishes this turn's completion. One
	// follow-up per input leaves repeated refusal to the reconciler's budget.
	let repairedHandoff = false;
	pi.on("input", () => { repairedHandoff = false; });
	pi.on("agent_end", (event, ctx) => {
		if (!worker || repairedHandoff) return;
		const last = event.messages.at(-1);
		if (last?.role !== "assistant") return;
		const text = last.content.filter(part => part.type === "text").map(part => part.text).join("\n");
		const report = parse(text, ctx.cwd);
		if (report.status !== "done" || !report.handoffError?.startsWith("Foreign commits ")) return;
		repairedHandoff = true;
		pi.sendMessage({ customType: "commit-handoff", content: report.handoffError, display: false }, { deliverAs: "followUp" });
	});
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash" && event.toolName !== "process") return;
		const input = event.input as { command?: unknown; timeout?: unknown };
		// bash uses seconds; millisecond-shaped values have held workers for hours.
		if (event.toolName === "bash" && typeof input.timeout === "number" && input.timeout > 1800)
			return { block: true, reason: `bash timeout is in seconds: ${input.timeout} s is ${(input.timeout / 3600).toFixed(1)} h; the ceiling is 1800 s. Slow or streaming work goes through the process tool.` };
		const command = String(input.command ?? "");
		if (!command) return;
		if (event.toolName === "bash" && KILL_BY_PATTERN.test(command))
			return { block: true, reason: "pkill/killall match processes host-wide, including other sessions' workers. Stop processes you started by pid (kill <pid>), with the process tool, or with the checkout's own stop task." };
		const bypass = worker ? hookBypass(command) : undefined;
		if (bypass) return { block: true, reason: "Workers don't bypass git hooks (" + bypass + "): they are the project's own checks, and commits that skip them escaped its formatter. Commit normally. If a hook is slow, run the commit as a managed process and wait for it; if it fails for reasons outside your change, report blocked with its output." };
	});
}
