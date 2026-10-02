// The native thread app (apps/threads) is a view: it lists with `ab thread ls --json`,
// attaches with `ab thread attach --exclusive`, and performs sidebar actions through `ab tree do`,
// which shares lib/tree/actions.ts with the TUI sidebar.
import { spawn, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { abandonThread, archiveThread, getThread, integrateThread, seeThread } from "../thread";
import * as act from "./actions";
import { threadEnv } from "./ghostty";

const APP = fileURLToPath(new URL("../../apps/threads", import.meta.url));
const AB = fileURLToPath(new URL("../../bin/ab", import.meta.url));

export async function launchApp(): Promise<void> {
	const build = spawnSync("swift", ["build", "-c", "release", "--package-path", APP], { stdio: ["ignore", "inherit", "inherit"] });
	if (build.status !== 0) throw new Error("swift build failed");
	const bin = APP + "/.build/release/Threads";
	const child = spawn(bin, [], { env: { ...threadEnv(), AB_BIN: AB }, cwd: process.env.HOME, detached: true, stdio: "ignore" });
	child.unref();
}

const ACTIONS = ["new", "fork", "merge", "continue", "abandon", "seen"] as const;
const USAGE = "usage: ab tree do new|fork [--id ID] [--sibling] [--name BRANCH] [--project QUERY] | merge|continue|abandon|seen --id ID";

export async function perform(args: string[]): Promise<void> {
	try {
		const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
			id: { type: "string" }, name: { type: "string" }, project: { type: "string" }, sibling: { type: "boolean" } } });
		const kind = positionals[0] as typeof ACTIONS[number];
		if (!ACTIONS.includes(kind)) throw new Error(USAGE);
		console.log(JSON.stringify(await run(kind, values)));
	} catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
}

async function run(kind: typeof ACTIONS[number], values: { id?: string; name?: string; project?: string; sibling?: boolean }) {
	const thread = values.id ? await getThread(values.id) : undefined;
	if (values.id && (!thread || thread.archived)) throw new Error("No active thread: " + values.id);
	if (kind === "new" || kind === "fork") return { thread: (await act.spawn(kind, thread, values)).id };
	if (!thread) throw new Error("Select a thread");
	if (kind === "seen") { await seeThread(thread.id); return {}; }
	if (kind === "continue") { await integrateThread(thread.id); return {}; }
	const result = kind === "abandon" ? await abandonThread(thread.id) : await archiveThread(thread.id);
	if (result.blocked) throw new Error("Blocked at " + result.blocked.threadId + ": " + result.blocked.block.reason);
	return { closed: result.closed };
}
