import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { threadForSession } from "./registry";
import { archiveThread, abandonThread } from "./lifecycle";
import { attachThread, forkThread, historyThread, listThreads, newThread, promoteThread, sendThread } from "./runtime";
import type { ThreadRow } from "./types";

const usage = "usage: ab thread ls [--tree spawn|merge] [--json] | new [--in <cwd>|--worktree <name> [--base <ref>]] [--parent <thread>] [--prompt …] [--cmd …] | fork [--worktree <name>|--in <cwd>] | promote [<session>] | attach <id> [--role agent|…] [--exclusive] | send|history <id> | archive|abandon|merge <id>";

function options(args: string[], schema: ParseArgsOptionsConfig) {
	return parseArgs({ args, allowPositionals: true, strict: true, options: schema });
}
function stringOption(values: Record<string, unknown>, key: string): string | undefined {
	const value = values[key];
	return typeof value === "string" ? value : undefined;
}
function rowLine(row: ThreadRow): string {
	const t = row.thread;
	const blocked = t.blocked ? ` blocked=${t.blocked.action}:${t.blocked.reason}` : "";
	const report = row.report ? ` report=${row.report.tag}:${row.report.body.replace(/\s+/g, " ")}` : "";
	return `${"  ".repeat(row.depth)}${t.id} session=${t.sessionId} ${t.ownership} ${row.state} cwd=${t.cwd}${t.branch ? ` branch=${t.branch}` : ""}${report}${blocked}`;
}
function out(text: string) { process.stdout.write(text); }

export async function thread(args: string[]): Promise<void> {
	const [command, ...rest] = args;
	try {
		switch (command) {
		case "ls": {
			const { values, positionals } = options(rest, { tree: { type: "string" }, json: { type: "boolean" } });
			if (positionals.length || (values.tree !== undefined && values.tree !== "spawn" && values.tree !== "merge")) throw new Error(usage);
			const rows = await listThreads({ tree: values.tree as "spawn" | "merge" | undefined });
			if (values.json) out(JSON.stringify(rows) + "\n");
			else for (const row of rows) out(rowLine(row) + "\n");
			return;
		}
		case "new": {
			const { values, positionals } = options(rest, { in: { type: "string" }, worktree: { type: "string" }, base: { type: "string" }, parent: { type: "string" }, prompt: { type: "string" }, cmd: { type: "string" } });
			if (positionals.length) throw new Error(usage);
			const prompt = stringOption(values, "prompt"), cmd = stringOption(values, "cmd");
			const launch = prompt !== undefined || cmd !== undefined ? { prompt, cmd } : undefined;
			const record = await newThread({ in: stringOption(values, "in"), worktree: stringOption(values, "worktree"), base: stringOption(values, "base"), parent: stringOption(values, "parent"), launch });
			out(JSON.stringify(record) + "\n");
			return;
		}
		case "fork": {
			const { values, positionals } = options(rest, { in: { type: "string" }, worktree: { type: "string" } });
			if (positionals.length || (values.in !== undefined && values.worktree !== undefined)) throw new Error(usage);
			const source = process.env.PI_SESSION_FILE || process.env.PI_SESSION_ID;
			if (!source) throw new Error("fork requires PI_SESSION_FILE or PI_SESSION_ID");
			const current = await threadForSession(source); // the source session's thread is the spawning parent, whichever of file/id named it
			const record = await forkThread(source, { in: stringOption(values, "in"), worktree: stringOption(values, "worktree"), parentSession: current?.sessionId });
			out(JSON.stringify(record) + "\n");
			return;
		}
		case "promote": {
			const { positionals } = options(rest, {});
			if (positionals.length > 1) throw new Error(usage);
			const session = positionals[0] ?? process.env.PI_SESSION_FILE ?? process.env.PI_SESSION_ID;
			if (!session) throw new Error("promote requires a session or PI_SESSION_FILE/PI_SESSION_ID");
			if (process.env.PI_SESSION_FILE && !positionals[0]) {
				const member = await threadForSession(process.env.PI_SESSION_FILE);
				if (member) { out(JSON.stringify(member) + "\n"); return; }
			}
			const record = await promoteThread(session);
			out(JSON.stringify(record) + "\n");
			return;
		}
		case "attach": {
			const [id, ...tail] = rest;
			if (!id) throw new Error(usage);
			const parsed = options(tail, { role: { type: "string" }, exclusive: { type: "boolean" } });
			if (parsed.positionals.length) throw new Error(usage);
			await attachThread(id, stringOption(parsed.values, "role"), { exclusive: parsed.values.exclusive === true });
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
