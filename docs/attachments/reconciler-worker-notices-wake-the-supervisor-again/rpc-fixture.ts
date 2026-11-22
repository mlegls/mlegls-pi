// Disposable Pi RPC supervisor; the fallback provider is a local marker, so no auth or network is needed.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { localCompletions } from "../../../extensions/bb/local-completion";
import { saveState, type State } from "../../../lib/reconcile/reconcile";

export default function fixtureProvider(pi: ExtensionAPI) {
	localCompletions(pi);
	pi.registerProvider("notice-fixture", {
		api: "notice-fixture-api", baseUrl: "local://notice-fixture", apiKey: "fixture",
		models: [{ id: "probe", name: "Fallback marker", reasoning: false, input: ["text"], contextWindow: 96000, maxTokens: 32,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
		streamSimple(model) {
			const stream = createAssistantMessageEventStream();
			const message: AssistantMessage = { role: "assistant", api: model.api, provider: model.provider, model: model.id,
				content: [{ type: "text", text: "PASSED THROUGH" }], stopReason: "stop", timestamp: Date.now(),
				usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
			stream.push({ type: "done", reason: "stop", message });
			stream.end();
			return stream;
		},
	});
}

if (import.meta.main) {
	const scratch = resolve(import.meta.dir, "../../../.wm");
	mkdirSync(scratch, { recursive: true });
	const cwd = mkdtempSync(join(scratch, "notice-rpc-"));
	const child = spawn("pi", ["--mode", "rpc", "--no-session", "--no-extensions", "--model", "notice-fixture/probe", "-e", import.meta.path],
		{ cwd, stdio: ["pipe", "pipe", "inherit"] });
	const exited = new Promise<void>(ok => { child.on("close", () => ok()); child.on("error", () => ok()); });
	const timeout = setTimeout(() => child.kill(), 30_000);
	const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
	const send = (command: object) => child.stdin.write(JSON.stringify(command) + "\n");
	const until = async (take: (event: any) => boolean) => {
		for (;;) {
			const { value, done } = await lines.next();
			if (done) throw new Error("Pi RPC exited before the requested event");
			const event = JSON.parse(value);
			if (event.type === "response" && !event.success) throw new Error(event.error);
			if (take(event)) return event;
		}
	};
	try {
		execFileSync("git", ["init", "-q", cwd]);
		const root = "notice-fixture";
		const state: State = { backend: "threads", cwd, root, owner: "thr_owner", pid: process.pid,
			chains: { fixture: { phase: "implement", into: cwd, self: false, retries: {},
				handle: { run: root, handle: "fixture-implement", bb: "thr_current", path: cwd },
				workers: [{ run: root, handle: "fixture-retired", bb: "thr_previous", path: cwd }] } },
			budget: 1, landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, exceptions: {},
			tests: {}, resolved: {}, moved: {}, counter: 0, log: [] };
		saveState(state);
		send({ type: "get_state" });
		const ready = await until(e => e.type === "response" && e.command === "get_state");
		if (ready.data.model?.provider !== "notice-fixture") throw new Error("Scripted fallback provider not selected");
		console.log("NOTICE_RPC_READY", cwd);
		const single = "[bb system]\n\n@thread:thr_current completed:\n\ndone";
		const group = (id: string) => "[bb system]\n\nChild thread updates:\n\n- @thread:thr_current completed.\n- @thread:" + id + " completed.";
		for (const [label, message] of [
			["live single", single], ["retired single", single], ["owned group", group("thr_previous")],
			["mixed group", group("thr_ordinary")], ["owner exception", "[reconcile notice-fixture] needs you: fixture — decision required"],
			["maintainer", "Check on the fixture."],
		]) {
			if (label === "retired single") saveState({ ...state, chains: {}, workerThreads: undefined, finished: "done", pid: undefined });
			send({ type: "prompt", message });
			let assistant: AssistantMessage | undefined;
			await until(event => {
				if (event.type === "message_end" && event.message.role === "assistant") assistant = event.message;
				return event.type === "agent_settled";
			});
			if (!assistant) throw new Error("No assistant settlement for " + label);
			console.log(label + ":", assistant.provider, assistant.content.length + " blocks,", assistant.usage.totalTokens + " tokens");
		}
	} finally {
		clearTimeout(timeout);
		child.stdin.end(); child.kill();
		await exited;
		rmSync(cwd, { recursive: true, force: true });
	}
}
