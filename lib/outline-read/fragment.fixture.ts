import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { createAgentSession, createCodemodeExtension, DefaultResourceLoader, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerFragmentEditTool } from "./fragment";

// Replace only the model's response; pi runs the codemode and nested tool dispatch.
export async function tryEdit(code: string) {
	const cwd = await mkdtemp(join(tmpdir(), "codemode-edit-"));
	const file = join(cwd, "sample.txt");
	try {
		await writeFile(file, "hello\n");
		const settingsManager = SettingsManager.inMemory();
		const resourceLoader = new DefaultResourceLoader({
			cwd, agentDir: cwd, settingsManager,
			extensionFactories: [createCodemodeExtension({ models: false }), pi => registerFragmentEditTool(pi, { sources: [] })],
		});
		await resourceLoader.reload();
		const { session } = await createAgentSession({
			cwd, agentDir: cwd, settingsManager, resourceLoader, sessionManager: SessionManager.inMemory(cwd),
			model: getBuiltinModel("openai", "gpt-4o"), tools: ["codemode", "edit"],
		});
		try {
			let issued = false;
			session.agent.streamFunction = model => {
				const reason = issued ? "stop" : "toolUse";
				const message: AssistantMessage = {
					role: "assistant", api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
					content: issued ? [] : [{ type: "toolCall", id: "try-edit", name: "codemode", arguments: { code } }],
					stopReason: reason,
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				};
				issued = true;
				const stream = createAssistantMessageEventStream();
				stream.push({ type: "done", reason, message });
				// The lockfile resolves pi-ai twice; its event stream has nominal private fields.
				return stream as unknown as Awaited<ReturnType<typeof session.agent.streamFunction>>;
			};
			await session.agent.prompt("Edit sample.txt via codemode.");
			const result = session.agent.state.messages.find(message => message.role === "toolResult" && message.toolName === "codemode");
			if (!result || result.role !== "toolResult") throw new Error("Codemode produced no tool result");
			return { isError: result.isError, report: result.content.flatMap(block => block.type === "text" ? [block.text] : []).join("\n"), contents: await readFile(file, "utf8") };
		} finally {
			session.dispose();
		}
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	const result = await tryEdit(process.argv[2] ?? 'text(await tools.edit({edits: [{path: "sample.txt", oldText: "hello", newText: "world"}]}));');
	console.log(result.report);
	console.log("sample.txt:", JSON.stringify(result.contents));
	if (result.isError) process.exitCode = 1;
}
