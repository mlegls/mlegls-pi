
// @ts-nocheck: a loose script over arbitrary session JSON
// Acceptance replay: upstream pi-observational-memory vs this port over real session files.
// Each file's OM custom entries are written to a scratch records store (anchored where pi had
// appended them) and stripped from the branch; then every compaction's projection, render and
// details, coverage, token clocks, fold and recall for every memory id must match upstream's
// reading of the original entries. Needs upstream installed (its npm dir) for the comparison.
//   bun extensions/context/om/session-ledger/replay-upstream.ts <session.jsonl>...
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "om-accept-"));
const up = await import(process.env.HOME + "/.pi/agent/npm/node_modules/pi-observational-memory/src/session-ledger/index.ts");
const port = await import("./index.ts");
const { recordLedger, ledgerBranch } = await import("./store.ts");
const { omRenderer } = await import("../hooks/compaction-hook.ts");
const { render } = await import("../../../../lib/records/render.ts");
const OM = new Set(["om.observations.recorded", "om.reflections.recorded", "om.observations.dropped"]);
const isOm = (e) => e.type === "custom" && OM.has(e.customType);
let totals = { files: 0, compactions: 0, recalls: 0, diffs: 0, records: 0 };
for (const file of process.argv.slice(2)) {
	const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
	const header = lines[0];
	const entries = lines.slice(1);
	const byId = new Map(entries.map((e) => [e.id, e]));
	const branch = [];
	for (let e = entries.at(-1); e; e = byId.get(e.parentId)) branch.unshift(e);
	const anchorOf = (e) => { let p = byId.get(e.parentId); while (p && isOm(p) && !cuts.has(p.id)) p = byId.get(p.parentId); return p?.id; };
	// pi sometimes cut at an OM custom entry. Without them in the session it would cut at a real entry in
	// the same place, so keep those as inert placeholders rather than move the cut.
	const cuts = new Set(branch.filter((e) => e.type === "compaction").map((e) => e.firstKeptEntryId));
	const stripped = branch.filter((e) => !isOm(e) || cuts.has(e.id)).map((e) => isOm(e) ? { type: "custom", customType: "cut", id: e.id, parentId: e.parentId } : e);
	const sm = { getSessionId: () => header.id, getLeafId: () => leaf, getBranch: () => [], getHeader: () => ({}) };
	let leaf = null;
	for (const e of branch) {
		if (!isOm(e)) continue;
		const valid = up.isObservationsRecordedEntry(e) || up.isReflectionsRecordedEntry(e) || up.isObservationsDroppedEntry(e);
		if (!valid) continue;
		leaf = anchorOf(e);
		recordLedger(sm, e.customType, e.data);
		totals.records++;
	}
	const diff = (what, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) { totals.diffs++; let k = 0; while (x[k] === y[k]) k++; console.log("DIFF", file.slice(-50), what, x.length, y.length, "@", k, x.slice(k - 150, k + 150), "|||", y.slice(k - 150, k + 150)); } };
	const sIdx = new Map(stripped.map((e, i) => [e.id, i]));
	const portPrefix = (upPrefix) => { const last = [...upPrefix].reverse().find((e) => sIdx.has(e.id)); return stripped.slice(0, sIdx.get(last.id) + 1); };
	// each compaction, as the hook saw it, plus the tip against the last firstKept
	branch.forEach((e, i) => {
		if (e.type !== "compaction" || !e.firstKeptEntryId) return;
		totals.compactions++;
		const u = branch.slice(0, i), p = portPrefix(u);
		const cfg = { observationsPoolMaxTokens: 20000 };
		// pi can cut at an OM custom entry; without them in the session the same cut is the real entry before it
		if (isOm(byId.get(e.firstKeptEntryId) ?? {})) totals.omCuts = (totals.omCuts ?? 0) + 1;
		// the port through its compaction renderer, as extensions/context/compaction.ts runs it
		const pu = up.buildCompactionProjection(u, e.firstKeptEntryId, cfg);
		const section = render(omRenderer, { session: sm, branch: p, firstKeptEntryId: e.firstKeptEntryId }, cfg.observationsPoolMaxTokens);
		const upText = up.renderSummary(pu.reflections, pu.observations);
		diff("render@" + e.id, upText, section?.text ?? "");
		if (upText) diff("details@" + e.id, pu.details, section?.details);
		if (e.details?.type === "om.folded") diff("stored-details@" + e.id, e.details, section?.details);
	});
	const pb = ledgerBranch(sm, stripped);
	for (const t of OM) diff("coverage " + t, up.latestCoverageMarkerId(branch, t), port.latestCoverageMarkerId(pb, t));
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
