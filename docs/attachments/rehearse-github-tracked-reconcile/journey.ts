// One-off owned live first use, not a retained test or another scheduler/backend.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shellBb } from "../land-reconciled-trees-through-pull-requests/shell-bb.ts";
import type { Handle } from "../../../lib/dispatch.ts";
import type { State } from "../../../lib/reconcile/reconcile.ts";

const repository = "mlegls/reconcile-pr-transport-20261014-35767b2d";
const pkg = realpathSync(join(import.meta.dir, "../../.."));
const action = process.argv[2] ?? "run";
assert(["run", "resume", "status", "cleanup"].includes(action), "Use run|resume|status|cleanup [owned directory]");
const area = action === "run" ? realpathSync(mkdtempSync("/tmp/native-reconcile-")) : realpathSync(process.argv[3]);
const manifestFile = join(area, "manifest.json");
type Manifest = { repository: string; area: string; cwd: string; tested: string; issues: string[]; roots: string[];
  labels: string[]; branches: string[]; processes: number[]; observations: Record<string, any>; progress: string };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe", timeout: 120_000 }).trim();
const head = (cwd: string) => git(cwd, "rev-parse", "HEAD");
const m: Manifest = action === "run" ? { repository, area, cwd: join(area, "repo"), tested: head(pkg),
  issues: [], roots: [], labels: [], branches: [], processes: [], observations: {}, progress: "preflight" }
  : JSON.parse(readFileSync(manifestFile, "utf8"));
assert.equal(m.repository, repository);
const persist = () => writeFileSync(manifestFile, JSON.stringify(m, null, 2) + "\n");
const record = (name: string, data: unknown) => { m.observations[name] = data; persist(); console.log(name + " " + JSON.stringify(data)); };
const put = (cwd: string, file: string, content: string) => { mkdirSync(join(cwd, file, ".."), { recursive: true }); writeFileSync(join(cwd, file), content); };
const commit = (cwd: string, file: string, content: string) => {
  put(cwd, file, content); git(cwd, "add", "--", file); git(cwd, "commit", "-qm", "Native rehearsal: " + file); return head(cwd);
};
const cliPath = join(pkg, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const nativeGh = Bun.which("gh")!;
for (const key of Object.keys(process.env)) if (/^(?:PI_.*|BB_.*|AB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
const bin = join(area, "bin"), agents = join(area, "agents");
mkdirSync(bin, { recursive: true });
Object.assign(process.env, { XDG_STATE_HOME: join(area, "state"), XDG_CACHE_HOME: join(area, "cache"),
  PI_BOARD_DIR: join(area, "board"), PI_CODING_AGENT_DIR: join(area, "agent"), PI_AGENTS_DIR: agents,
  MISE_TRUSTED_CONFIG_PATHS: area, TRACKER_CLI: cliPath, PARALLEL_HOME: join(area, "parallel"), WORKER_SLOTS: "2",
  WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'",
  REHEARSAL_GH: nativeGh, REHEARSAL_CALLS: join(area, "calls.jsonl"), REHEARSAL_LOSS: join(area, "lose-create"),
  REHEARSAL_WRITERS: join(area, "writers.jsonl"), PATH: bin + ":" + process.env.PATH });
put(bin, "gh", "#!/bin/sh\nexec " + JSON.stringify(process.execPath) + " " + JSON.stringify(join(import.meta.dir, "transport.ts")) + " \"$@\"\n");
execFileSync("chmod", ["+x", join(bin, "gh")]);
shellBb(area, "git rev-parse HEAD > shell-base\ntouch shell-started\n" +
  "bun -e 'const p=Bun.spawn([\"bun\"," + JSON.stringify(join(import.meta.dir, "runtime.ts")) +
  ",\"writer\"],{stdin:\"ignore\",stdout:\"ignore\",stderr:\"ignore\"});p.unref();'\n");
process.env.REHEARSAL_BB = process.env.BB_CLI;
put(bin, "bb", "#!/bin/sh\nexec " + JSON.stringify(process.execPath) + " " + JSON.stringify(join(import.meta.dir, "runtime.ts")) + " \"$@\"\n");
execFileSync("chmod", ["+x", join(bin, "bb")]); process.env.BB_CLI = join(bin, "bb");
for (const [name, role] of [["shell", "implement"], ["shell-refine", "refine"], ["shell-drive", "drive"],
  ["shell-handler", "handle"], ["technical", "implement"], ["tidy", "review"]]) {
  put(agents, name + ".md", "---\nrole: " + role + "\n---\nDeterministic native issue rehearsal.\n");
  put(agents, "roles/" + role + ".md", "Deterministic shell role.\n");
}
const { getTracker } = await import("../../../lib/tracker.ts");
const { githubProject, githubCacheLifetime } = await import("../../../lib/tracker-github-snapshot.ts");
const { loadJournal } = await import("../../../lib/tracker-github-state.ts");
const { start, stop, resolveException, campaigns, summary } = await import("../../../lib/reconcile/main.ts");
const { load } = await import("../../../lib/reconcile/reconcile.ts");
const { allThreads, getThread } = await import("../../../lib/thread/registry.ts");
const { send } = await import("../../../lib/board/store.ts");
const { createPullRequestHost } = await import("../../../lib/reconcile/pr-host.ts");
const host = createPullRequestHost();
const gh = (args: string[], input?: any) => execFileSync("gh", args, { encoding: "utf8", stdio: "pipe", timeout: 120_000,
  ...(input === undefined ? {} : { input: JSON.stringify(input) }) }).trim();
const api = (path: string) => JSON.parse(gh(["api", path]));
const state = (root: string) => load(m.cwd, root)!;
const native = (slug: string) => {
  const r = api("repos/" + repository + "/issues/" + slug.slice(3));
  return { number: r.number, id: r.node_id, state: r.state, stateReason: r.state_reason, closedAt: r.closed_at,
    assignees: r.assignees.map((u: any) => u.login), labels: r.labels.map((l: any) => l.name), url: r.html_url };
};
const calls = () => existsSync(process.env.REHEARSAL_CALLS!) ? readFileSync(process.env.REHEARSAL_CALLS!, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
const snapshots = () => calls().filter(c => c.operation === "TrackerSnapshot").length;
async function until<T>(fn: () => T | false | undefined, label: string, root?: string, allowException = false): Promise<T> {
  for (let n = 0; n < 900; n++) {
    const s = root && state(root);
    if (s && !allowException && Object.keys(s.exceptions).length) throw new Error("Owner exception: " + JSON.stringify(s.exceptions));
    const value = fn(); if (value) return value;
    await Bun.sleep(1000);
  }
  throw new Error("Timeout: " + label);
}
const ready = (root: string, slug: string, phase: string) => until(() => {
  const c = state(root)?.chains[slug], h = c?.handle;
  return c?.phase === phase && h && existsSync(join(h.path, "shell-pid")) && existsSync(join(h.path, "setup-ready")) && h;
}, slug + " " + phase, root);
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const writerPid = (h: Handle) => Number(readFileSync(join(h.path, "shell-pid"), "utf8"));
const boot = (root: string) => {
  if (!m.roots.includes(root)) m.roots.push(root);
  const result = start({ cwd: m.cwd, root, owner: "mail/native-rehearsal", budget: 1, land: "pr-merge" });
  m.processes.push(result.pid); persist(); return result;
};
const crash = async (root: string, label: string) => {
  const s = state(root), pid = s.pid!;
  const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  assert(command.includes("lib/reconcile/main.ts run " + root));
  process.kill(pid, "SIGKILL"); await until(() => !alive(pid), "exact PID exit");
  record(label, { pid, root, counter: s.counter, refinements: s.refinements, chains: Object.fromEntries(Object.entries(s.chains).map(([id,c]) => [id,{phase:c.phase,handle:c.handle?.handle}])) });
  return s;
};
const packet = (slug: string) => "docs/attachments/native-rehearsal/" + slug + ".md";
const report = (h: Handle, slug: string, status = "done", extra = {}) => send({ from: {}, topic: h.run + "/" + h.handle,
  tags: [status], body: status + "\n\n" + "\x60\x60\x60json\n" + JSON.stringify({
    summary: slug + " native rehearsal result", setup: { kind: "owned-native-github", entry: "mise run pre-integrate" },
    stories: [{ story: slug + " fixture code and joins", outcome: "held" }],
    evidence: { path: packet(slug), visual: false, shots: [] }, tests: [], ...extra }) + "\n\x60\x60\x60" });
const cli = (args: string[], input?: string, root?: string, cwd = m.cwd) => execFileSync("bun", [cliPath, ...args], {
  cwd, env: { ...process.env, ...(root ? { PI_WM_RUN: root } : {}) }, input, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20 }).trim();
const create = (name: string, fields: any, root?: string) => {
  const slug = cli(["create", name + "-" + area.split("-").at(-1), "--fields", JSON.stringify({
    assignee: "agent:shell", author: "user:native-rehearsal", ...fields }), "--body-file", "-"], "Owned native rehearsal contract: " + name + ".\n", root);
  m.issues.push(slug); persist(); return slug;
};
const green = async (oid: string) => until(() => {
  const checks = host.checks(m.cwd, repository, oid);
  return checks.length > 0 && checks.every(c => c.state === "pass") && checks;
}, "real Actions at " + oid);
async function claim(root: string, slug: string, h: Handle) {
  const tracker = getTracker(h.path, { run: root, inflight: false });
  const fields = tracker.fields(slug), journal = loadJournal(githubProject(m.cwd)!, root), issue = native(slug);
  assert.equal(fields["claimed-by"], "reconcile:" + root);
  assert.deepEqual(issue.assignees, ["mlegls"]);
  assert.equal(journal.issues[slug].claim?.claimedBy, "reconcile:" + root);
  record("claim-" + slug, { worker: h.handle, thread: h.threadId, issue, privateClaim: journal.issues[slug].claim, launchAt: state(root).chains[slug]?.launchedAt });
}
async function finish(root: string, slug: string) {
  for (const phase of ["implement", "drive", "review"]) {
    const h = await ready(root, slug, phase);
    if (phase === "implement") {
      await claim(root, slug, h);
      commit(h.path, "fixture/" + slug + ".txt", slug + " native code\n");
      commit(h.path, packet(slug), "# " + slug + "\n\nNative GitHub issue fixture. Code and joins observed via production shell phases. Entry: mise run pre-integrate.\n");
    }
    report(h, slug);
    record("worker-" + slug + "-" + phase, { handle: h.handle, thread: h.threadId, writer: writerPid(h), head: head(h.path) });
  }
}
async function cleanup() {
  for (const root of m.roots) if (state(root)) {
    const pr = state(root).pr;
    await stop(m.cwd, root);
    if (pr?.number) {
      const observed = host.observe(m.cwd, repository, pr.number);
      if (observed.state === "OPEN") gh(["pr", "close", String(pr.number), "--repo", repository]);
      if (git(m.cwd, "ls-remote", "--heads", "origin", pr.branch)) git(m.cwd, "push", "origin", "--delete", pr.branch);
    }
  }
  // Cleanup only remaining disposable fixture issues. Discarded children were already
  // NOT_PLANNED/detached by production remove, never by this terminal housekeeping.
  for (const slug of m.issues) if (native(slug).state === "open") {
    gh(["api", "--method", "PATCH", "repos/" + repository + "/issues/" + slug.slice(3), "--input", "-"],
      { state: "closed", state_reason: "not_planned", assignees: [] });
  }
  const live = (await allThreads()).filter(t => !t.archived && m.roots.includes(t.worker?.run ?? ""));
  assert.equal(live.length, 0);
  record("cleanup", { rootsStopped: m.roots, issues: m.issues.map(native), branchesDeleted: m.branches,
    localAreaRetained: area, labelsRetained: m.labels, artifactCommitsRetained: true, liveWorkers: live.length });
}
persist();
try {
  if (action === "status") { console.log(JSON.stringify(campaigns(m.cwd).map(summary), null, 2)); }
  else if (action === "cleanup") { await cleanup(); }
  else {
    if (action === "run") {
    const viewer = api("user"), repo = api("repos/" + repository);
    assert.equal(viewer.login, "mlegls"); assert.equal(repo.full_name, repository);
    assert(repo.private && repo.has_issues && repo.permissions.admin && repo.permissions.push); assert.equal(repo.default_branch, "main");
    assert(api("repos/" + repository + "/actions/permissions").enabled);
    const initial = api("repos/" + repository + "/issues?state=all&per_page=100");
    record("preflight", { login: viewer.login, repository, private: repo.private, permissions: repo.permissions,
      issues: initial.filter((i:any) => !i.pull_request).map((i:any) => ({number:i.number,state:i.state})),
      prs: initial.filter((i:any) => i.pull_request).map((i:any) => ({number:i.number,state:i.state})), actions: true });
    git(area, "clone", "-q", "https://github.com/" + repository + ".git", m.cwd);
    git(m.cwd, "config", "user.name", "Owned native rehearsal"); git(m.cwd, "config", "user.email", "rehearsal@example.invalid");
    assert(!existsSync(join(m.cwd, "docs/issues")));
    const roles = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"];
    const labels = api("repos/" + repository + "/labels?per_page=100").map((l:any) => l.name);
    for (const label of roles) if (!labels.includes(label)) {
      gh(["api", "--method", "POST", "repos/" + repository + "/labels", "--input", "-"], { name: label, color: "bfdadc", description: "Native rehearsal canonical triage role" });
      m.labels.push(label); persist();
    }
    put(m.cwd, "docs/agents/issue-tracker.md", "# Issue tracker: GitHub\nRepository: " + repository + "\n");
    put(m.cwd, "docs/agents/triage-labels.md", "| Canonical role | Repository label | Meaning |\n| --- | --- | --- |\n" +
      roles.map(role => "| " + role + " | " + role + " | " + role.replaceAll("-", " ") + " |\n").join(""));
    put(m.cwd, ".pi/reconcile.json", '{"land":"pr-merge"}\n');
    const ignores = readFileSync(join(m.cwd, ".gitignore"), "utf8");
    put(m.cwd, ".gitignore", ignores + "\nshell-pid\nsetup-ready\n");
    put(m.cwd, "mise.toml", '[tasks.setup]\nrun = "touch setup-ready"\n[tasks.pre-integrate]\nrun = "bash gate.sh"\n');
    // Keep the inherited gate's criteria, but receipts must never touch a prior run.
    put(m.cwd, "gate.sh", "#!/bin/sh\nset -eu\ntest -s fixture/ci.txt\ntest -s fixture/conflict.txt\nif grep -q '<<<<<<<' fixture/conflict.txt; then exit 1; fi\nprintf '%s ' \"$PWD\" >> '" + join(area,"gates") + "'\ngit rev-parse HEAD >> '" + join(area,"gates") + "'\n");
    git(m.cwd, "add", "docs/agents", ".pi/reconcile.json", ".gitignore", "mise.toml", "gate.sh");
    git(m.cwd, "commit", "-qm", "Select native GitHub tracker for owned rehearsal");
    execFileSync("mise", ["run", "setup"], {cwd:m.cwd,stdio:"pipe"});
    execFileSync("mise", ["run", "pre-integrate"], {cwd:m.cwd,stdio:"pipe"});
    git(m.cwd, "push", "-q", "origin", "main");
    record("readiness", { head: head(m.cwd), setup: true, gate: true, checks: await green(head(m.cwd)), canonicalVaultAbsent: true });
    }
    const tracker = getTracker(m.cwd, { inflight: false }); assert(tracker.githubIssue);
    const seed = m.observations.seed;
    const root = seed?.root ?? create("native-spec", { stage: "spec" });
    const a = seed?.a ?? create("native-a", { stage: "ticket", "part-of": root });
    const b = seed?.b ?? create("native-b", { stage: "ticket", "part-of": root, "blocked-by": [a] });
    const outside = seed?.outside ?? create("native-outside", { stage: "ticket", "blocked-by": [a] });
    if (action === "resume") {
      // An aborted controller before any reviewed landing may reuse its own disposed seed.
      // Never reopen a merged/auto-closed issue, or alter saved completion receipts.
      const prior = state(root);
      assert(Object.values(prior.results).every(result => !result.closedAt) && !prior.pr?.number);
      for (const id of [root,a,b,outside]) {
        assert(m.issues.includes(id));
        const row = native(id); assert.equal(row.stateReason,"not_planned");
        gh(["api","--method","PATCH","repos/"+repository+"/issues/"+id.slice(3),"--input","-"],{state:"open"});
      }
      // A public metadata write invalidates the shared observation after explicit seed restoration.
      cli(["update",root,"--fields",'{"stage":"spec","measurement":"owned-seed-restored"}']);
      for (const id of [a,b,root]) if (prior.landed[id]) cli(["update",id,"--fields",JSON.stringify({"claimed-by":"reconcile:"+root})],undefined,root);
      record("restoredOwnedSeed",{root,a,b,outside,retainedReviewedResults:Object.keys(prior.results),noTargetCloseReceipts:true});
    }
    const p = githubProject(m.cwd)!;
    const nativeRelations = () => {
      const snapshot = JSON.parse(readFileSync(join(p.directory,"snapshot.json"),"utf8")).snapshot;
      const row = (slug:string) => snapshot.issues.find((i:any) => "gh-"+i.number === slug);
      assert.equal(row(a).parent.number, Number(root.slice(3))); assert.equal(row(b).parent.number, Number(root.slice(3)));
      assert.equal(row(b).blockedBy[0].number, Number(a.slice(3))); assert.equal(row(outside).blockedBy[0].number, Number(a.slice(3)));
      return { root: row(root).id, a: row(a).id, b: row(b).id, outside: row(outside).id, native: true };
    };
    tracker.snapshot(); record("seed", { root, a, b, outside, relations: nativeRelations() });
    // Real warm/expiry/write refreshes: no cache-file edits or synthetic clocks.
    const warmStart = snapshots();
    for (let n=0;n<4;n++) { tracker.snapshot(); tracker.snapshot(root); tracker.fields(a); tracker.text(root); cli(["fields",b]); cli(["text",a]); }
    assert.equal(snapshots()-warmStart,0);
    await Bun.sleep(githubCacheLifetime + 1000);
    const expired = snapshots(); tracker.snapshot(); assert.equal(snapshots()-expired,1);
    cli(["update", outside, "--fields", '{"measurement":"own-write-invalidation"}']);
    const invalidated = snapshots(); tracker.snapshot(); assert.equal(snapshots()-invalidated,1);
    record("cache", { warmRequests: 0, warmReads: 24, realExpiryMs: githubCacheLifetime+1000, expiryRequests:1, externalCliWriteNextRefresh:1 });
    boot(root);
    const ah = await ready(root,state(root).landed[a] ? b : a,"implement"); await claim(root,root,ah);
    const schedulerWarm = snapshots();
    for(let n=0;n<3;n++) { tracker.snapshot(); tracker.fields(a); tracker.text(root); cli(["snapshot",root,"--json"]); }
    await Bun.sleep(11_000); // production's five-second loop reads the same complete warm snapshot
    assert.equal(snapshots()-schedulerWarm,0);
    record("warmScheduler", {requests:0,publicReads:12,elapsedMs:11000,tickMs:5000,activeWorker:ah.handle});
    if (!state(root).landed[a]) await finish(root,a);
    const bh = await ready(root,b,"implement"), s = state(root);
    assert.equal(s.landed[a].into,root); assert(!s.results[a].closedAt);
    assert(existsSync(join(bh.path,"fixture/"+a+".txt")));
    const collectorNative = [native(a),native(b)];
    assert(collectorNative.every(i=>i.state==="open")); assert(!tracker.snapshot().get(outside)?.frontier);
    record("collector", { a:s.landed[a], bStartingHead:head(bh.path), aAncestor:true, issues:collectorNative, outside:tracker.snapshot().get(outside),
      results:s.results, targetReceipts:Object.values(s.results).filter(r=>r.closedAt).length });
    git(bh.path,"merge-base","--is-ancestor",s.landed[a].head,"HEAD");
    await finish(root,b); await finish(root,root);
    await until(()=>state(root).pr?.number,"root PR",root);
    const pub = state(root), pr = host.observe(m.cwd,repository,pub.pr!.number!);
    m.branches.push(pub.pr!.branch); persist();
    const closing = pub.pr!.publication!.body.split("\n").filter(l=>/^Closes #/.test(l));
    assert.deepEqual(new Set(closing),new Set([a,b,root].map(id=>"Closes #"+id.slice(3))));
    assert([a,b,root].every(id=>!pub.results[id].closedAt));
    assert([a,b,root].map(native).every(i=>i.state==="open"));
    assert(!(await allThreads()).some(t=>!t.archived && t.worker?.run===root));
    record("published", { pr, closing, results:pub.results, ledger:pub.landed, issues:[a,b,root].map(native), workersRetired:true });
    await until(()=>state(root).finished==="done","merged target and saved result publication",root);
    const done = state(root), merged = host.observe(m.cwd,repository,done.pr!.number!);
    assert.equal(merged.state,"MERGED"); git(m.cwd,"merge-base","--is-ancestor",merged.head,merged.mergeCommit!);
    const order = [a,b,root].map(id=>({slug:id,closedAt:done.results[id].closedAt,issue:native(id),
      comments:api("repos/"+repository+"/issues/"+id.slice(3)+"/comments").filter((c:any)=>c.body.includes("<!-- mlegls-pi:result:")).map((c:any)=>({id:c.id,url:c.html_url,at:c.created_at,body:c.body}))}));
    assert(order.every(o=>o.closedAt && o.issue.state==="closed" && o.issue.stateReason==="completed" && o.comments.length===1));
    assert(order.every((o,i)=>i===0 || o.closedAt! >= order[i-1].closedAt!));
    for(const id of [a,b,root]) { const {closedAt,...saved}=done.results[id]; assert.deepEqual(saved,pub.results[id]); }
    assert(tracker.snapshot().get(outside)?.frontier);
    record("merged", { pr:merged, fetchedAncestry:true, results:order, outsideReady:true, target:done.target, ownerSync:done.pr!.ownerSync,
      hostAutoCloseEvents:"native closed_at may precede child-first private closedAt; never reopened" });

    // A separate ordinary leaf: inferred spec, actual refine promotes globally.
    const promotion = create("native-promotion", {});
    assert.equal(tracker.fields(promotion).stage,"spec"); boot(promotion);
    const refine = await ready(promotion,promotion,"refine"); await claim(promotion,promotion,refine);
    cli(["update",promotion,"--fields",'{"stage":"ticket"}'],undefined,promotion,refine.path);
    assert.equal(getTracker(refine.path,{run:promotion}).fields(promotion).stage,"ticket");
    report(refine,promotion,"done",{children:[]});
    const impl = await ready(promotion,promotion,"implement");
    const before = state(promotion), attempt = before.refinements[refine.handle];
    assert.equal(attempt.phase,"accepted"); assert.equal(before.counter,2);
    await crash(promotion,"promotionRestartCut"); boot(promotion);
    await until(()=>state(promotion).pid!==before.pid,"resumed promotion PID");
    await Bun.sleep(6000);
    assert.equal(state(promotion).counter,before.counter);
    assert.equal(state(promotion).chains[promotion].handle?.handle,impl.handle);
    assert.equal(getTracker(impl.path,{run:promotion}).fields(promotion).stage,"ticket");
    record("promotion", { issue:native(promotion), inferred:"spec", promoted:"ticket", refinement:attempt, sameImplement:impl.handle,
      resumedPid:state(promotion).pid, counter:state(promotion).counter, stageLabels:native(promotion).labels.filter(l=>/^stage:/.test(l)) });
    await stop(m.cwd,promotion);

    // Failed writer + create-after-publication/before-observation cut.
    const failed = create("native-failed-refine",{stage:"spec"});
    const baseline = create("native-baseline",{stage:"ticket","part-of":failed});
    cli(["close",baseline,"--summary","Owned completed baseline; preserved during failed refinement."]);
    boot(failed);
    const writer = await ready(failed,failed,"refine"), wp = writerPid(writer);
    const token = state(failed).refinements[writer.handle].claim;
    assert((await getThread(writer.threadId!))!.launch!.prompt!.includes(token));
    const x = create("native-provisional-x",{stage:"ticket","part-of":failed,"claimed-by":token},failed);
    await until(()=>state(failed).refinements[writer.handle].owned.includes(x),"observed provisional",failed);
    const cut = await crash(failed,"failedRefinementCut"); assert(alive(wp));
    writeFileSync(process.env.REHEARSAL_LOSS!,"armed\n");
    let lost = false;
    try { create("native-provisional-lost",{stage:"ticket","part-of":failed,"claimed-by":token},failed); } catch(e) { lost=String(e).includes("lost successful create response"); }
    assert(lost);
    const loss = calls().findLast(c=>c.operation==="DeliberateLostCreateResponse");
    const y = "gh-"+loss.number; m.issues.push(y); persist();
    assert(!cut.refinements[writer.handle].owned.includes(y));
    const foreign = create("native-foreign",{assignee:"human","part-of":failed});
    boot(failed);
    report(writer,failed,"blocked",{question:"Deliberate failed refine; discard the exact attempt's owned provisional work."});
    await until(()=>state(failed).refinements[writer.handle].phase==="removed","failed attempt cleanup",failed,true);
    assert(!alive(wp));
    const rows=getTracker(m.cwd,{run:failed}).snapshot();
    assert(!rows.has(x) && !rows.has(y)); assert(rows.has(baseline) && rows.has(foreign));
    assert(!state(failed).chains[x] && !state(failed).chains[y]);
    assert(!(await allThreads(true)).some(t=>[x,y].some(id=>t.worker?.handle.startsWith(id+"-implement-"))));
    const removed=[x,y].map(native); assert(removed.every(i=>i.state==="closed" && i.stateReason==="not_planned" && i.assignees.length===0));
    const snapshot=JSON.parse(readFileSync(join(p.directory,"snapshot.json"),"utf8")).snapshot;
    assert([x,y].every(id=>!snapshot.issues.find((i:any)=>"gh-"+i.number===id).parent));
    record("failedRefinement", { root:failed, token, exactWriter:wp, writerStopped:true, attempt:state(failed).refinements[writer.handle],
      lostResponse:{issue:y,absentFromSavedOwned:true,discovered:state(failed).refinements[writer.handle].owned.includes(y)},
      removed, retained:[native(baseline),native(foreign)], provisionalImplementLaunches:0 });
    await stop(m.cwd,failed);

    const operations=calls(), counts:Record<string,number>={};
    for(const c of operations) counts[c.operation]=(counts[c.operation]??0)+1;
    const refreshes=operations.filter(c=>/^Tracker(Snapshot|Issues|Labels|Connection)$/.test(c.operation));
    assert(refreshes.every(c=>c.operation==="TrackerSnapshot" && c.status===0 && !c.more));
    record("queries", { counts, completeRefreshes:refreshes.length, requestsPerRefresh:1,
      everyRefreshSinglePage:true, includesExternalCliWriters:true, maxIssueCount:Math.max(...refreshes.map(c=>c.issueCount)) });
    m.progress="done"; persist(); await cleanup();
  }
} catch(error) {
  record("failure",{message:String(error),states:m.roots.map(root=>({root,log:state(root)?.log.slice(-8),exceptions:state(root)?.exceptions}))});
  // Failed observation remains a failure; exact owned cleanup still runs.
  if(existsSync(join(m.cwd,".git"))) await cleanup();
  throw error;
}
console.log("OWNED_DIRECTORY "+area);
