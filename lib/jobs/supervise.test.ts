import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Isolate module mocks from other tests. Git/worktrees/commits and the loop are real;
// worker transport and tracker discovery are fixtures. No daemon or live agents.
test("supervision closes on branches, serializes integration, and retains failed or missing children", async () => {
 const root = mkdtempSync(join(tmpdir(), "supervise-test-"));
 const tracker = join(root, ".pi/agent/skills/tracker/scripts");
 mkdirSync(tracker, { recursive: true });
 writeFileSync(join(tracker, "issues.ts"), `
 import {readdirSync,readFileSync} from 'node:fs';import {join} from 'node:path';
 const dir=join(process.cwd(),'docs/issues');
 console.log(JSON.stringify(process.argv.includes('lint')?{reports:[]}:{issues:readdirSync(dir).map(name=>{const t=readFileSync(join(dir,name),'utf8');return {slug:name.slice(0,-3),file:join(dir,name),partOf:/part-of: (\\S+)/.exec(t)?.[1]??'root-'+name.slice(0,-3),frontier:false,done:t.includes('stage: done'),effectiveStage:/stage: (\\w+)/.exec(t)?.[1]??'ticket'};})}));
 `);
 const script = join(root, "probe.ts");
 writeFileSync(script, `
 import {mock,expect} from 'bun:test';
 import {mkdirSync,writeFileSync,existsSync,readFileSync,symlinkSync,chmodSync} from 'node:fs';
 import {join} from 'node:path';import {execFileSync} from 'node:child_process';
 const root=${JSON.stringify(root)}, main=join(root,'main');
 const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:'pipe'}).trim();
 mkdirSync(main);git(main,'init','-q','-b','main');git(main,'config','user.name','test');git(main,'config','user.email','test@example.invalid');
 mkdirSync(join(main,'docs/issues'),{recursive:true});
 for(const s of ['a','b','c','d','e','f'])writeFileSync(join(main,'docs/issues',s+'.md'),'---\\nstage: ticket\\n---\\n');
writeFileSync(join(main,'docs/issues/g.md'),'---\\nstage: ticket\\n---\\n');
writeFileSync(join(main,'docs/issues/h.md'),'---\\nstage: ticket\\n---\\n');
 mkdirSync(join(main,'docs/attachments'),{recursive:true});
 for(const s of ['a','b','c','d','f'])writeFileSync(join(main,'docs/attachments',s+'.md'),'First-use evidence for '+s);
 git(main,'add','.');git(main,'commit','-qm','Initial');
 const paths={};for(const s of ['a','b','c','d','f']){paths[s]=join(root,s);git(main,'worktree','add','-qb',s,paths[s]);writeFileSync(join(paths[s],s),s);git(paths[s],'add',s);git(paths[s],'commit','-qm','Implement '+s);}
paths.g=join(root,'g');git(main,'worktree','add','-qb','g',paths.g);writeFileSync(join(paths.g,'g'),'g');git(paths.g,'add','g');git(paths.g,'commit','-qm','Implement g');
paths.h=join(root,'h');git(main,'worktree','add','-qb','h',paths.h);writeFileSync(join(paths.h,'h'),'h');git(paths.h,'add','h');git(paths.h,'commit','-qm','Implement h');
 paths.e=join(root,'already-retired');
 const real=await import(${JSON.stringify(resolve("lib/dispatch.ts"))});const integrate=real.integrate;
 let active=0,max=0;const saved={},retired=[],controls=new Map(),messages=[],waitIds=[],turns=[];
 const reportCases=new Map(), routed=[];
 const launchFixture=async(specs,options)=>({submitted:[{run:options.run,handle:specs[0].handle,path:paths['case-join']} ]});
 mock.module(${JSON.stringify(resolve("lib/route.ts"))},()=>({prepareRole:async()=>({kind:'ready',agent:'test'})}));
 mock.module(${JSON.stringify(resolve("lib/dispatch.ts"))},()=>({...real,dispatch:launchFixture,integrate:async(...args)=>{active++;max=Math.max(max,active);try{await new Promise(r=>setTimeout(r,20));return await integrate(...args);}finally{active--;}},retire:async h=>{expect(saved[h.handle].children[h.handle]).toBeUndefined();expect(saved[h.handle].integrated.includes(h.handle)||!!saved[h.handle].decomposed?.includes(h.handle)).toBe(true);expect(existsSync(h.path)).toBe(true);expect(git(main,'rev-parse','HEAD')).toBe(git(h.path,'rev-parse','HEAD'));retired.push(h.handle);return {};}}));
 mock.module(${JSON.stringify(resolve("lib/children.ts"))},()=>({
  turnEnd:async (ids,options)=>{
   turns.push(ids[0]);
   const id=ids[0];
   if(reportCases.has(id)) {const queue=reportCases.get(id);if(!queue.length)throw new Error('Unexpected extra report request: '+id);return {id,kind:'finished',cursor:'case-'+queue.length,text:queue.shift()};}
   if(id.endsWith('/h')){
    if(turns.filter(turn=>turn===id).length===1)return {id,kind:'finished',cursor:'checkpoint',text:'checkpoint'+String.fromCharCode(10)+'intermediate report'};
    return await new Promise((_,reject)=>{if(options.signal.aborted)reject(new Error('aborted'));else options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
   }
   const fence=String.fromCharCode(96).repeat(3);
   if(id.endsWith('/a') && turns.filter(t=>t===id).length===1)return {id,kind:'finished',cursor:'bad-'+turns.length,text:'done'+String.fromCharCode(10)+fence+'json'+String.fromCharCode(10)+JSON.stringify({stories:[{story:'sample',outcome:'held'}],evidence:{path:'docs/attachments/a.md',visual:true,updated:true}})+String.fromCharCode(10)+fence};
   return {id,kind:'finished',cursor:'done',text:'done'+String.fromCharCode(10)+fence+(id.endsWith('/g')?'yaml':'json')+String.fromCharCode(10)+(id.endsWith('/g')?'plain scalar containing {rows: [2, 3, 5], total: 10}':JSON.stringify({stories:[{story:'sample',outcome:'held'}],evidence:{path:'docs/attachments/'+id.split('/').pop()+'.md',visual:false,shots:[]}}))+String.fromCharCode(10)+fence};
  },
  waitForTurnEnd:async(ids,options)=>{waitIds.push(ids[0]);if(ids[0].endsWith('/f'))return {id:ids[0],kind:'finished',cursor:'restart-report',text:'done'};return await new Promise((_,reject)=>{if(options.signal.aborted)reject(new Error('aborted'));else options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});},
  last:async()=>null,
  send:async(owner,text)=>{
   routed.push({to:owner,text});messages.push(text);
   // Stop a wrong second bounce too, so a retry-budget regression fails without hanging.
   if(reportCases.has(owner)&&routed.filter(m=>m.to===owner).length>=2)controls.get(owner.split('/').pop().replace(/-consolidate$/,'')).abort();
   if(!controls.has(owner))return;
   if(owner.startsWith('case-'))controls.get(owner).abort();
   else if(text.includes('checkpoint from'))setTimeout(()=>controls.get(owner).abort(),50);
   else if(text.includes('integration failed')||text.includes('verification')||text.includes('loop error')||text.includes('handoff block did not parse')||text.includes('decomposed with'))controls.get(owner).abort();
  }
 }));
 const {run}=await import(${JSON.stringify(resolve("lib/jobs/supervise.ts"))});
 const {parse}=await import(${JSON.stringify(resolve("lib/report.ts"))});
 async function loop(s,cwd=main,test='test -f '+s,initial){
  const control=new AbortController();controls.set(s,control);
  const commands=join(root,s+'.commands');writeFileSync(commands,'');
  const state=initial??{children:{[s]:{slug:s,phase:'verify',handle:{run:'root-'+s,handle:s,path:paths[s]}}},integrated:[],metrics:{wakes:0,ownerBytes:0,launched:0,completed:0}};
  await run({id:s,input:{ticket:'root-'+s,cwd,owner:s,ownerSession:'test-parent',budget:1,test,commands},state,signal:control.signal,save:async x=>{saved[s]=structuredClone(x);},log:()=>{}});
 }
 const alias=join(root,'alias');symlinkSync(main,alias);
 await Promise.all([loop('a'),loop('b',alias)]);
 expect(messages.filter(m=>m.startsWith('invalid evidence handoff:'))).toHaveLength(1);
 expect(saved.a.metrics.completed).toBe(1);
 expect(max).toBe(1);expect(retired.sort()).toEqual(['a','b']);
 for(const s of ['a','b']){expect(readFileSync(join(main,'docs/issues',s+'.md'),'utf8')).toContain('stage: done');expect(saved[s].finished).toBe(true);expect(git(main,'log','--format=%s')).toContain('Close '+s);}
 await loop('f',main,'true',{children:{f:{slug:'f',phase:'supervise',handle:{run:'root-f',handle:'f',path:paths.f},cursor:'wm:exited:'+Date.parse('2026-09-27T09:30:00.000Z'),unreachable:true,waiting:'unreachable'}},integrated:[],metrics:{wakes:0,ownerBytes:0,launched:0,completed:0}});
 expect(saved.f.finished).toBe(true);expect(saved.f.integrated).toContain('f');expect(readFileSync(join(main,'docs/issues/f.md'),'utf8')).toContain('stage: done');expect(waitIds.filter(id=>id==='root-f/f')).toHaveLength(1);
 const head=git(main,'rev-parse','HEAD');
 await loop('c',main,'echo failure >&2; exit 1');
 expect(git(main,'rev-parse','HEAD')).toBe(head);expect(saved.c.children.c.waiting).toBe('integration failed');expect(readFileSync(join(paths.c,'docs/issues/c.md'),'utf8')).toContain('stage: ticket');expect(retired).not.toContain('c');
await loop('g');expect(saved.g.children.g.waiting).toContain('handoff block did not parse:');expect(messages.some(m=>m.includes('handoff block did not parse:'))).toBe(true);
await loop('h');expect(saved.h.children.h.waiting).toBe('checkpoint');expect(turns.filter(id=>id==='root-h/h')).toHaveLength(2);expect(messages.some(m=>m.includes('checkpoint from review h:')&&m.includes('intermediate report'))).toBe(true);expect(saved.h.children.h.unreachable).toBeUndefined();
 const hooks=join(root,'hooks');mkdirSync(hooks);writeFileSync(join(hooks,'pre-commit'),'#!/bin/sh\\nexit 1\\n');chmodSync(join(hooks,'pre-commit'),0o755);git(main,'config','core.hooksPath',hooks);
 await loop('d');expect(git(main,'rev-parse','HEAD')).toBe(head);expect(saved.d.children.d.waiting).toBe('integration failed');expect(existsSync(paths.d)).toBe(true);expect(git(paths.d,'status','--porcelain')).toContain('docs/issues/d.md');expect(retired).not.toContain('d');
 const stopE=setTimeout(()=>controls.get('e').abort(),100);await loop('e');clearTimeout(stopE);expect(saved.e.children.e.unreachable).toBe(true);expect(messages.filter(m=>m.includes('unreachable'))).toHaveLength(1);expect(waitIds.filter(id=>id==='root-e/e')).toHaveLength(1);
 // Adoption: a review worker launched outside this loop, already finished, is taken from its report through integration.
 git(main,'config','--unset','core.hooksPath');
 writeFileSync(join(main,'docs/issues/i.md'),'---\\nstage: ticket\\n---\\n');writeFileSync(join(main,'docs/attachments/i.md'),'First-use evidence for i');git(main,'add','.');git(main,'commit','-qm','Add i');
 paths.i=join(root,'main__worktrees','i');git(main,'worktree','add','-qb','i',paths.i);writeFileSync(join(paths.i,'i'),'i');git(paths.i,'add','i');git(paths.i,'commit','-qm','Implement i');
 {const control=new AbortController();controls.set('i',control);const commands=join(root,'i.commands');
  writeFileSync(commands,JSON.stringify({child:'i',action:'adopt',phase:'review',handles:[{run:'root-i',handle:'i'}]})+String.fromCharCode(10));
  await run({id:'i',input:{ticket:'root-i',cwd:main,owner:'i',ownerSession:'test-parent',budget:1,test:'test -f i',commands,commandsApplied:0},state:null,signal:control.signal,save:async x=>{saved.i=structuredClone(x);},log:()=>{}});}
 expect(saved.i.integrated).toEqual(['i']);expect(readFileSync(join(main,'docs/issues/i.md'),'utf8')).toContain('stage: done');expect(retired).toContain('i');
 // Decomposition: a spec leaf's implementer commits children instead of a change; only the tracker lands, unreviewed.
 for(const s of ['j','k'])writeFileSync(join(main,'docs/issues',s+'.md'),'---\\nstage: spec\\n---\\n');git(main,'add','.');git(main,'commit','-qm','Add j k');
 for(const s of ['j','k']){paths[s]=join(root,s);git(main,'worktree','add','-qb',s,paths[s]);writeFileSync(join(paths[s],'docs/issues',s+'1.md'),'---\\nstage: ticket\\npart-of: '+s+'\\n---\\n');git(paths[s],'add','.');git(paths[s],'commit','-qm','Decompose '+s);}
 writeFileSync(join(paths.k,'k'),'k');git(paths.k,'add','k');git(paths.k,'commit','-qm','Also code');
 const implementing=s=>({children:{[s]:{slug:s,phase:'implement',handle:{run:'root-'+s,handle:s,path:paths[s]}}},integrated:[],metrics:{wakes:0,ownerBytes:0,launched:0,completed:0}});
 await loop('j',main,'true',implementing('j'));
 expect(saved.j.decomposed).toEqual(['j']);expect(saved.j.integrated).toEqual([]);expect(existsSync(join(main,'docs/issues/j1.md'))).toBe(true);expect(retired).toContain('j');expect(readFileSync(join(main,'docs/issues/j.md'),'utf8')).toContain('stage: spec');
 await loop('k',main,'true',implementing('k'));
 expect(existsSync(join(main,'docs/issues/k1.md'))).toBe(false);expect(saved.k.children.k.waiting).toContain('decomposed with changes outside the tracker (k)');expect(retired).not.toContain('k');
 // Replays checks 1–4 from docs/attachments/bounce-handoff-shape-errors-to-the-child/index.md.
 // Observe report/mail boundaries, not validator internals; the supervisor and Git are real.
 const fence=String.fromCharCode(96).repeat(3), nl=String.fromCharCode(10);
 const report=h=>'done'+nl+fence+'json'+nl+JSON.stringify(h)+nl+fence;
 for(const kind of ['late','stories','evidence','yaml','failed','unobservable','corrected']) {
  const s='case-'+kind,id='root-'+s+'/'+s;
  writeFileSync(join(main,'docs/issues',s+'.md'),'---'+nl+'stage: ticket'+nl+'---'+nl);
  writeFileSync(join(main,'docs/attachments',s+'.md'),'Report routing evidence');git(main,'add','.');git(main,'commit','-qm','Add '+s);
  paths[s]=join(root,s);git(main,'worktree','add','-qb',s,paths[s]);
  const valid={stories:[{story:'sample',outcome:'held'}],evidence:{path:'docs/attachments/'+s+'.md',visual:false,shots:[]}};
  const malformed={
   late:report(valid).replace('done'+nl,'')+nl+'done',
   corrected:report(valid).replace('done'+nl,'')+nl+'done',
   stories:report({...valid,stories:['sample']}),
   evidence:report({...valid,evidence:valid.evidence.path}),
   yaml:'done'+nl+fence+'yaml'+nl+'stories:'+nl+'  - "quoted phrase" trailing words'+nl+fence,
   failed:report({...valid,stories:[{story:'sample',outcome:'failed'}]}),
   unobservable:report({...valid,stories:[{story:'sample',outcome:'unobservable'}]})
  }[kind];
  const truthful=['failed','unobservable'].includes(kind);
  reportCases.set(id,truthful?[malformed]:[malformed,kind==='corrected'?report(valid):malformed]);
  const start=routed.length;
  await loop(s,main,'true');
  const mail=routed.slice(start);
  if(truthful){
   expect(mail).toHaveLength(1);expect(mail[0].to).toBe(s);expect(mail[0].text).toContain('outcome is "'+kind+'"');
  } else {
   expect(mail[0].to).toBe(id);
   const diagnostic={late:'first nonblank line',corrected:'first nonblank line',stories:'stories[0] is a string; expected {story, outcome}',evidence:'evidence is a string; expected {path, visual, shots}',yaml:'at line 2, column'}[kind];
   expect(mail[0].text).toContain(diagnostic);
   for(const field of ['docs/verification-evidence.md','stories:','outcome:','evidence:','path:','visual:','shots:','tests:','caveats:'])expect(mail[0].text).toContain(field);
   const example=parse(mail[0].text).handoff;
   expect(example.stories[0].outcome).toBe('held');expect(example.evidence).toMatchObject({visual:false,shots:[]});
   expect(mail[0].text).toContain('Do not invent evidence');
   if(kind==='corrected'){
    expect(saved[s].integrated).toContain(s);expect(mail.filter(m=>m.to===s&&m.text.includes('still invalid'))).toHaveLength(0);
   } else {
    expect(mail).toHaveLength(2);expect(mail[1].to).toBe(s);expect(mail[1].text).toContain('still invalid');expect(mail[1].text).toContain(diagnostic);
   }
  }
  console.log(JSON.stringify({scenario:kind,mail}));
 }
 // The corrected-report expectation also applies when a join driver hands off to a new consolidator.
 {
  const s='case-join',id='root-'+s+'/'+s,next=id+'-consolidate';
  paths[s]=join(root,s);git(main,'worktree','add','-qb',s,paths[s]);
  const bad=report({stories:['sample']}), fixed=report({stories:[{story:'sample',outcome:'failed'}]});
  reportCases.set(id,[bad,fixed]);reportCases.set(next,[bad,bad]);
  const start=routed.length;
  await loop(s,main,'true',{children:{[s]:{slug:s,phase:'drive',handle:{run:'root-'+s,handle:s,path:paths[s]}}},join:{key:s,drive:true},integrated:[],metrics:{wakes:0,ownerBytes:0,launched:0,completed:0}});
  const mail=routed.slice(start);
  expect(mail.map(m=>m.to)).toEqual([id,next,s]);
  expect(mail[1].text).toContain('stories[0] is a string');expect(mail[2].text).toContain('still invalid after two reports');
  console.log(JSON.stringify({scenario:'join-new-child-budget',mail}));
 }
 console.log('parallel closures, failed tests, failed close hook, missing carried worktree: passed');
 `);
 try {
  const proc = Bun.spawn([process.execPath, script], { env: { ...process.env, HOME: root }, stdout: "pipe", stderr: "pipe" });
  const output = await new Response(proc.stdout).text();
  const errors = await new Response(proc.stderr).text();
  expect({ code: await proc.exited, errors }).toEqual({ code: 0, errors: "" });
  expect(output).toContain("missing carried worktree: passed");
  console.log(output);
 } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
