// Select durable API/protocol evidence from owned areas, never raw runner/private-body dumps.
//   bun capture.ts OUTPUT_DIRECTORY PRIMARY_AREA [OTHER_OWNED_AREA ...]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { refreshes, summarize } from "./refreshes.ts";
const [out, ...paths] = process.argv.slice(2);
assert(out && paths.length >= 1, "Pass an output directory, then the primary owned area (and any other owned areas)");
const areas = paths.map(path => resolve(path));
const manifests = areas.map(area => JSON.parse(readFileSync(join(area, "manifest.json"), "utf8")));
for (const m of manifests) assert.equal(m.repository, "mlegls/reconcile-pr-transport-20261014-35767b2d");
const [m] = manifests, o = m.observations;
const lines = (area: string, file: string) => readFileSync(join(area, file), "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
const calls = areas.map(area => lines(area, "calls.jsonl"));
const publicAttempt = (a: any) => ({ node: a.node, handle: a.handle, claim: a.claim, baseline: a.baseline, owned: a.owned, phase: a.phase,
  acceptance: a.acceptance ? { reportTs: a.acceptance.reportTs, children: a.acceptance.children, into: a.acceptance.into, destination: a.acceptance.destination, preparedHead: a.acceptance.preparedHead, landedHead: a.acceptance.landedHead } : undefined, worker: a.worker });
const queries = manifests.map((x, i) => ({ area: x.area, ...summarize(calls[i]), counts: x.observations.finalQueries?.counts }));
assert(queries.every(q => q.allComplete && q.allSingleRequest && !q.orphanPages), "A refresh was incomplete, made extra requests or was unattributed");
const evidence = {
  tested: m.tested,
  claimsBeforeLaunch: lines(areas[0], "writers.jsonl.launches"),
  cache: o.cache, warmScheduler: o.warmScheduler,
  collector: { ...o.collector, outside: { slug: o.collector.outside.slug, blockedBy: o.collector.outside.blockedBy, frontier: o.collector.outside.frontier } },
  rateLimit: { cliFailure: o.rateLimitCliFailure, pendingReport: o.rateLimitPendingReport },
  publication: { pr: o.published.pr, closing: o.published.closing, issues: o.published.issues, results: o.published.results, workersRetired: o.published.workersRetired },
  merged: o.merged,
  promotion: { ...o.promotion, refinement: publicAttempt(o.promotion.refinement) },
  promotionCut: { pid: o.promotionRestartCut.pid, counter: o.promotionRestartCut.counter, chains: o.promotionRestartCut.chains },
  failedRefinement: { ...o.failedRefinement, attempt: publicAttempt(o.failedRefinement.attempt) },
  failedCut: { pid: o.failedRefinementCut.pid, root: o.failedRefinementCut.root, attempts: Object.values(o.failedRefinementCut.refinements).map(publicAttempt) },
  queries,
  protocolMutations: calls[0].filter(c => c.operation === "TrackerWrite" && ["addComment", "closeIssue"].includes(c.field)),
  cleanup: manifests.map(x => ({ area: x.area, issues: x.issues, branches: x.branches, labels: x.labels, processes: x.processes, ...x.observations.cleanup })),
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "api-extracts.json"), JSON.stringify(evidence, null, 2) + "\n");
// Every refresh: one named TrackerSnapshot, unique issue coverage and all required nested connection counts.
writeFileSync(join(out, "refreshes.json"), JSON.stringify(areas.map((area, i) => ({ area, ...refreshes(calls[i]) })), null, 2) + "\n");
console.log("Selected native claims, chronology, rate-limit holds, per-refresh accounting and resource inventory captured.");
