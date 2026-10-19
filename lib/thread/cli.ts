import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { archiveThread, abandonThread, integrateThread } from "./lifecycle";
import { attachThread, historyThread, newThread, sendThread } from "./runtime";

const usage = "usage: ab thread new [--in <cwd>|--worktree <name> [--base <ref>]] [--parent <thread>] [--prompt …] | attach <id> | send|history <id> | archive|abandon|merge <id> | merge <id> --continue";

function options(args: string[], schema: ParseArgsOptionsConfig) {
	return parseArgs({ args, allowPositionals: true, strict: true, options: schema });
}
function stringOption(values: Record<string, unknown>, key: string): string | undefined {
	const value = values[key];
	return typeof value === "string" ? value : undefined;
}
function out(text: string) { process.stdout.write(text); }

export async function thread(args: string[]): Promise<void> {
	const [command, ...rest] = args;
	try {
		switch (command) {
		case "new": {
			const { values, positionals } = options(rest, { in: { type: "string" }, worktree: { type: "string" }, base: { type: "string" }, parent: { type: "string" }, prompt: { type: "string" } });
			if (positionals.length) throw new Error(usage);
			const prompt = stringOption(values, "prompt");
			const launch = prompt !== undefined ? { prompt } : undefined;
			const record = await newThread({ in: stringOption(values, "in"), worktree: stringOption(values, "worktree"), base: stringOption(values, "base"), parent: stringOption(values, "parent"), launch });
			out(JSON.stringify(record) + "\n");
			return;
		}
		case "attach": {
			const [id, ...tail] = rest;
			if (!id) throw new Error(usage);
			if (tail.length) throw new Error(usage);
			await attachThread(id);
			return;
		}
		case "send": {
			const [id, ...text] = rest;
			if (!id) throw new Error(usage);
			const input = text.length ? text.join(" ") : await Bun.stdin.text();
			await sendThread(id, input);
			return;
		}
		case "history": {
			if (rest.length !== 1) throw new Error(usage);
			out(await historyThread(rest[0]!));
			return;
		}
		case "archive": case "merge": case "abandon": {
			if (command === "merge" && rest.length === 2 && rest[1] === "--continue") {
				// Land the branch and keep the session working on it: the branch tip is now the merged commit.
				out(JSON.stringify(await integrateThread(rest[0]!) ?? null) + "\n");
				return;
			}
			if (rest.length !== 1) throw new Error(usage);
			const result = command === "abandon" ? await abandonThread(rest[0]!) : await archiveThread(rest[0]!);
			out(JSON.stringify(result) + "\n");
			if (result.blocked) { process.exitCode = 1; console.error(`Thread ${result.blocked.threadId} blocked: ${result.blocked.block.reason}`); }
			return;
		}
		default: throw new Error(usage);
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

if (import.meta.main) {
	const [command, ...args] = process.argv.slice(2);
	if (command !== "thread") { console.error(usage); process.exit(1); }
	await thread(args);
}
