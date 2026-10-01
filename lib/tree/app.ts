// The native thread app (apps/threads) is a view: it lists with `ab thread ls --json`,
// attaches with `ab thread attach --exclusive`, and performs sidebar actions through `ab tree do`,
// which shares lib/tree/actions.ts with the TUI sidebar.
import { spawn, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { listThreads } from "../thread";
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

const ACTIONS = ["new", "worktree", "fork", "merge", "archive", "abandon", "children", "project"] as const;

export async function perform(args: string[]): Promise<void> {
	const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
		id: { type: "string" }, tree: { type: "string" }, name: { type: "string" } } });
	const kind = positionals[0] as typeof ACTIONS[number];
	if (!ACTIONS.includes(kind)) { console.error("usage: ab tree do " + ACTIONS.join("|") + " [--id ID] [--tree spawn|merge] [--name NAME]"); process.exitCode = 1; return; }
	try { console.log(JSON.stringify(await run(kind, values))); }
	catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
}

async function run(kind: typeof ACTIONS[number], values: { id?: string; tree?: string; name?: string }) {
	const rows = await listThreads({ tree: values.tree === "merge" ? "merge" : "spawn" });
	const row = rows.find(r => r.thread.id === values.id);
	if (values.id && !row) throw new Error("No active thread: " + values.id);
	let result: { thread?: string; closed?: string[] };
	if (kind === "project") result = { thread: (await act.openProject(values.name ?? "")).id };
	else if (kind === "new" || kind === "worktree" || kind === "fork") result = { thread: (await act.create(kind, row?.thread, values.name)).id };
	else {
		if (!row) throw new Error("Select a thread");
		result = { closed: await act.retire(kind, row.thread, rows) };
	}
	return result;
}
