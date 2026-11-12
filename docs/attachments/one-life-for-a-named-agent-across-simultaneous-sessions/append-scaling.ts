// Replay: bun docs/attachments/one-life-for-a-named-agent-across-simultaneous-sessions/append-scaling.ts
// Time of a life append that re-offers a session's whole branch (as every turn end does), by branch length.

import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
process.env.PI_BOARD_DIR = mkdtempSync(join(tmpdir(), "life-perf-"));
const { lifeLog, lifeMessages } = await import(import.meta.dir + "/../../../extensions/context/life/log.ts");
const { present } = await import(import.meta.dir + "/../../../extensions/context/life/present.ts");
const mk = (n:number)=>Array.from({length:n},(_,i)=>({type:"message",id:"e"+i,parentId:i?"e"+(i-1):null,timestamp:"2026-10-08T00:00:00Z",message:i%2?{role:"assistant",content:[{type:"text",text:"hello "+i}],stopReason:"stop"}:{role:"user",content:"q "+i}})) as any;
const log = lifeLog("/perf"); const p = present("/perf");
for (const n of [500, 2000, 8000]) {
  const b = mk(n);
  let t=performance.now(); log.append(lifeMessages(b,{session:"s"+n,place:"x",model:"m",selfThreads:p.threads()})); const first=performance.now()-t;
  t=performance.now(); log.append(lifeMessages(b,{session:"s"+n,place:"x",model:"m",selfThreads:p.threads()})); const again=performance.now()-t;
  console.log(n,"first",first.toFixed(0),"ms; re-append (every turn end)",again.toFixed(0),"ms");
}
for (let i=0;i<3000;i++){ p.start({id:"r"+i,time:new Date().toISOString(),session:"s"+(i%5),thread:"t"+(i%5),sessionFile:"/x",pid:1}); p.end("r"+i); }
let t=performance.now(); p.threads(); console.log("threads() after 3000 runs",(performance.now()-t).toFixed(0),"ms");
{ let t=performance.now(); const all=log.read(); console.log("read all", all.length, (performance.now()-t).toFixed(0),"ms");
  t=performance.now(); log.read(all.length-5); console.log("read tail",(performance.now()-t).toFixed(0),"ms"); }
