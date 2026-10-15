// Read-only first-use entry on the prepared native target; no inherited worktree/state is needed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { summarize } from "./refreshes.ts";
const repository="mlegls/reconcile-pr-transport-20261014-35767b2d";
const area=realpathSync(mkdtempSync("/tmp/inspect-native-reconcile-")), cwd=join(area,"repo");
const gh=Bun.which("gh")!, pkg=realpathSync(join(import.meta.dir,"../../.."));
for(const key of Object.keys(process.env)) if(/^(?:PI_|BB_|AB_|TRACKER_|WORKER_)/.test(key)) delete process.env[key];
const bin=join(area,"bin"), calls=join(area,"calls.jsonl");
mkdirSync(bin);
writeFileSync(join(bin,"gh"),"#!/bin/sh\nexec "+JSON.stringify(process.execPath)+" "+JSON.stringify(join(import.meta.dir,"transport.ts"))+" \"$@\"\n",{mode:0o755});
Object.assign(process.env,{XDG_STATE_HOME:join(area,"state"),XDG_CACHE_HOME:join(area,"cache"),
  REHEARSAL_GH:gh,REHEARSAL_CALLS:calls,REHEARSAL_LOSS:join(area,"never-armed"),PATH:bin+":"+process.env.PATH});
const rows=()=>readFileSync(calls,"utf8").trim().split("\n").map(l=>JSON.parse(l));
// Count obsolete continuation operations too: no extra query may escape the measurement.
const snapshots=()=>rows().filter(c=>/^Tracker(Snapshot|Issues|Labels|Connection)$/.test(c.operation)).length;
const run=(cmd:string,args:string[])=>execFileSync(cmd,args,{cwd:area,encoding:"utf8",stdio:"pipe",timeout:120000}).trim();
try {
  assert.equal(JSON.parse(run(gh,["api","user"])).login,"mlegls");
  run("git",["clone","-q","https://github.com/"+repository+".git",cwd]);
  const { getTracker }=await import("../../../lib/tracker.ts");
  const tracker=getTracker(cwd,{inflight:false}); assert(tracker.githubIssue);
  const snapshot=tracker.snapshot(), firstRefresh=snapshots();
  assert.equal(firstRefresh,1);
  const {schedulingView}=await import("../../../lib/reconcile/scheduling.ts");
  for(let n=0;n<3;n++) {
    assert(schedulingView(tracker.snapshot(),{root:"gh-96",into:cwd,landed:{},attemptClaims:new Set(),withheld:new Set()}).get("gh-96")?.satisfied);
    tracker.fields("gh-96"); tracker.text("gh-97");
  }
  assert.equal(snapshots()-firstRefresh,0);
  for(const slug of ["gh-96","gh-97","gh-98"]) {
    assert.equal(snapshot.get(slug)?.done,true);
    assert.equal(tracker.fields(slug).stage,"done");
    assert(tracker.text(slug).includes("native-"));
    const comments=tracker.fields(slug)["github-comments"] as {id:string;body:string;url:string}[];
    const results=comments.filter(c=>c.body.includes("<!-- mlegls-pi:result:"));
    assert.equal(results.length,1);
    assert(results[0].body.includes("/blob/2d53966f8fda3c274e4dbc85542d8450b202c58d/docs/attachments/native-rehearsal/"));
  }
  for(const slug of ["gh-104","gh-105"]) {
    const native=tracker.fields(slug).github as {stateReason:string;parent:unknown;assignees:unknown[]};
    assert.equal(native.stateReason,"NOT_PLANNED"); assert.equal(native.parent,null); assert.equal(native.assignees.length,0);
  }
  const prs=JSON.parse(run(gh,["pr","list","--repo",repository,"--state","all","--head","reconcile/pr/gh-96-0ba9c3408eb4","--json","number,state,headRefOid"]));
  assert.equal(prs.length,1); assert.equal(prs[0].number,100); assert.equal(prs[0].state,"MERGED");
  run("git",["-C",cwd,"merge-base","--is-ancestor","2d53966f8fda3c274e4dbc85542d8450b202c58d","8cc5eba402aff351be9bb2d2fb914174221caa1a"]);
  // Public CLI is the runnable story surface, using the committed canonical convention.
  const fields=JSON.parse(execFileSync("bun",[join(pkg,"skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),"fields","gh-96"],
    {cwd,env:process.env,encoding:"utf8",stdio:"pipe"}));
  assert.equal(fields.stage,"done");
  writeFileSync(join(area,"manifest.json"),JSON.stringify({repository,cwd,remoteWrites:0,issues:[],branches:[],labels:[],processes:[]}));
  console.log(JSON.stringify({repository,persona:"mlegls via existing gh auth",root:"gh-96",stage:fields.stage,pr:prs[0],
    fetchedAncestry:true,exactEvidenceComments:3,discardedNativeIssues:[104,105],snapshotRequests:snapshots(),refreshAccounting:summarize(rows()),warmSchedulerReads:3,warmFieldsTextReads:6,warmRequests:snapshots()-firstRefresh,remoteWrites:0,localCloneCleaned:true}));
} finally { rmSync(area,{recursive:true,force:true}); }
