import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Replays first-use check 3 at the supervisor boundary with real Git/state and
// synthetic Decision API responses; only worker dispatch and mailbox are fixtures.
test("a persistent Decision API outage pauses one launch, then start resumes it", async () => {
 const root = mkdtempSync(join(tmpdir(), "supervise-outage-"));
 const tracker = join(root, ".pi/agent/skills/tracker/scripts");
 mkdirSync(tracker, { recursive: true });
 writeFileSync(join(tracker, "issues.ts"), `import {join} from 'node:path'; console.log(JSON.stringify({issues:[{slug:'probe',file:join(process.cwd(),'docs/issues/probe.md'),partOf:null,frontier:true,done:false,effectiveStage:'ticket',assignee:'agent'}]}));`);
 const script = join(root, "probe.ts");
 writeFileSync(script, `
import {mock,expect} from 'bun:test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const cwd=join(${JSON.stringify(root)},'repo');
mkdirSync(join(cwd,'docs/issues'),{recursive:true});
writeFileSync(join(cwd,'docs/issues/probe.md'),'---\\nstage: ticket\\nassignee: agent\\n---\\n');
const git=(...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8'});
git('init','-q');git('config','user.name','test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-qm','Initial');
const {decide}=await import(${JSON.stringify(resolve("lib/decide.ts"))});
let status=402,attempts=0,launched=0,notifications=[],current,control;
const question={safe:{type:'noul',instructions:'Can this child launch?'}};
const response={model:'fixture',answers:{safe:{type:'noul',noul:0.9}},usage:{input_tokens:1,output_tokens:1}};
globalThis.fetch=async()=>{attempts++;return status===200?Response.json(response):new Response('synthetic outage',{status});};
mock.module(${JSON.stringify(resolve("lib/route.ts"))},()=>({prepareRole:async()=>{
 await decide('route child',question,{apiKey:'fixture',url:'https://api.typesafe.ai/v1/systemone'});
 return {kind:'ready',agent:'general',model:'fixture/model',effort:'low'};
}}));
mock.module(${JSON.stringify(resolve("lib/dispatch.ts"))},()=>({dispatch:async()=>{launched++;control.abort();return {submitted:[{run:'probe',handle:'probe',path:cwd}]};},integrate:async()=>{},retire:async()=>{},topic:()=>''}));
mock.module(${JSON.stringify(resolve("lib/children.ts"))},()=>({send:async(_,text)=>{notifications.push(text);}}));
const {run}=await import(${JSON.stringify(resolve("lib/jobs/supervise.ts"))});
async function start(carried){control=new AbortController();current=null;
 await run({id:'supervise-probe',input:{ticket:'probe',cwd,owner:'owner',ownerSession:'session',budget:1,commands:join(cwd,'.git/commands'),carried},state:null,signal:control.signal,save:async state=>{current=structuredClone(state);},log:()=>{}});
 return current;}
const first=await start(null);
expect(first.metrics.launched).toBe(0);expect(launched).toBe(0);expect(attempts).toBe(1);
expect(first.decisionUnavailable.probe).toContain('Decision API unavailable: HTTP 402 after one attempt');
expect(notifications).toHaveLength(1);expect(notifications[0]).toContain('Pick the agents yourself and restart');
writeFileSync(join(${JSON.stringify(root)},'saved.json'),JSON.stringify(first));
status=200;const second=await start(first);
expect(second.metrics.launched).toBe(1);expect(second.decisionUnavailable).toBeUndefined();expect(second.children.probe.phase).toBe('implement');
expect(notifications).toHaveLength(1);
// Persistent 503 is the driver's unobserved job-level case: four attempts, one notice, no launch.
status=503;attempts=0;notifications=[];
const third=await start(null);
expect(attempts).toBe(4);expect(third.metrics.launched).toBe(0);
expect(third.decisionUnavailable.probe).toContain('Decision API unavailable: HTTP 503 after 4 attempts');
expect(notifications).toHaveLength(1);
// Check 4: once a child has finished, a Decision API failure in advisory residual lint
// is included in the done notice rather than cancelling supervision.
writeFileSync(join(cwd,'docs/issues/probe.md'),'---\\nstage: done\\nassignee: agent\\n---\\n');
writeFileSync(join(${JSON.stringify(tracker)},'issues.ts'),\`import ${JSON.stringify(resolve("skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"))};\`);
const outagePreload=join(${JSON.stringify(root)},'lint-outage.ts');
writeFileSync(outagePreload,\`import {appendFileSync} from 'node:fs';globalThis.fetch=async()=>{appendFileSync(${JSON.stringify(join(root, "lint-attempts"))},'x');return new Response('synthetic outage',{status:503});};\`);
process.env.BUN_OPTIONS='--preload='+outagePreload;
notifications=[];
const lint=await start(null);
expect(lint.finished).toBe(true);expect(notifications).toHaveLength(1);
expect(notifications[0]).toContain('done:');expect(notifications[0]).toContain('Residual lint unavailable:');
expect(readFileSync(join(${JSON.stringify(root)},'lint-attempts'),'utf8').length).toBeGreaterThanOrEqual(4);
console.log('402 paused, resumed, persistent 503 paused, advisory lint reported');
`);
 try {
  const proc = Bun.spawn([process.execPath, script], { env: { ...process.env, HOME: root }, stdout: "pipe", stderr: "pipe" });
  const output = await new Response(proc.stdout).text();
  const errors = await new Response(proc.stderr).text();
  expect({ code: await proc.exited, errors }).toEqual({ code: 0, errors: "" });
  expect(output).toContain("persistent 503 paused");
  // Replays the driver's status friction: an unavailable, resumable job must not appear terminal.
  const cli = join(root, "status.ts");
  writeFileSync(cli, `
import {mock} from 'bun:test';import {readFileSync} from 'node:fs';
mock.module(${JSON.stringify(resolve("lib/daemon.ts"))},()=>({status:async()=>[{id:'supervise-probe',type:'supervise',status:'completed',input:{cwd:process.cwd(),ticket:'probe'},state:JSON.parse(readFileSync(${JSON.stringify(join(root, "saved.json"))},'utf8'))}]}));
process.argv=[process.execPath,${JSON.stringify(resolve("ab/main.ts"))},'supervise','status','probe'];
await import(${JSON.stringify(resolve("ab/main.ts"))});`);
  const check = Bun.spawn([process.execPath, cli], { cwd: join(root, "repo"), stdout: "pipe", stderr: "pipe" });
  const visible = await new Response(check.stdout).text();
  const cliErrors = await new Response(check.stderr).text();
  expect({ code: await check.exited, cliErrors }).toEqual({ code: 0, cliErrors: "" });
  expect(visible).toContain("paused (resumable)");
  expect(visible).toContain("Decision API unavailable");
  expect(visible).toContain("HTTP 402");
 } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
