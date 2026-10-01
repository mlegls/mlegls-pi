// Branch visibility over the records store. A record written from a session carries an `at`
// edge to that session's leaf entry at write time; from a branch tip it is visible exactly when
// that entry is an ancestor of the tip, and a fork (header `parentSession`) sees its ancestors'
// records up to the fork point, since the fork's branch holds the parent's entries. So "visible"
// is `at ∈ ancestors(tip)` with the ancestor set as a query parameter, never stored.

import { readFileSync } from "node:fs";
import { edgesOf, select, type Edge, type StoredRecord, type Tag } from "./store.ts";

/** The parts of pi's SessionManager this needs. */
export interface BranchSession {
	getSessionId(): string;
	getLeafId(): string | null;
	getBranch(): unknown[];
	getHeader?(): { parentSession?: string } | null;
}

const chains = new Map<string, string[]>();

function headerOf(path: string): { id?: string; parentSession?: string } | undefined {
	try {
		const first = readFileSync(path, "utf8").split("\n", 1)[0];
		return first ? JSON.parse(first) : undefined;
	} catch {
		return undefined;
	}
}

/** This session's id and its fork ancestors', nearest first. */
export function sessionChain(sm: BranchSession): string[] {
	const id = sm.getSessionId();
	const hit = chains.get(id);
	if (hit) return hit;
	const chain = [id];
	let parent = sm.getHeader?.()?.parentSession;
	while (parent && chain.length < 64) {
		const h = headerOf(parent);
		if (!h?.id || chain.includes(h.id)) break;
		chain.push(h.id);
		parent = h.parentSession;
	}
	chains.set(id, chain);
	return chain;
}

export const entryRef = (session: string, entry: string) => `entry:${session}/${entry}`;
export const entryOf = (ref: string) => ref.slice(ref.indexOf("/") + 1);

/** Tag and edge for a record written from this session now: `session` and `at` → its leaf (none before the first entry). */
export function anchor(sm: BranchSession): { tags: Tag[]; edges: Edge[] } {
	const session = sm.getSessionId();
	const leaf = sm.getLeafId();
	return { tags: [{ key: "session", value: session }], edges: leaf ? [{ rel: "at", dst: entryRef(session, leaf) }] : [] };
}

export interface Anchored {
	record: StoredRecord;
	edges: { rel: string; dst: string }[];
	/** The entry id it was written at; undefined when written before the session had entries. */
	at?: string;
}

/** Records of `schema` written from this session's chain (extra SQL narrowing optional), with their edges, in seq order. */
export function chainRecords(sm: BranchSession, schema: string, options: { where?: string; params?: (string | number)[] } = {}): Anchored[] {
	const chain = sessionChain(sm);
	const where = `r.seq IN (SELECT record FROM tags WHERE key = 'session' AND value IN (${chain.map(() => "?").join(",")}))`;
	const records = select(schema, {
		where: options.where ? `${where} AND (${options.where})` : where,
		params: [...chain, ...(options.params ?? [])],
	});
	const edges = new Map<number, { rel: string; dst: string }[]>();
	for (const e of edgesOf(records.map((r) => r.seq))) {
		const list = edges.get(e.record) ?? [];
		list.push({ rel: e.rel, dst: e.dst });
		edges.set(e.record, list);
	}
	return records.map((record) => {
		const es = edges.get(record.seq) ?? [];
		const at = es.find((e) => e.rel === "at");
		return { record, edges: es, at: at && entryOf(at.dst) };
	});
}

/** Those of `records` visible from the branch (default: the session's current branch). */
export function visible(sm: BranchSession, records: Anchored[], branch: { id: string }[] = sm.getBranch() as { id: string }[]): Anchored[] {
	const ids = new Set(branch.map((e) => e.id));
	return records.filter((r) => r.at === undefined || ids.has(r.at));
}

/** The branch with each record (mapped by `toEntry`) spliced in right after the entry it was written at. */
export function splice<E extends { id: string }>(branch: E[], records: Anchored[], toEntry: (r: Anchored) => E | undefined): E[] {
	const before: E[] = [];
	const after = new Map<string, E[]>();
	for (const r of records) {
		const entry = toEntry(r);
		if (!entry) continue;
		if (r.at === undefined) { before.push(entry); continue; }
		const list = after.get(r.at) ?? [];
		list.push(entry);
		after.set(r.at, list);
	}
	if (!before.length && !after.size) return branch;
	const out: E[] = [...before];
	for (const e of branch) {
		out.push(e);
		const spliced = after.get(e.id);
		if (spliced) out.push(...spliced);
	}
	return out;
}
