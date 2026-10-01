import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("reattachment distinguishes gone threads from live threads and unavailable observations", async () => {
 const script = [
  "import {mock,expect} from \"bun:test\";",
  "let mode=\"open\";",
  "const record={id:\"thread-1\",sessionId:\"session-1\",sessionFile:\"/sessions/current.jsonl\",cwd:\"/other/repo/worker\",project:\"/other/repo\",ownership:\"owner\",worker:{run:\"run\",handle:\"worker\"},archived:false,created:new Date().toISOString()};",
  "const rows=()=>[{thread:record,state:\"idle\",pid:process.pid,terminals:mode===\"open\"?[{name:\"thread-1.agent\",role:\"agent\"}]:[]}];",
  "const checked=()=>{if(mode===\"offline\"||mode===\"malformed\")throw new Error(mode);};",
  "const original=await import(THREAD_PATH);",
  "mock.module(THREAD_PATH,()=>({...original,",
  " workerThread:async(handle,cwd,run)=>{expect([handle,cwd,run]).toEqual([\"worker\",\"/other/repo\",\"run\"]);checked();return mode===\"missing\"?undefined:record;},",
  " getThread:async()=>{checked();return record;},",
  " listThreads:async()=>{checked();return rows();},",
  " threadSnapshot:async()=>{checked();return rows()[0];},",
  " historyThread:async()=>\"\",",
  "}));",
  "const {attach,wait}=await import(WM_PATH);",
  "const w=attach(\"run\",\"worker\",\"/other/repo\");",
  "try{",
  " await w.observe(rows());expect((await wait([w],{timeoutMs:5})).size).toBe(0);",
  " for(const state of [\"offline\",\"malformed\"]){",
  "  mode=state;await expect(w.status()).rejects.toThrow();await expect(w.observe(rows())).rejects.toThrow();",
  "  expect((await wait([w],{timeoutMs:5})).size).toBe(0);",
  " }",
  " mode=\"closed\";await w.observe(rows());expect((await w.next()).kind).toBe(\"exited\");",
  "}finally{w.drop();}",
  "const absent=attach(\"run\",\"worker\",\"/other/repo\");",
  "try{mode=\"missing\";await absent.observe([]);expect((await absent.next()).kind).toBe(\"exited\");}finally{absent.drop();}",
 ].join("\n").replaceAll("THREAD_PATH", JSON.stringify(resolve("lib/thread/index.ts"))).replaceAll("WM_PATH", JSON.stringify(resolve("lib/wm.ts")));
 const child = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
 const errors = await new Response(child.stderr).text();
 expect({ code: await child.exited, errors }).toEqual({ code: 0, errors: "" });
});
