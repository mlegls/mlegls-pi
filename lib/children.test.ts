import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("an exited child is unreachable, not a terminal event to watch repeatedly", async () => {
 const script = `
 import {mock,expect} from 'bun:test';
 let dropped=false;
 const worker={topic:'run/child',handle:'child',drop(){dropped=true;}};
 mock.module(${JSON.stringify(resolve("lib/wm.ts"))},()=>({attach:(run,handle,cwd)=>{expect([run,handle,cwd]).toEqual(['run','child','/other/repository']);return worker;},wait:async()=>new Map([[worker,{kind:'exited',tail:'pane gone'}]])}));
 mock.module(${JSON.stringify(resolve("lib/board/store.ts"))},()=>({readAll:()=>[]}));
 mock.module(${JSON.stringify(resolve("lib/board/mailbox.ts"))},()=>({mail:()=>{throw new Error('unexpected mail');}}));
 const {turnEnd}=await import(${JSON.stringify(resolve("lib/children.ts"))});
 const end=await turnEnd(['run/child'],{cwd:'/other/repository'});
 expect(end.kind).toBe('closed');expect(end.unreachable).toBe(true);expect(end.text).toBe('pane gone');expect(dropped).toBe(true);
 `;
 const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
 const errors = await new Response(proc.stderr).text();
 expect({ code: await proc.exited, errors }).toEqual({ code: 0, errors: "" });
});
