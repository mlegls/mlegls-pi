// Refuse host-wide kills by pattern. Many workers share this host: `pkill -f 'bun test'` from one checkout killed
// other workers' pi processes, whose argv carried their bootstrap prompt (docs/issues/workers-crash-on-uncaught-epipe.md
// has the neighbouring history). Stop what you started by pid, or through the process tool or the checkout's own stop task.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KILL_BY_PATTERN = /(^|[\s;&|(`$])(pkill|killall)(\s|$)/;

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;
		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!KILL_BY_PATTERN.test(command)) return;
		return { block: true, reason: "pkill/killall match processes host-wide, including other sessions' workers. Stop processes you started by pid (kill <pid>), with the process tool, or with the checkout's own stop task." };
	});
}
