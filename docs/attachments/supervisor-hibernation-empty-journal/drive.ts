import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repo = resolve(import.meta.dir, "../../..");
const root = mkdtempSync(join(tmpdir(), "supervisor-hibernation-empty-journal-"));
console.log(`temporary session root: ${root}`);
const project = join(root, "project"), state = join(root, "state"), sessions = join(root, "sessions");
const issue = join(project, "docs/issues/empty-journal-campaign.md");
const ledger = join(state, "empty-journal-ledger.jsonl");
const job = join(state, "supervise-empty-journal-campaign.json");
const settingsPath = join(project, ".pi/settings.json");
for (const dir of [join(project, ".pi"), join(project, "docs/issues"), state, sessions]) mkdirSync(dir, { recursive: true });
writeFileSync(issue, `# Empty-journal campaign\n\nThe synthetic child-alpha task is to confirm the journal-free wake path. When it is still running, keep waiting. When it reports, inspect its result before integrating. The issue and live job state are authoritative; a prior session judgment is not.\n`);
writeFileSync(ledger, `${JSON.stringify({ seq: 1, decision: "Treat the child's old status as a prediction; re-read the job and issue on wake." })}\n`);
const settings = (journal: boolean) => ({ compaction: { keepRecentTokens: 64 }, memory: {
	enabled: true, journal, keepRecentTokens: 256,
	hibernate: { enabled: true, minTokens: 1 },
	elide: { enabled: false },
} });
writeFileSync(settingsPath, JSON.stringify(settings(true), null, 2) + "\n");

const cliArgs = [
	"--mode", "rpc", "--provider", "anthropic", "--model", "claude-haiku-4-5",
	"--no-extensions", "--extension", join(repo, "extensions/memory/index.ts"),
	"--no-context-files", "--no-skills", "--no-prompt-templates", "--no-themes",
	"--tools", "read,bash", "--thinking", "off", "--approve", "--session-dir", sessions,
];
const child = spawn("pi", cliArgs, {
	cwd: project,
	env: { ...process.env, AB_STATE: state },
	stdio: ["pipe", "pipe", "inherit"],
});
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const events: { sequence: number; value: any }[] = [];
const allEvents: any[] = [];
const waiters: { test: (event: any) => boolean; after: number; resolve: (event: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }[] = [];
let serial = 0, eventSequence = 0;
let rpcBuffer = "";
const receiveLine = (line: string) => {
	let value: any;
	try { value = JSON.parse(line); } catch { return; }
	if (value.type === "response" && value.id && pending.has(value.id)) {
		const request = pending.get(value.id)!;
		pending.delete(value.id);
		if (value.success) request.resolve(value.data);
		else request.reject(new Error(value.error ?? `Pi RPC ${value.command} failed`));
		return;
	}
	const sequence = ++eventSequence;
	events.push({ sequence, value });
	allEvents.push(value);
	if (["agent_start", "agent_end", "agent_settled", "compaction_start", "compaction_end"].includes(value.type))
		console.log(`[rpc] ${value.type}${value.type === "agent_end" ? ` (${value.willRetry ? "retry" : "end"})` : ""}`);
	for (const waiter of [...waiters]) if (sequence > waiter.after && waiter.test(value)) {
		waiters.splice(waiters.indexOf(waiter), 1);
		clearTimeout(waiter.timer);
		waiter.resolve(value);
	}
};
child.stdout!.setEncoding("utf8").on("data", chunk => {
	rpcBuffer += chunk;
	let newline: number;
	while ((newline = rpcBuffer.indexOf("\n")) !== -1) {
		const line = rpcBuffer.slice(0, newline).replace(/\r$/, "");
		rpcBuffer = rpcBuffer.slice(newline + 1);
		if (line) receiveLine(line);
	}
});
child.on("exit", code => {
	for (const waiter of waiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(new Error(`Pi exited (${code}) before expected event`)); }
	for (const request of pending.values()) request.reject(new Error(`Pi exited (${code}) before RPC response`));
	pending.clear();
});
const request = (type: string, body: Record<string, unknown> = {}) => {
	const id = `empty-journal-${++serial}`;
	const result = new Promise<any>((resolveRequest, reject) => pending.set(id, { resolve: resolveRequest, reject }));
	child.stdin!.write(JSON.stringify({ id, type, ...body }) + "\n");
	return result;
};
const event = (test: (value: any) => boolean, timeout = 180_000, after = 0) => {
	const index = events.findIndex(record => record.sequence > after && test(record.value));
	if (index >= 0) return Promise.resolve(events.splice(index, 1)[0].value);
	return new Promise<any>((resolveEvent, reject) => {
		const waiter = { test, after, resolve: resolveEvent, reject, timer: setTimeout(() => {
			waiters.splice(waiters.indexOf(waiter), 1);
			reject(new Error(`Timed out waiting for a Pi RPC event; recent events: ${allEvents.slice(-12).map(e => e.type).join(", ") || "none"}`));
		}, timeout) };
		waiters.push(waiter);
	});
};
const prompt = async (message: string) => {
	const after = eventSequence;
	const started = event(e => e.type === "agent_start", 120_000, after);
	await request("prompt", { message });
	await started;
	const afterStart = eventSequence;
	const settled = event(e => e.type === "agent_settled", 300_000, afterStart);
	await settled;
};
const compact = async (customInstructions: string) => {
	const after = eventSequence;
	const completed = event(e => e.type === "compaction_end", 300_000, after);
	await request("compact", { customInstructions });
	return completed;
};
const entries = (file: string) => readFileSync(file, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));

let sessionFile = "";
try {
	await new Promise<void>((resolveStart, rejectStart) => {
		child.once("spawn", resolveStart);
		child.once("error", rejectStart);
	});
	const initial = await request("get_state");
	const sessionId = initial.sessionId as string;
	sessionFile = initial.sessionFile as string;
	writeFileSync(job, JSON.stringify({
		id: "supervise-empty-journal-campaign", type: "supervise", status: "running",
		input: { ticket: "empty-journal-campaign", ownerSession: sessionId, cwd: project },
		state: { children: { "child-alpha": { status: "running", task: "check journal-free wake" } } },
	}, null, 2) + "\n");
	writeFileSync(join(state, "jobs.json"), JSON.stringify([job]) + "\n");

	await prompt("For this synthetic campaign, preserve this judgment for a later turn: child-alpha's current status is only a prediction until the job and issue are re-read. We should keep waiting, and inspect the issue before integrating. Acknowledge briefly.");
	await prompt("One more judgment: an empty journal should leave only the latest user-led conversational tail; the campaign's job, ledger and issue are the source of truth on wake. Acknowledge briefly.");
	await prompt("No child report has arrived yet. Keep the wait decision, do not change it without new evidence, and acknowledge briefly.");

	const normalFold = await compact("Keep the decision to re-read child state and the reason for waiting; cite this conversation normally.");
	const afterNormal = entries(sessionFile).filter(e => e.type === "compaction").at(-1);
	writeFileSync(settingsPath, JSON.stringify(settings(false), null, 2) + "\n");

	await prompt("The child has not reported. Stay idle and acknowledge in one short sentence; do not inspect artifacts yet.");
	await prompt("Still waiting, with no new evidence. Acknowledge briefly and wait.");
	const settledAt = Date.now();
	const hibernated = event(e => e.type === "compaction_end", 390_000, eventSequence);
	await delay(305_000);
	const hibernateEvent = await hibernated;
	const afterHibernate = entries(sessionFile).filter(e => e.type === "compaction").at(-1);
	const attemptsFile = join(resolve(sessionFile, ".."), "memory-attempts.jsonl");
	const attempts = (() => { try { return entries(attemptsFile); } catch { return []; } })();

	const wakeStart = allEvents.length;
	await prompt(`The session has just woken after intentionally discarding its journal. Rebuild the campaign state from these artifacts, not from an earlier conversational judgment. Read the issue, job and ledger directly with bash: issue=${issue}; job=${job}; ledger=${ledger}. State whether child-alpha is still running and what the next action should be.`);
	const wakeMessages = allEvents.slice(wakeStart).filter(e => e.type === "message_end").map(e => ({ role: e.message?.role, content: e.message?.content }));
	const output = {
		root, project, state, sessionFile, sessionId,
		model: initial.model && `${initial.model.provider}/${initial.model.id}`,
		normalFold: { id: afterNormal?.id, summaryCharacters: afterNormal?.summary?.length ?? null, blocks: afterNormal?.details?.blocks?.length ?? null },
		hibernate: {
			settledAt: new Date(settledAt).toISOString(),
			compactionEnd: hibernateEvent.type,
			id: afterHibernate?.id, trigger: afterHibernate?.details?.trigger,
			summary: afterHibernate?.summary, blocks: afterHibernate?.details?.blocks,
			operation: afterHibernate?.details?.operation, tail: afterHibernate?.details?.tail,
			attemptTriggers: attempts.map(a => a.trigger),
		},
		wakeMessages,
	};
	writeFileSync(join(root, "result.json"), JSON.stringify(output, null, 2) + "\n");
	console.log(JSON.stringify(output, null, 2));
} finally {
	try { await request("shutdown"); } catch { child.kill("SIGTERM"); }
	if (child.exitCode === null) await new Promise<void>(resolveExit => child.once("exit", () => resolveExit()));
}
