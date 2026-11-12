// Controlled first use of the public Chat/LifeLog surface; no model requests or credentials.
// Each compactor is a separate bun process, sharing only the temporary records store.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Chat, settings, type Env } from "../../../extensions/context/life/build.ts";
import { lifeLog } from "../../../extensions/context/life/log.ts";
import { fieldsOf, fieldTags, select, write } from "../../../lib/records/store.ts";

const emit = (event: string, fields = {}) => console.log(JSON.stringify({ event, ...fields }));
const model = { provider: "controlled", id: "turn", api: "controlled-stream" };
const cfg = () => ({ ...settings(tmpdir()), cut: "due" as const, model: undefined, systemPrompt: "auto" as const, retries: 1, concurrency: 1 });

if (process.argv[2] === "--worker") {
	const id = process.argv[3]!;
	const stop = new AbortController();
	let release: ((message: any) => void) | undefined;
	let calls = 0;
	const c = new Chat(2, cfg());
	const env: Env = {
		session: String(process.pid), model, signal: stop.signal,
		turn: () => ({ systemPrompt: "controlled turn system", tools: [{ name: "demo_tool" }] }),
		modelRegistry: {
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "controlled-local-stream" }),
			streamSimple: (resolved: any, context: any, options: any) => {
				calls++;
				emit("call", { calls, model: resolved.provider + "/" + resolved.id, systemPrompt: context.systemPrompt,
					tools: context.tools.map((t: any) => t.name), cacheMarking: typeof options.onPayload === "function",
					placeBearingInput: context.messages[0].content.some((p: any) => p.text?.includes("<input>\nuser@thread-one: ")) });
				const result = new Promise((done) => { release = done; });
				return { result: () => result };
			},
		},
		notify: (message) => emit("warning", { message }),
	};
	const state = () => ({ calls, line: c.resolve([0, 0]) ?? null, pending: c.pending(), summarized: c.summarized() });
	c.sync(lifeLog(id), env);
	emit("ready", state());
	for await (const command of createInterface({ input: process.stdin })) {
		if (command === "wait") {
			emit("waiting");
			void c.idle(c.T, 5_000).then(() => emit("idle", state()));
		} else if (command.startsWith("release ")) {
			release?.({ role: "assistant", content: [{ type: "text", text: command.slice(8) }], stopReason: "stop" });
			await Bun.sleep(0);
			emit("released", state());
		} else if (command === "inspect") emit("state", state());
		else if (command === "abort") { stop.abort(); emit("aborted", state()); }
		else if (command === "stop") { stop.abort(); c.dispose(); break; }
	}
	process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "life-shared-tree-first-use-"));
process.env.PI_BOARD_DIR = dir;
const processes: ReturnType<typeof worker>[] = [];
function worker(id: string) {
	const child = Bun.spawn([process.execPath, import.meta.path, "--worker", id], { stdin: "pipe", stdout: "pipe", stderr: "inherit", env: process.env });
	const events: any[] = [];
	const changed = new Set<() => void>();
	void (async () => {
		for await (const line of createInterface({ input: Readable.fromWeb(child.stdout as any) })) {
			events.push(JSON.parse(line));
			for (const notify of changed) notify();
		}
	})();
	const send = (command: string) => { child.stdin.write(command + "\n"); child.stdin.flush(); };
	const next = (event: string) => new Promise<any>((done, fail) => {
		const timeout = setTimeout(() => { changed.delete(check); fail(new Error("worker timed out waiting for " + event)); }, 8_000);
		const check = () => {
			const k = events.findIndex((e) => e.event === event);
			if (k < 0) return;
			clearTimeout(timeout); changed.delete(check); done(events.splice(k, 1)[0]);
		};
		changed.add(check); check();
	});
	const result = { child, send, next, stop: async () => { send("stop"); await child.exited; } };
	processes.push(result);
	return result;
}
function seed(id: string) {
	lifeLog(id).append([{ kind: "user", text: "x".repeat(2_000), source: "entry:demo/message#0", place: "thread-one", model: "controlled/turn", date: "2026-11-12T00:00:00Z" }]);
}
const tags = (id: string) => fieldTags("life", { id, key: JSON.stringify([id, 2, 0, 0]), b: 2, l: 0, i: 0, model: "controlled/turn" });
const rows = (schema: string, id: string) => select(schema).filter((r) => fieldsOf("life", r.tags).id === id);
const inspect = async (w: ReturnType<typeof worker>) => { w.send("inspect"); return w.next("state"); };
try {
	const id = "/lease-winner";
	seed(id);
	const a = worker(id);
	await a.next("ready");
	const call = await a.next("call");
	const b = worker(id);
	const waiting = await b.next("ready");
	b.send("wait"); await b.next("waiting");
	emit("lease-election", { leases: rows("life.lease", id).length, firstLease: rows("life.lease", id)[0]?.seq, builder: call, siblingBeforeCommit: waiting });
	a.send("release user@thread-one: winner A");
	await a.next("released");
	const adopted = await b.next("idle");
	emit("sibling-adoption-during-idle", { sibling: adopted, builder: await inspect(a), records: rows("life.node", id).length });
	write({ schema: "life.node", body: "LATER duplicate", tags: tags(id) });
	const stop = new AbortController(); stop.abort();
	const fresh = new Chat(2, cfg());
	fresh.sync(lifeLog(id), { session: "fresh-loader", model, modelRegistry: {}, signal: stop.signal, turn: () => ({ systemPrompt: "", tools: [] }) });
	emit("first-record-wins-reload", { records: rows("life.node", id).map((r) => ({ seq: r.seq, body: r.body })), loaded: fresh.resolve([0, 0]) });
	await a.stop(); await b.stop();

	const recoveryId = "/expired-lease";
	seed(recoveryId);
	write({ schema: "life.lease", ts: new Date(Date.now() - 600_000 + 1_500).toISOString(), tags: tags(recoveryId) });
	const recovery = worker(recoveryId);
	const before = await recovery.next("ready");
	const started = Date.now();
	recovery.send("wait"); await recovery.next("waiting");
	const recoveredCall = await recovery.next("call");
	recovery.send("release user@thread-one: recovered after expiry");
	await recovery.next("released");
	emit("expired-lease-recovery", { before, elapsedMs: Date.now() - started, call: recoveredCall, idle: await recovery.next("idle"), after: await inspect(recovery), leases: rows("life.lease", recoveryId).length });
	await recovery.stop();

	const lateId = "/late-local-result";
	seed(lateId);
	const late = worker(lateId);
	await late.next("ready"); await late.next("call");
	write({ schema: "life.node", body: "user@thread-one: sibling committed first", tags: tags(lateId) });
	late.send("release LOCAL late result"); await late.next("released");
	emit("late-local-result", { state: await inspect(late), records: rows("life.node", lateId).map((r) => r.body) });
	await late.stop();

	const cancelId = "/cancelled-build";
	seed(cancelId);
	const cancelled = worker(cancelId);
	await cancelled.next("ready"); await cancelled.next("call");
	cancelled.send("wait"); await cancelled.next("waiting");
	cancelled.send("abort"); await cancelled.next("aborted");
	const cancelledWait = await cancelled.next("idle");
	cancelled.send("release LOCAL result after abort"); await cancelled.next("released");
	emit("cancelled-build", { idle: cancelledWait, afterResult: await inspect(cancelled), records: rows("life.node", cancelId).length });
	await cancelled.stop();
} finally {
	for (const w of processes) if (w.child.exitCode === null) { w.child.kill(); await w.child.exited; }
	rmSync(dir, { recursive: true, force: true });
}
