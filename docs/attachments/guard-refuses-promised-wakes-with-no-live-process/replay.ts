import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import guard from "../../../extensions/guard/index.ts";

const mode = process.argv[2] ?? "empty";
assert(mode === "empty" || mode === "live", "Usage: bun replay.ts [empty|live] [path/to/pi-processes/src/index.ts]");
const processes = resolve(process.argv[3] ?? join(homedir(), "dev/pi-processes/src/index.ts"));
const promise = "waiting\n\nWhen the watcher finishes, I'll publish.";
const dir = await mkdtemp(join(tmpdir(), "promised-wake-"));
process.env.PI_WM_HANDLE = "promised-wake-replay";
process.env.PI_CODING_AGENT_DIR = dir;
process.env.PI_OFFLINE = "1";
process.env.OPENAI_API_KEY = "offline-replay";

try {
	const settingsManager = SettingsManager.inMemory();
	const resourceLoader = new DefaultResourceLoader({
		cwd: dir, agentDir: dir, settingsManager, extensionFactories: [guard],
		additionalExtensionPaths: mode === "live" ? [processes] : [],
	});
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd: dir, agentDir: dir, settingsManager, resourceLoader,
		sessionManager: SessionManager.create(dir, dir),
		model: getBuiltinModel("openai", "gpt-4o"), tools: ["process"],
	});
	try {
		await session.bindExtensions({ mode: "rpc", onError: error => { throw new Error(JSON.stringify(error)); } });
		assert.equal(session.getActiveToolNames().includes("process"), mode === "live", "Unexpected process tool availability");
		console.log(`Ready: ${mode === "live" ? "Pi + process extension in a fresh session" : "Pi in a fresh session with no process"}`);
		let calls = 0;
		session.agent.streamFunction = model => {
			assert(++calls <= 2, "Guard kept following up");
			const start = mode === "live" && calls === 1;
			const reason = start ? "toolUse" : "stop";
			const message: AssistantMessage = {
				role: "assistant", api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(), stopReason: reason,
				content: start ? [{ type: "toolCall", id: "start-watcher", name: "process", arguments: {
					action: "start", name: "replay-watcher", command: "sleep 30",
				} }] : [{ type: "text", text: promise }],
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			};
			const stream = createAssistantMessageEventStream();
			stream.push({ type: "done", reason, message });
			return stream as unknown as Awaited<ReturnType<typeof session.agent.streamFunction>>;
		};
		await session.prompt("Report when you will publish.");
		const messages = session.agent.state.messages;
		const refusals = messages.flatMap(message => message.role === "custom" && message.customType === "promised-wake" ? [message.content] : []);
		if (mode === "live") {
			const started = messages.find(message => message.role === "toolResult" && message.toolCallId === "start-watcher");
			assert(started?.role === "toolResult" && !started.isError && started.details?.success === true, "Watcher did not start");
			assert.equal(refusals.length, 0);
			console.log("Same promise accepted with a live managed watcher.");
		} else {
			assert.equal(refusals.length, 1);
			assert.equal(calls, 2, "The refusal should prompt exactly one follow-up");
			const refusal = refusals[0];
			assert.equal(refusal, "Nothing is running that will wake this thread. Wait in the foreground with process wait, or hand the wait to an automation.");
			console.log(refusal);
			console.log("Repeated promise accepted on the second turn end.");
		}
	} finally {
		await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		session.dispose();
	}
} finally {
	await rm(dir, { recursive: true, force: true });
}
