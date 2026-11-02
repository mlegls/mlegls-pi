
const fs=require("fs"),cp=require("child_process"),path=require("path");
const root="/tmp/code-refresh-jROM3F";
const fx=JSON.parse(fs.readFileSync(root+"/fixture.json","utf8"));
const sp=fx.cwd+"/.git/reconcile/solo.json";
const st=JSON.parse(fs.readFileSync(sp,"utf8"));
process.kill(st.pid,"SIGTERM");
await Bun.sleep(1500);
fs.mkdirSync(root+"/blocker/sub",{recursive:true});
const head=cp.execFileSync("git",["-C",fx.cwd,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
const h={run:"solo",handle:"ghost-implement-1",path:root+"/gone",bb:"bbt-ghost"};
st.landed.ghost={head,into:fx.cwd,at:new Date().toISOString()};
st.landingOps.ghost={slug:"ghost",into:fx.cwd,destination:fx.cwd,before:head,worker:h,preparedHead:head,carried:[],result:{},workers:[],collector:{path:root+"/blocker",branch:"nobranch",parentBranch:"main"},landedHead:head,at:new Date().toISOString()};
fs.writeFileSync(sp,JSON.stringify(st,null,1));
cp.execFileSync(process.execPath,[fx.code+"/lib/reconcile/main.ts","start","solo","--owner","thr_fixture","--budget","1","--cwd",fx.cwd],{env:{...fx.env,PI_RECONCILE_TICK_MS:"60000"}});
console.log("started");
