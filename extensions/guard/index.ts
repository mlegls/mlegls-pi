// Refuse host-wide kills by pattern. Many workers share this host: `pkill -f 'bun test'` from one checkout killed
// other workers' pi processes, whose argv carried their bootstrap prompt (docs/issues/workers-crash-on-uncaught-epipe.md
// has the neighbouring history). Stop what you started by pid, or through the process tool or the checkout's own stop task.
//
// Workers also may not bypass a project's git hooks: drivers committed with `git -c core.hooksPath=/dev/null commit`, and the
// commits escaped concept's pre-commit formatter (concept docs/attachments/worker-commits-escape-the-pre-commit-formatter).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KILL_BY_PATTERN = /(^|[\s;&|(`$])(pkill|killall)(\s|$)/;

/** The git hook bypasses a worker reaches for, in a shell command; the reason, or undefined. */
export function hookBypass(command: string): string | undefined {
	for (const segment of command.split(/&&|\|\||[;|\n]/)) {
		if (/(?:^|\s)-c\s*core\.hookspath=/i.test(segment) || /\bconfig\b.*\bcore\.hookspath\s+(?!-)\S/i.test(segment) && !/--(?:get|unset)/.test(segment)) return "core.hooksPath";
		if (/\bgit\b.*\s--no-verify\b/.test(segment)) return "--no-verify";
		// commit's -n is --no-verify, alone or among short flags (-an); -m's argument is not a flag.
		if (/\bgit\b.*\bcommit\b/.test(segment) && /\s-(?!-)[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(segment.replace(/(-[a-zA-Z]*[mF])\s+("[^"]*"|'[^']*'|\S+)/g, "$1"))) return "commit -n";
		if (/\bHUSKY=0\b|\bHUSKY_SKIP_HOOKS=(?:1|true)\b/.test(segment)) return "HUSKY";
	}
}

export default function (pi: ExtensionAPI) {
	const worker = !!process.env.PI_WM_HANDLE;
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash" && event.toolName !== "process") return;
		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!command) return;
		if (event.toolName === "bash" && KILL_BY_PATTERN.test(command))
			return { block: true, reason: "pkill/killall match processes host-wide, including other sessions' workers. Stop processes you started by pid (kill <pid>), with the process tool, or with the checkout's own stop task." };
		const bypass = worker ? hookBypass(command) : undefined;
		if (bypass) return { block: true, reason: "Workers don't bypass git hooks (" + bypass + "): they are the project's own checks, and commits that skip them escaped its formatter. Commit normally. If a hook is slow, run the commit as a managed process and wait for it; if it fails for reasons outside your change, report blocked with its output." };
	});
}
