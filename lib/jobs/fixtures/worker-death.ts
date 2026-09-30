// Replay supervise against persisted Pi session logs without a provider, daemon, or live worker.
// `bun run lib/jobs/fixtures/worker-death.ts` prints owner mail and status for failed, healthy, and redispatched workers.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "supervise-worker-death-"));
const script = join(root, "probe.ts");
writeFileSync(script, `
import {mock} from 'bun:test';
import {mkdirSync, writeFileSync, readFileSync, statSync, realpathSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=realpathSync(process.env.HOME), repo=join(root,'repo'), nl=String.fromCharCode(10);
mkdirSync(join(repo,'docs/issues'),{recursive:true});
const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
git('init','-q');git('config','user.name','probe');git('config','user.email','probe@example.invalid');
writeFileSync(join(repo,'docs/issues/root-fixture.md'),'---\\nstage: ticket\\n---\\n');git('add','.');git('commit','-qm','fixture');
const tracker=join(root,'.pi/agent/skills/tracker/scripts');mkdirSync(tracker,{recursive:true});
writeFileSync(join(tracker,'issues.ts'),\`console.log(JSON.stringify({issues:[{slug:'root-fixture',file:process.cwd()+'/docs/issues/root-fixture.md',partOf:null,frontier:false,done:false,effectiveStage:'ticket'}]}));\`);
const {SessionManager}=await import('@earendil-works/pi-coding-agent');
function session(handle, healthy) {
 const sm=SessionManager.create(repo);
 sm.appendCustomEntry('session-meta',{run:'probe-run',handle});
 sm.appendMessage({role:'assistant',content:[],stopReason:'error',errorMessage:'Provider finish_reason: error'});
 if(healthy) sm.appendMessage({role:'user',content:[{type:'text',text:'continue; provider call is still running'}]});
 sm.appendCustomEntry('board-cursor',{cursor:'advanced-after-terminal-turn'});
 const path=sm.getSessionFile();
 const lines=readFileSync(path,'utf8').trimEnd().split('\\n').map(JSON.parse);
 const entry=lines.find(e=>e.type==='message'&&e.message.role==='assistant');
 entry.timestamp=new Date(Date.now()-5*60_000).toISOString();
 writeFileSync(path,lines.map(e=>JSON.stringify(e)).join(nl)+nl);
 return path;
}
const failedPath=session('dead-worker',false);session('healthy-worker',true);
let currentAbort, saved, messages=[];
mock.module(resolve('lib/children.ts'),()=>({
 turnEnd:async (_ids,options)=>{await new Promise(r=>setTimeout(r,25));currentAbort.abort();throw new Error('aborted');},
 waitForTurnEnd:async()=>{throw new Error('unexpected wait');},
 last:async()=>null,
 send:async(owner,text)=>{messages.push({owner,text});}
}));
const {run}=await import(resolve('lib/jobs/supervise.ts'));
async function runCase(handle, sessionStartedAt=Date.now()-5*60_000) {
 const commands=join(root,handle+'.commands');writeFileSync(commands,'');
 currentAbort=new AbortController();messages=[];
 const state={children:{[handle]:{slug:handle,phase:'implement',handle:{run:'probe-run',handle,path:repo},startup:{launchedAt:Date.now()-5*60_000,mode:'pi'},sessionStartedAt}},integrated:[],metrics:{wakes:0,ownerBytes:0,launched:0,completed:0}};
 await run({id:'probe-job',input:{ticket:'root-fixture',cwd:repo,owner:'parent-mailbox',ownerSession:'parent-session',budget:1,commands},state,signal:currentAbort.signal,save:async next=>{saved=structuredClone(next);},log:()=>{}});
 return {state:saved,messages:[...messages]};
}
const failed=await runCase('dead-worker');
const healthy=await runCase('healthy-worker');
const redispatchedPreviousPath=session('redispatched-worker',false);
const redispatchStartedAt=Date.now();
await new Promise(r=>setTimeout(r,2));
const redispatchedPath=session('redispatched-worker',true);
const redispatched=await runCase('redispatched-worker',redispatchStartedAt);
const statusFile=join(root,'status.json'),preload=join(root,'status-preload.ts');
writeFileSync(statusFile,JSON.stringify([{id:'probe-job',type:'supervise',status:'running',input:{cwd:repo,ticket:'root-fixture'},state:failed.state}]));
writeFileSync(preload,\`import {mock} from 'bun:test';import {readFileSync} from 'node:fs';mock.module(\${JSON.stringify(resolve('lib/daemon.ts'))},()=>({status:async()=>JSON.parse(readFileSync(\${JSON.stringify(statusFile)},'utf8'))}));\`);
const status=execFileSync(process.execPath,['--preload',preload,resolve('ab/main.ts'),'supervise','status','root-fixture'],{cwd:repo,encoding:'utf8',env:process.env});
console.log(JSON.stringify({providerFailure:{mail:failed.messages[0],state:failed.state.children['dead-worker'],sessionSize:statSync(failedPath).size},healthyLongTurn:{mail:healthy.messages,state:healthy.state.children['healthy-worker']},redispatchedHealthyTurn:{mail:redispatched.messages,state:redispatched.state.children['redispatched-worker'],previousSession:redispatchedPreviousPath,currentSession:redispatchedPath},status},null,2));
`);
try {
 const proc = Bun.spawn([process.execPath, script], { cwd: process.cwd(), env: { ...process.env, HOME: root }, stdout: "pipe", stderr: "pipe" });
 const output = await new Response(proc.stdout).text();
 const errors = await new Response(proc.stderr).text();
 const code = await proc.exited;
 if (code !== 0) throw new Error("worker-death fixture failed (" + code + "): " + errors + output);
 process.stdout.write(output);
} finally { rmSync(root, { recursive: true, force: true }); }
