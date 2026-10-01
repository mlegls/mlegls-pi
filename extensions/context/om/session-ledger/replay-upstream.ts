// @ts-nocheck: a loose script over arbitrary session JSON
// Acceptance replay: upstream pi-observational-memory vs this port over real session files.
// Each file is migrated (./migrate.ts) into a scratch records store; then the port reads the
// original branch, where ledgerBranch hides the migrated entries and splices in their records,
// and every compaction's render and details (through the compaction renderer), coverage, token
// clocks, fold and recall for every memory id must match upstream's reading of the original.
// Needs upstream installed (its npm dir) for the comparison.
//   bun extensions/context/om/session-ledger/replay-upstream.ts <session.jsonl>...
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "om-accept-"));
const up = await import(process.env.HOME + "/.pi/agent/npm/node_modules/pi-observational-memory/src/session-ledger/index.ts");
const port = await import("./index.ts");
const { ledgerBranch } = await import("./store.ts");
const { migrateFile } = await import("./migrate.ts");
const { omRenderer } = await import("../hooks/compaction-hook.ts");
const { render } = await import("../../../../lib/records/render.ts");
let totals = { files: 0, compactions: 0, recalls: 0, diffs: 0, entries: 0, rerun: 0 };
for (const file of process.argv.slice(2)) {
	const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
	const header = lines[0];
	const entries = lines.slice(1);
	const byId = new Map(entries.map((e) => [e.id, e]));
	const branch = [];
	for (let e = entries.at(-1); e; e = byId.get(e.parentId)) branch.unshift(e);
	totals.entries += migrateFile(file);
	totals.rerun += migrateFile(file); // idempotent: must stay 0
	const sm = { getSessionId: () => header.id, getLeafId: () => null, getBranch: () => [], getHeader: () => ({}) };
	const diff = (what, a, b) => { const x = String(JSON.stringify(a)), y = String(JSON.stringify(b)); if (x !== y) { totals.diffs++; let k = 0; while (x[k] === y[k]) k++; console.log("DIFF", file.slice(-50), what, x.length, y.length, "@", k, x.slice(k - 150, k + 150), "|||", y.slice(k - 150, k + 150)); } };
	branch.forEach((e, i) => {
		if (e.type !== "compaction" || !e.firstKeptEntryId) return;
		totals.compactions++;
		const u = branch.slice(0, i);
		const cfg = { observationsPoolMaxTokens: 20000 };
		const pu = up.buildCompactionProjection(u, e.firstKeptEntryId, cfg);
		const section = render(omRenderer, { session: sm, branch: u, firstKeptEntryId: e.firstKeptEntryId }, cfg.observationsPoolMaxTokens);
		const upText = up.renderSummary(pu.reflections, pu.observations);
		diff("render@" + e.id, upText, section?.text ?? "");
		if (upText) diff("details@" + e.id, pu.details, section?.details);
		if (e.details?.type === "om.folded") diff("stored-details@" + e.id, e.details, section?.details);
	});
	const pb = ledgerBranch(sm, branch);
	for (const t of ["om.observations.recorded", "om.reflections.recorded", "om.observations.dropped"]) diff("coverage " + t, up.latestCoverageMarkerId(branch, t), port.latestCoverageMarkerId(pb, t));
	diff("rawTokensSinceObs", up.rawTokensSinceObservationCoverage(branch), port.rawTokensSinceObservationCoverage(pb));
	diff("rawSinceCompaction", up.rawTokensSinceLastCompaction(branch), port.rawTokensSinceLastCompaction(pb));
	diff("realSinceAnchor", up.realTokensSinceAnchor(branch, "om.observations.recorded", 150000), port.realTokensSinceAnchor(pb, "om.observations.recorded", 150000));
	const fu = up.foldLedger(branch), fp = port.foldLedger(pb);
	diff("fold", [fu.activeObservations, fu.reflections, [...fu.droppedObservationIds]], [fp.activeObservations, fp.reflections, [...fp.droppedObservationIds]]);
	for (const id of [...fu.observationsById.keys(), ...fu.reflectionsById.keys()]) {
		totals.recalls++;
		const ru = up.recallMemorySources(branch, id), rp = port.recallMemorySources(pb, id);
		const norm = (r) => [r.status, r.kind, r.observations.map((o) => [o.observation, o.status]), r.reflections.map((x) => x.reflection), r.sourceEntries.map((s) => s.id), r.missingSourceEntryIds, r.collision, r.partial];
		diff("recall " + id, norm(ru), norm(rp));
	}
	totals.files++;
}
console.log(JSON.stringify(totals));
