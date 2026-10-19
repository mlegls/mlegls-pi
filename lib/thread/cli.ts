import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { archiveThread, abandonThread, integrateThread } from "./lifecycle";
import { attachThread, historyThread, listThreads, newThread, seeThread, sendThread } from "./runtime";
import type { ThreadRow } from "./types";

const usage = "usage: ab thread ls [--tree spawn|merge] [--delta origin|local] [--json] | new [--in <cwd>|--worktree <name> [--base <ref>]] [--parent <thread>] [--prompt …] | attach <id> | send|history|seen <id> | archive|abandon|merge <id> | merge <id> --continue";

function options(args: string[], schema: ParseArgsOptionsConfig) {
	return parseArgs({ args, allowPositionals: true, strict: true, options: schema });
}
function stringOption(values: Record<string, unknown>, key: string): string | undefined {
	const value = values[key];
	return typeof value === "string" ? value : undefined;
}
// Human-readable summaries stay bounded and on one physical line; JSON retains the source text.
function summary(text: string): string {
	const line = text.replace(/\s+/g, " ").trim();
	return line.length > 160 ? line.slice(0, 159) + "…" : line;
}
export function rowLine(row: ThreadRow): string {
	const t = row.thread;
	const blocked = t.blocked ? ` blocked=${t.blocked.action}:${summary(t.blocked.reason)}` : "";
	const resources = row.workspace ? " processes=" + row.workspace.processes + " rssMB=" + row.workspace.rssMB : "";
	return `${"  ".repeat(row.depth)}${t.id} session=${t.sessionId} ${t.ownership} ${row.state} cwd=${t.cwd}${t.branch ? ` branch=${t.branch}` : ""}${resources}${blocked}`;
}
function out(text: string) { process.stdout.write(text); }

export async function thread(args: string[]): Promise<void> {
	const [command, ...rest] = args;
	try {
		switch (command) {
		case "ls": {
			const { values, positionals } = options(rest, { tree: { type: "string" }, delta: { type: "string" }, json: { type: "boolean" } });
			if (positionals.length || (values.tree !== undefined && values.tree !== "spawn" && values.tree !== "merge")
				|| (values.delta !== undefined && values.delta !== "origin" && values.delta !== "local")) throw new Error(usage);
			const rows = await listThreads({ tree: values.tree as "spawn" | "merge" | undefined, delta: values.delta as "origin" | "local" | undefined });
			if (values.json) out(JSON.stringify(rows) + "\n");
			else for (const row of rows) out(rowLine(row) + "\n");
			return;
		}
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
		case "seen": {
			if (rest.length !== 1) throw new Error(usage);
			await seeThread(rest[0]!);
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
