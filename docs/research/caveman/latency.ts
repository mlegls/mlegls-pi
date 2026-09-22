// Cold/warm transport probe; source fixtures are the recorded architecture encounter.
// bun docs/research/caveman/latency.ts > /tmp/jev-latency.jsonl
import {readFileSync,writeFileSync} from 'node:fs';
import {lookup} from 'node:dns/promises';
const r=JSON.parse(readFileSync(new URL('retention.json', import.meta.url),'utf8'));
const full={model:'jev-1.13.0',state:r.selections[1].state,questions:r.selections[1].questions};
const tiny={model:'jev-1.13.0',state:'The sky is blue.',questions:{blue:{type:'noul',instructions:'Is the sky described as blue?'}}};
writeFileSync('/tmp/jev-full.json',JSON.stringify(full));writeFileSync('/tmp/jev-tiny.json',JSON.stringify(tiny));
console.log(JSON.stringify({runtime:process.version,bun:Bun.version,dns:await lookup('api.typesafe.ai',{all:true})}));
for(const [name,payload] of [['tiny-cold',tiny],['tiny-warm',tiny],['full',full],['full-repeat',full]] as const){
 const t=performance.now(); const res=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:'Bearer '+process.env.JEV_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});const headersMs=performance.now()-t; const body=await res.json(); console.log(JSON.stringify({name,status:res.status,headersMs,totalMs:performance.now()-t,headers:Object.fromEntries(res.headers),body}));
}
