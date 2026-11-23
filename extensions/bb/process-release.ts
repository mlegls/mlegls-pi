import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnDetached } from "../../lib/reconcile/process";
import { isRetired } from "../../lib/session-meta/live";
import { pidAlive } from "../../lib/wm";

interface ProcessReceipt {
	id: string;
	name: string;
	status: string;
	endTime: number | null;
	exitCode: number | null;
	interruption?: string;
}

function receipts(dir: string): ProcessReceipt[] {
	try {
		const registry = JSON.parse(readFileSync(join(dir, "registry.json"), "utf8"));
		return registry.version === 1 && Array.isArray(registry.records)
			? registry.records.map((record: { info?: ProcessReceipt }) => record?.info).filter((info?: ProcessReceipt) => info?.id && info?.name)
			: [];
	} catch { return []; }
}

const live = (p: ProcessReceipt) => ["running", "terminating", "terminate_timeout"].includes(p.status);

export function wakeAfterProcessRelease(pi: ExtensionAPI): void {
	const thread = process.env.BB_THREAD_ID;
	if (!thread) return;
	const started = Date.now();
	let settled = false;
	pi.on("before_agent_start", () => { settled = false; });
	pi.on("agent_settled", event => { settled = !event.aborted; });
	pi.on("session_shutdown", (event, ctx) => {
		// Stop of a running turn also reaches shutdown with isIdle() true, after Pi aborts the turn.
		if (event.reason !== "quit" || !ctx.isIdle() || !settled) return;
		// An owner retiring this worker (lib/thread/lifecycle-cleanup.ts) marks it before its idle Stop and kills what it ran.
		if (isRetired({ pid: process.pid, sessionId: ctx.sessionManager.getSessionId() })) return;
		const file = ctx.sessionManager.getSessionFile();
		if (!file) return;
		const dir = file + ".processes";
		// This hook can run on either side of pi-processes' cleanup hook.
		const pending = receipts(dir).filter(p => live(p) ||
			(p.status === "killed" && !!p.interruption && (p.endTime ?? 0) >= started));
		if (!pending.length) return;
		spawnDetached(["bun", import.meta.path, String(process.pid), thread, dir, JSON.stringify(pending)], ctx.cwd, join(dir, "release-wake.log"));
	});
}

async function wake(pid: number, thread: string, dir: string, pending: ProcessReceipt[]) {
	// Sending while the old runtime is being released can route the notice back into that runtime.
	const deadline = Date.now() + 15_000;
	while (pidAlive(pid)) {
		if (Date.now() >= deadline) throw new Error(`Pi runtime ${pid} did not exit`);
		await Bun.sleep(100);
	}
	const bb = (...args: string[]) => execFileSync(process.env.BB_CLI || "bb", ["thread", ...args, "--json"], { encoding: "utf8", timeout: 15_000 });
	const target = JSON.parse(bb("show", thread)).thread;
	if (target?.id !== thread || target.archivedAt || target.deletedAt || target.providerId !== "pi") return;
	const saved = new Map(receipts(dir).map(p => [p.id, p]));
	const outcomes = pending.map(p => {
		const receipt = saved.get(p.id);
		const outcome = receipt?.interruption ?? (receipt?.status === "exited" && receipt.exitCode != null
			? `Exited with code ${receipt.exitCode}.`
			: receipt?.status === "killed" ? "The process was stopped." : "No completion was recorded before Pi exited; outcome unknown.");
		return `- ${JSON.stringify(p.name)} (${p.id}): ${outcome}`;
	});
	bb("tell", thread, ["Pi released its runtime with managed processes still pending:", ...outcomes,
		"Use the process tool to read the retained output. Restart interrupted commands only if still needed."].join("\n"), "--mode", "queue");
}

if (import.meta.main) {
	const [, , pid, thread, dir, pending] = process.argv;
	await wake(Number(pid), thread, dir, JSON.parse(pending));
}
