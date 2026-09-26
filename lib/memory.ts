// Original session evidence. Rendering/filtering belongs to show() or the bash ingress,
// not this reader: skims must retain an exact recovery path.
import { readFileSync } from "node:fs";
import { convertToLlm, sessionEntryToContextMessages, type SessionEntry } from "@earendil-works/pi-coding-agent";

export interface RecallOptions {
	ids: string[];
	offset?: number;
	limit?: number;
	/** Offline reads require both coordinates; never guess the latest session/branch. */
	sessionFile?: string;
	leafId?: string;
}

export function recall(options: RecallOptions): string {
	if (!Array.isArray(options.ids) || !options.ids.length || options.ids.length > 8 || options.ids.some(id => typeof id !== "string" || !id))
		throw new Error("recall requires 1–8 original-entry IDs");
	const offset = options.offset ?? 0, limit = options.limit ?? 12000;
	if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 20000)
		throw new Error("offset must be nonnegative; limit must be 1–20000 characters");
	const current = (globalThis as any)[Symbol.for("pi.exec.session")]?.();
	const sessionFile = options.sessionFile ?? current?.sessionFile ?? process.env.PI_SESSION_FILE;
	const leafId = options.leafId ?? (options.sessionFile ? undefined : current ? current.leafId : process.env.PI_SESSION_LEAF);
	if (!sessionFile || !leafId) throw new Error("Recall needs the calling session file and branch leaf. Reload Pi, or supply sessionFile and leafId explicitly.");
	const entries = new Map<string, SessionEntry>();
	for (const line of readFileSync(sessionFile, "utf8").split("\n")) {
		if (!line.trim()) continue;
		const entry = JSON.parse(line);
		if (entry.type !== "session" && typeof entry.id === "string") entries.set(entry.id, entry);
	}
	const branch = new Map<string, SessionEntry>();
	for (let id: string | null = leafId; id !== null;) {
		const entry = entries.get(id);
		if (!entry || branch.has(id)) throw new Error(`Invalid or unpersisted session ancestry at ${id}`);
		branch.set(id, entry);
		id = entry.parentId ?? null;
	}
	const records = options.ids.map(id => {
		const entry = branch.get(id);
		if (!entry || entry.type === "compaction" || entry.type === "branch_summary") return { id, error: "Original entry not found on this branch" };
		const messages = convertToLlm(sessionEntryToContextMessages(entry)).map(m => ({ role: m.role,
			content: typeof m.content === "string" ? m.content : m.content.filter(b => b.type !== "thinking").map(b => b.type === "image" ? { type: "image", omitted: true } : b) }));
		return messages.length ? { id, timestamp: entry.timestamp, messages } : { id, error: "Original entry not found on this branch" };
	});
	const body = JSON.stringify(records, null, 2);
	return body.slice(offset, offset + limit) + (offset + limit < body.length
		? `\n[More: memory.recall with the same IDs and offset=${offset + limit}, or ab memory recall IDS --offset ${offset + limit}; ${body.length} total characters]` : "");
}
