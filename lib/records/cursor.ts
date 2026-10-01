// Cursors as records (schema `cursor`): a consumer's position, written as a new row each time it
// moves, latest visible row per key wins (Kafka's log-compacted __consumer_offsets). Rows are
// anchored like any record (lib/records/branch), so navigating the tree or forking a session
// resumes the cursor as of that point. Write on delivery or ack, not per poll.

import { anchor, chainRecords, visible, type BranchSession } from "./branch.ts";
import { write } from "./store.ts";

export const SCHEMA = "cursor";

/** The latest value of cursor `key` visible from this session's branch, or undefined. */
export function readCursor<T>(sm: BranchSession, key: string, branch?: { id: string }[]): T | undefined {
	const rows = visible(sm, chainRecords(sm, SCHEMA, {
		where: "r.seq IN (SELECT record FROM tags WHERE key = 'cursor.key' AND value = ?)",
		params: [key],
	}), branch);
	const last = rows.at(-1);
	return last ? JSON.parse(last.record.body) as T : undefined;
}

export function writeCursor(sm: BranchSession, key: string, value: unknown): void {
	const a = anchor(sm);
	write({ schema: SCHEMA, body: JSON.stringify(value), tags: [...a.tags, { key: "cursor.key", value: key }], edges: a.edges });
}
