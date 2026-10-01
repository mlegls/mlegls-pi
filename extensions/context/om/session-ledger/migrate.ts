// One-time (and re-runnable) migration of OM's session-file ledger into the records store.
// Each valid OM custom entry becomes records via recordLedger, anchored at the nearest
// non-OM ancestor (where the port would have anchored it) and tagged `om.entry` with its id,
// so ledgerBranch hides the file entry. Entries already migrated for that session are skipped,
// so sessions still running upstream OM can be caught up by running it again.
//   bun extensions/context/om/session-ledger/migrate.ts [session.jsonl...]   (default: every session file)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { db } from "../../../../lib/records/store.ts";
import { recordLedger, SCHEMA } from "./store.ts";
import {
	isObservationsDroppedEntry,
	isObservationsRecordedEntry,
	isReflectionsRecordedEntry,
	type Entry,
	type V3MemoryCustomType,
} from "./types.js";

const OM = new Set(["om.observations.recorded", "om.reflections.recorded", "om.observations.dropped"]);
const isOm = (e: Entry) => e.type === "custom" && OM.has(e.customType as string);

type Line = Entry & { parentId?: string | null; timestamp?: string };

/** Migrate one session file; returns how many entries were written. */
export function migrateFile(file: string): number {
	const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => {
		try { return [JSON.parse(l)]; } catch { return []; }
	});
	const header = lines[0];
	if (header?.type !== "session" || !header.id) return 0;
	const entries = lines.slice(1) as Line[];
	if (!entries.some(isOm)) return 0;
	const byId = new Map(entries.map((e) => [e.id, e]));
	// A compaction may have cut at an OM entry; ledgerBranch keeps that one as a placeholder, so it can anchor.
	const cuts = new Set(entries.flatMap((e) => (e.type === "compaction" && e.firstKeptEntryId ? [e.firstKeptEntryId] : [])));
	const done = new Set((db().query(
		"SELECT e.value AS v FROM tags e JOIN tags s ON s.record = e.record AND s.key = 'session' AND s.value = ? JOIN records r ON r.seq = e.record AND r.schema = ? WHERE e.key = 'om.entry'",
	).all(header.id, SCHEMA) as { v: string }[]).map((r) => r.v));
	let leaf: string | null = null;
	const sm = { getSessionId: () => header.id as string, getLeafId: () => leaf, getBranch: () => [] };
	let n = 0;
	for (const e of entries) {
		if (!isOm(e) || done.has(e.id)) continue;
		if (!isObservationsRecordedEntry(e) && !isReflectionsRecordedEntry(e) && !isObservationsDroppedEntry(e)) continue;
		let p = (e as Line).parentId ? byId.get((e as Line).parentId!) : undefined;
		while (p && isOm(p) && !cuts.has(p.id)) p = p.parentId ? byId.get(p.parentId) : undefined;
		if (!p) continue;
		leaf = p.id;
		recordLedger(sm, e.customType as V3MemoryCustomType, e.data as never, { id: e.id, timestamp: e.timestamp });
		n++;
	}
	return n;
}

function sessionFiles(dir = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "sessions")): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...sessionFiles(path));
		else if (name.endsWith(".jsonl")) out.push(path);
	}
	return out;
}

if (import.meta.main) {
	const files = process.argv.length > 2 ? process.argv.slice(2) : sessionFiles();
	let entries = 0, sessions = 0;
	for (const f of files) {
		const n = migrateFile(f);
		if (n) { entries += n; sessions++; }
	}
	console.log(JSON.stringify({ files: files.length, sessions, entries }));
}
