// The sidebar uses exactly the thread CLI's two trees, not inferred worktree ancestry.
import { basename } from "node:path";
import { listThreads, type ThreadRow } from "../thread";

export type TreeMode = "spawn" | "merge";
export const label = (row: ThreadRow) => (row.thread.worker?.handle ?? row.thread.branch ?? basename(row.thread.cwd))
	+ (row.thread.ownership === "guest" ? " ·" + row.thread.id.slice(0, 6) : "");

export async function workspaces(mode: TreeMode): Promise<ThreadRow[]> {
	return listThreads({ tree: mode });
}

/** Keep query ancestors and respect folds without changing the registry's ordering. */
export function visibleRows(rows: ThreadRow[], query: string, collapsed: Set<string>): ThreadRow[] {
	const byId = new Map(rows.map(r => [r.thread.id, r]));
	const shown = new Set(rows.filter(r => [label(r), r.thread.id, r.thread.cwd, r.thread.project, r.report?.tag, r.thread.blocked?.reason]
		.join(" ").toLowerCase().includes(query.toLowerCase())).map(r => r.thread.id));
	for (const id of [...shown]) {
		let parent = byId.get(id)?.treeParent;
		const seen = new Set<string>();
		while (parent && !seen.has(parent)) { seen.add(parent); shown.add(parent); parent = byId.get(parent)?.treeParent; }
	}
	return rows.filter(r => {
		if (!shown.has(r.thread.id)) return false;
		let parent = r.treeParent;
		const seen = new Set<string>();
		while (parent && !seen.has(parent)) {
			if (collapsed.has(parent)) return false;
			seen.add(parent); parent = byId.get(parent)?.treeParent;
		}
		return true;
	});
}
