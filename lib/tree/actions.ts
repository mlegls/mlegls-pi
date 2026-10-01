// Frontends call the registry directly; lifecycle and terminal ownership stay in lib/thread.
import { abandonThread, archiveThread, ensureTerminal, forkThread, newThread, type ThreadRecord, type ThreadRow } from "../thread";
import { command } from "../thread/process";
import { zmx, zmxBinary } from "../thread/zmx";
import * as ghostty from "./ghostty";

export type Action = "new" | "worktree" | "fork" | "merge" | "archive" | "abandon" | "children";

/** Switch only the main pane belonging to this sidebar, never the most recent client. */
export async function open(id: string, shown?: string): Promise<string> {
	const terminal = await ensureTerminal(id);
	if (shown === terminal.name) return terminal.name;
	if (shown) {
		// zmx 0.8.1 shuts the source down on NoLeaderFound. Never send that switch.
		const leader = await zmx(["print-env", shown]);
		if (!leader.trim()) throw new Error("Main client has no zmx leader; type in it or reattach before switching");
		if (process.env.AB_TREE_TOKEN && !leader.split("\n").includes("AB_TREE_TOKEN=" + process.env.AB_TREE_TOKEN))
			throw new Error("Another window leads this thread; type in this main split before switching");
		const env: NodeJS.ProcessEnv = { ...process.env, ZMX_SESSION: shown };
		delete env.ZMX_SESSION_PREFIX;
		await command(await zmxBinary(), ["attach", terminal.name], undefined, env);
	} else ghostty.attachMain(id);
	return terminal.name;
}

export async function create(action: "new" | "worktree" | "fork", selected?: ThreadRecord, name?: string): Promise<ThreadRecord> {
	const options = { cwd: selected?.cwd, parent: selected?.id,
		...(action === "worktree" ? { worktree: name } : { in: selected?.cwd ?? process.cwd() }) };
	if (action === "fork") {
		if (!selected) throw new Error("Select a thread to fork");
		return forkThread(selected.sessionFile, options);
	}
	if (action === "worktree" && !name?.trim()) throw new Error("Supply a worktree branch name");
	return newThread(options);
}

export async function retire(action: "merge" | "archive" | "abandon" | "children", selected: ThreadRecord, rows: ThreadRow[]): Promise<string[]> {
	const ids = action === "children"
		? rows.filter(r => r.treeParent === selected.id).map(r => r.thread.id) : [selected.id];
	const closed: string[] = [];
	for (const id of ids) {
		const result = action === "abandon" || action === "children" ? await abandonThread(id) : await archiveThread(id);
		closed.push(...result.closed);
		if (result.blocked) throw new Error("Blocked at " + result.blocked.threadId + ": " + result.blocked.block.reason);
	}
	return closed;
}
