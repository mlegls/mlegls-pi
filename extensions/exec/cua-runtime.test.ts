import { expect, test } from "bun:test";
import * as sdk from "@trycua/cua-driver";
import recording from "./fixtures/cua-direct-textedit.json";
import { createCuaRuntime } from "./cua-runtime";
import { run, type UI } from "../../lib/computer";
import { computerUseTools } from "./computer-use";

// Replay docs/guide/cua-background.md through the real runner, adapter and Jev HTTP client.
// Only the desktop and model service are replaced by their captured responses.
test("Cua-native Jev replacement ends on driver verification, not its choice", async () => {
 const records=structuredClone(recording.record);
 const requests: any[]=[];
 const server=Bun.serve({port:0,async fetch(request){requests.push(await request.json());return Response.json(recording.choice);}});
 const runtime=createCuaRuntime(sdk,()=>({
  async callTool(method: string,argsJson: string) {
   const next=records.shift()!;const {session,...args}=JSON.parse(argsJson);
   expect({method,args}).toEqual({method:next.method,args:next.args});
   return {rawJson:JSON.stringify(next.response)};
  }, async shutdown() {},
 }) as any);
 const ui=Object.fromEntries(Object.keys(computerUseTools).map(method=>[method,(args:any)=>runtime.call(method,args)])) as UI;
 try {
  const result=await run({ui,apps:["TextEdit"],windows:[recording.target],capture:{query:"Cua direct"},goal:"Replace the TextEdit document body with the supplied replacement",until:"The document body is exactly Cua direct replacement works",inputs:{replacement:"Cua direct replacement works"},
   decision:{url:server.url.href,apiKey:"local-recording"},
   verify:async()=>{const v=await ui.verify_state({...recording.target,expect:[{element:{selector:{role:"AXTextArea"},value_equals:"Cua direct replacement works"}}],timeout_ms:0,stable_samples:1});return {source:"driver",result:v.structuredContent.status,evidence:v.structuredContent};},
  });
  expect(result.status).toBe("done");
  expect(result.trace.map(e=>e.status)).toEqual(["continue","done"]);
  expect(result.trace[0].showing).toBeLessThan(0.75);
  expect(result.trace[0].selected!.action.method).toBe("set_value");
  expect(result.trace[0].selected!.action.args.value).toBe("Cua direct replacement works");
  expect(result.trace[1].completion).toBe("driver");
  expect(result.trace[1].verification?.result).toBe("satisfied");
  expect(result.trace[1].decision).toBeUndefined();
  expect(requests).toHaveLength(1);
  expect(JSON.stringify(requests[0])).not.toContain("element_token");
  expect(JSON.stringify(requests[0])).not.toContain("set_value");
  const old=result.trace[0].selected!.action.args;
  await expect(ui.set_value(old)).rejects.toThrow("Stale or missing Cua observation");
  await runtime.reset();
  await expect(ui.set_value(old)).rejects.toThrow("Stale or missing Cua observation");
  expect(records).toHaveLength(0);
 } finally {await runtime.close();server.stop(true);}
});
