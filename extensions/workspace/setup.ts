import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { pidAlive } from "../../lib/wm";
import { clearSetup, readSetup, writeSetup } from "../../lib/thread/setup";
import { currentThread } from "./thread";

const tail = (log: string) => { try { return readFileSync(log, "utf8").trimEnd().split("\n").slice(-25).join("\n"); } catch { return ""; } };

/** A new interactive thread's pi starts while its worktree setup still runs (lib/thread/setup.ts): say so once, then how it ended. */
export function registerSetup(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (_event, ctx) => {
		const thread = await currentThread(ctx);
		const status = thread && readSetup(thread.id);
		if (!thread || !status || status.state === "pending") return;
		let content: string;
		if (status.state === "running" && pidAlive(status.pid)) {
			if (status.told) return;
			writeSetup(thread.id, { ...status, told: true });
			content = "This worktree's setup (`mise run setup`) is still running, so dependencies or services may not be ready yet. Its log: " + status.log + ". You'll hear when it finishes.";
		} else {
			const code = status.state === "done" ? status.code : null;
			await clearSetup(thread.id);
			content = code === 0
				? "This worktree's setup (`mise run setup`) finished. Log: " + status.log
				: "This worktree's setup (`mise run setup`) failed (" + (code ?? "runner exited") + "). Log: " + status.log + "\n\n" + tail(status.log);
		}
		return { message: { customType: "thread-setup", content, display: true } };
	});
}
