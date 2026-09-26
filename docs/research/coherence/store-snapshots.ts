// Inspect copied Chronicle stores only. Never compile or invoke a memory model.
// These snapshots retain summary provenance, not the exact provider-visible prompt.
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { JsStore } = await import(process.cwd() + '/node_modules/@animalabs/chronicle/index.js');
const root='/tmp/coherence-audit';
const cases=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8')).filter((r:any)=>r.cohort==='trial');
const {Glob}=await import('bun');
for (const sid of new Set(cases.map((r:any)=>r.sid))) {
 const subset=cases.filter((r:any)=>r.sid===sid); const model=subset[0].model;
 const source=Array.from(new Glob(`**/_sessions/${sid}/${model}/store`).scanSync({cwd:process.env.HOME+'/.pi/agent/connectome',onlyFiles:false,absolute:true}))[0];
 if (!source) throw new Error('Missing store '+sid);
 const temp=mkdtempSync('/tmp/coherence-store-'); cpSync(source,join(temp,'store'),{recursive:true});rmSync(join(temp,'store','LOCK'),{force:true});
 const store=JsStore.open({path:join(temp,'store')});
 try {
  const records=store.query({});
  for(const r of subset){
   const seq=records.filter((x:any)=>x.timestamp/1e6<=r.start).at(-1)?.sequence;
   if(seq===undefined)throw new Error('No historic sequence '+r.case);
   const states:any={};
   for(const st of store.listStates()) if(/summaries|resolutions|chunks|^messages$/.test(st.id)) states[st.id]=store.getStateJsonAt(st.id,seq);
   writeFileSync(join(root,r.case+'-store.json'),JSON.stringify({source,seq,start:r.start,recovery:store.recovery(),states}));
   console.log(r.case,seq,Object.fromEntries(Object.entries(states).map(([k,v]:any)=>[k,Array.isArray(v)?v.length:Object.keys(v??{}).length])));
  }
 }finally{store.close();rmSync(temp,{recursive:true});}
}
