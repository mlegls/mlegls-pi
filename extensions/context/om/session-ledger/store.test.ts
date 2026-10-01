import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { foldLedger } from "./fold.js";
import { migrateFile } from "./migrate.ts";
import { ledgerBranch, recordLedger, type LedgerSession } from "./store.js";
import type { Entry, Observation } from "./types.js";

const dir = mkdtempSync(join(tmpdir(), "om-store-"));
const saved = process.env.PI_BOARD_DIR;
beforeAll(() => { process.env.PI_BOARD_DIR = dir; });
afterAll(() => { process.env.PI_BOARD_DIR = saved; rmSync(dir, { recursive: true, force: true }); });

const msg = (id: string): Entry => ({ type: "message", id, message: { role: "user", content: id } });
const obs = (id: string, src: string[]): Observation => ({ id, content: `c-${id}`, timestamp: "2026-10-01 12:00", relevance: "high", sourceEntryIds: src, tokenCount: 3 });
function session(id: string, branch: Entry[], parentSession?: string): LedgerSession & { leaf: string } {
	return { leaf: "", getSessionId: () => id, getLeafId() { return this.leaf; }, getBranch: () => branch, getHeader: () => ({ parentSession }) };
}

test("records splice in after the leaf they were written at, and only on that branch", () => {
	const main = [msg("a1"), msg("a2"), msg("a3")];
	const s = session("s1", main);
	s.leaf = "a2";
	recordLedger(s, "om.observations.recorded", { observations: [obs("aaaaaaaaaaa1", ["a1"]), obs("aaaaaaaaaaa2", ["a1", "a2"])], coversUpToId: "a2" });
	recordLedger(s, "om.reflections.recorded", { reflections: [{ id: "bbbbbbbbbbb1", content: "r", supportingObservationIds: ["aaaaaaaaaaa1"], tokenCount: 1 }], coversUpToId: "a2" });
	s.leaf = "a3";
	recordLedger(s, "om.observations.dropped", { observationIds: ["aaaaaaaaaaa1"], coversUpToId: "a2" });

	const spliced = ledgerBranch(s);
	expect(spliced.map((e) => e.customType ?? e.id)).toEqual(["a1", "a2", "om.observations.recorded", "om.observations.recorded", "om.reflections.recorded", "a3", "om.observations.dropped"]);
	const fold = foldLedger(spliced);
	expect(fold.activeObservations.map((o) => o.id)).toEqual(["aaaaaaaaaaa2"]);
	expect(fold.observationsById.get("aaaaaaaaaaa2")).toEqual(obs("aaaaaaaaaaa2", ["a1", "a2"]));
	expect(fold.reflections[0]!.supportingObservationIds).toEqual(["aaaaaaaaaaa1"]);

	// a sibling branch off a1 sees none of it
	expect(ledgerBranch(s, [msg("a1"), msg("x2")]).length).toBe(2);
});

test("a fork sees its parent session's records up to the fork point", () => {
	const parentFile = join(dir, "parent.jsonl");
	writeFileSync(parentFile, JSON.stringify({ type: "session", id: "s1" }) + "\n");
	const fork = session("s2", [msg("a1"), msg("a2"), msg("f3")], parentFile);
	expect(foldLedger(ledgerBranch(fork)).observations.map((o) => o.id)).toEqual(["aaaaaaaaaaa1", "aaaaaaaaaaa2"]);
	expect(foldLedger(ledgerBranch(fork)).droppedObservationIds.size).toBe(0); // the drop was written at a3
});

test("migrated file entries become placeholders, migration is idempotent, and a fork's copies don't double", () => {
	const om = (id: string, parentId: string, obsId: string) => ({ type: "custom", customType: "om.observations.recorded", id, parentId,
		timestamp: "2026-10-01T00:00:00.000Z", data: { observations: [obs(obsId, ["m1"])], coversUpToId: "m1" } });
	const parentEntries = [{ type: "message", id: "m1", parentId: null, message: { role: "user", content: "x" } }, om("o1", "m1", "ccccccccccc1")];
	const parentFile = join(dir, "p.jsonl");
	writeFileSync(parentFile, [{ type: "session", id: "mig-p" }, ...parentEntries].map((l) => JSON.stringify(l)).join("\n") + "\n");
	// a fork copies the parent's entries into its own file
	const forkEntries = [...parentEntries, { type: "message", id: "m2", parentId: "o1", message: { role: "user", content: "y" } }];
	const forkFile = join(dir, "f.jsonl");
	writeFileSync(forkFile, [{ type: "session", id: "mig-f", parentSession: parentFile }, ...forkEntries].map((l) => JSON.stringify(l)).join("\n") + "\n");
	expect(migrateFile(parentFile)).toBe(1);
	expect(migrateFile(forkFile)).toBe(1);
	expect(migrateFile(forkFile)).toBe(0);
	const fork = session("mig-f", forkEntries as Entry[], parentFile);
	const spliced = ledgerBranch(fork);
	expect(spliced.map((e) => e.customType ?? e.id)).toEqual(["m1", "om.observations.recorded", "om.migrated", "m2"]);
	expect(foldLedger(spliced).activeObservations.map((o) => o.id)).toEqual(["ccccccccccc1"]);
});
