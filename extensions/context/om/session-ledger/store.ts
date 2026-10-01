// The OM ledger as records of schema `om` in the shared records store (lib/records/store.ts),
// instead of custom entries in the session file. Everything upstream reads the ledger as a
// branch of entries, so `ledgerBranch` splices the records back in as virtual custom entries:
// each right after the entry that was the session's leaf when it was written (its `at` edge),
// which is where pi.appendEntry would have put it. So a record is visible exactly when that
// entry is an ancestor of the tip, and forks inherit their parent session's records.
//
// One record per observation, reflection or drop batch:
//   observation  body content; tags session, om.kind, om.id, om.timestamp, om.relevance,
//                om.tokenCount, om.coversUpToId; edges cites → entry:<session>/<id>, at → entry:<session>/<leaf>
//   reflection   body content; tags om.kind, om.id, om.tokenCount, om.coversUpToId; edges reflects → om:<id>
//   drop         tags om.kind, om.coversUpToId; edges drops → om:<id>
// Memory ids are content hashes, so `om:<id>` is a logical ref, not a record id.
// Custom entries already in a session file (OM before this port) pass through and still fold.

import { anchor, chainRecords, entryOf, entryRef, splice, type Anchored, type BranchSession } from "../../../../lib/records/branch.ts";
import { db, fieldsOf, write } from "../../../../lib/records/store.ts";
import {
	OM_OBSERVATIONS_DROPPED,
	OM_OBSERVATIONS_RECORDED,
	OM_REFLECTIONS_RECORDED,
	type Entry,
	type ObservationsDroppedEntryData,
	type ObservationsRecordedEntryData,
	type ReflectionsRecordedEntryData,
	type V3MemoryCustomType,
} from "./types.js";

export const SCHEMA = "om";

export type LedgerSession = BranchSession;

type LedgerData = ObservationsRecordedEntryData | ReflectionsRecordedEntryData | ObservationsDroppedEntryData;

const memoryOf = (ref: string) => ref.slice("om:".length);

/** Record one ledger write (what OM appended as a custom entry), anchored at the current leaf. */
export function recordLedger(sm: LedgerSession, customType: V3MemoryCustomType, data: LedgerData): void {
	const session = sm.getSessionId();
	if (!sm.getLeafId()) return;
	const a = anchor(sm);
	const base = (kind: string) => [
		...a.tags,
		{ key: "om.kind", value: kind },
		{ key: "om.coversUpToId", value: data.coversUpToId },
	];
	const at = a.edges[0]!;
	const d = db();
	d.transaction(() => {
		if (customType === OM_OBSERVATIONS_RECORDED) {
			for (const o of (data as ObservationsRecordedEntryData).observations) write({
				schema: SCHEMA,
				body: o.content,
				tags: [...base("observation"), { key: "om.id", value: o.id }, { key: "om.timestamp", value: o.timestamp },
					{ key: "om.relevance", value: o.relevance }, { key: "om.tokenCount", value: o.tokenCount }],
				edges: [at, ...o.sourceEntryIds.map((e) => ({ rel: "cites", dst: entryRef(session, e) }))],
			}, d);
		} else if (customType === OM_REFLECTIONS_RECORDED) {
			for (const r of (data as ReflectionsRecordedEntryData).reflections) write({
				schema: SCHEMA,
				body: r.content,
				tags: [...base("reflection"), { key: "om.id", value: r.id }, { key: "om.tokenCount", value: r.tokenCount }],
				edges: [at, ...r.supportingObservationIds.map((id) => ({ rel: "reflects", dst: `om:${id}` }))],
			}, d);
		} else {
			write({
				schema: SCHEMA,
				tags: base("drop"),
				edges: [at, ...(data as ObservationsDroppedEntryData).observationIds.map((id) => ({ rel: "drops", dst: `om:${id}` }))],
			}, d);
		}
	})();
}

function toEntry({ record: rec, edges }: Anchored): Entry | undefined {
	const f = fieldsOf("om", rec.tags) as Record<string, any>;
	const rel = (r: string) => edges.filter((e) => e.rel === r).map((e) => e.dst);
	const entry = (customType: string, data: unknown): Entry => ({ type: "custom", id: `om:${rec.id}`, timestamp: rec.ts, customType, data });
	if (f.kind === "observation") return entry(OM_OBSERVATIONS_RECORDED, {
		observations: [{ id: f.id, content: rec.body, timestamp: f.timestamp, relevance: f.relevance, sourceEntryIds: rel("cites").map(entryOf), tokenCount: f.tokenCount }],
		coversUpToId: f.coversUpToId,
	});
	if (f.kind === "reflection") return entry(OM_REFLECTIONS_RECORDED, {
		reflections: [{ id: f.id, content: rec.body, supportingObservationIds: rel("reflects").map(memoryOf), tokenCount: f.tokenCount }],
		coversUpToId: f.coversUpToId,
	});
	if (f.kind === "drop") return entry(OM_OBSERVATIONS_DROPPED, { observationIds: rel("drops").map(memoryOf), coversUpToId: f.coversUpToId });
	return undefined;
}

/** The branch with this session chain's om records spliced in after their anchors. */
export function ledgerBranch(sm: LedgerSession, branch: Entry[] = sm.getBranch() as Entry[]): Entry[] {
	return splice(branch, chainRecords(sm, SCHEMA), toEntry);
}
