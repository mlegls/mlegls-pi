// Select durable API/protocol evidence, never raw runner/private-body dumps.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
const areas=process.argv.slice(2).map(path=>resolve(path));
assert(areas.length===2,"Pass primary owned area then aborted setup area");
const manifests=areas.map(area=>JSON.parse(readFileSync(join(area,"manifest.json"),"utf8")));
for(const m of manifests) assert.equal(m.repository,"mlegls/reconcile-pr-transport-20261014-35767b2d");
const [m,initial]=manifests, o=m.observations;
const lines=(area:string,file:string)=>readFileSync(join(area,file),"utf8").trim().split("\n").filter(Boolean).map(l=>JSON.parse(l));
const calls=areas.map(area=>lines(area,"calls.jsonl"));
const refreshes=calls.map((rows,i)=>({area:areas[i],queries:rows.filter(c=>/^Tracker(Snapshot|Issues|Labels|Connection)$/.test(c.operation))}));
assert(refreshes.every(r=>r.queries.every(q=>q.operation==="TrackerSnapshot" && q.status===0 && q.more===false)));
const publicAttempt=(a:any)=>({node:a.node,handle:a.handle,claim:a.claim,baseline:a.baseline,owned:a.owned,phase:a.phase,
  acceptance:a.acceptance ? {reportTs:a.acceptance.reportTs,children:a.acceptance.children,into:a.acceptance.into,destination:a.acceptance.destination,preparedHead:a.acceptance.preparedHead,landedHead:a.acceptance.landedHead} : undefined,worker:a.worker});
const evidence={
  finalRevision:o.finalRevision,
  claimsBeforeLaunch:lines(areas[0],"writers.jsonl.launches"),
  collector:{...o.collector,outside:{slug:o.collector.outside.slug,blockedBy:o.collector.outside.blockedBy,frontier:o.collector.outside.frontier}},
  publication:{pr:o.published.pr,closing:o.published.closing,issues:o.published.issues,results:o.published.results,workersRetired:o.published.workersRetired},
  merged:o.merged,
  promotion:{...o.promotion,refinement:publicAttempt(o.promotion.refinement)},
  promotionCut:{pid:o.promotionRestartCut.pid,counter:o.promotionRestartCut.counter,chains:o.promotionRestartCut.chains},
  failedRefinement:{...o.failedRefinement,attempt:publicAttempt(o.failedRefinement.attempt)},
  failedCut:{pid:o.failedRefinementCut.pid,root:o.failedRefinementCut.root,attempts:Object.values(o.failedRefinementCut.refinements).map(publicAttempt)},
  cache:o.cache,warmScheduler:o.warmScheduler,
  queryCounts:manifests.map(x=>({area:x.area,...x.observations.finalQueries})),
  protocolMutations:calls[0].filter(c=>c.operation==="TrackerWrite" && ["addComment","closeIssue"].includes(c.field)),
  cleanup:manifests.map(x=>({area:x.area,issues:x.issues,branches:x.branches,labels:x.labels,processes:x.processes,...x.observations.cleanup})),
};
writeFileSync(join(import.meta.dir,"api-extracts.json"),JSON.stringify(evidence,null,2)+"\n");
writeFileSync(join(import.meta.dir,"refreshes.json"),JSON.stringify(refreshes,null,2)+"\n");
console.log("Selected native claims, chronology, final query operations and resource inventory captured.");
