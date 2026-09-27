import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("an exited child is unreachable, not a terminal event to watch repeatedly", async () => {
 const script = `
 import {mock,expect} from 'bun:test';
 let dropped=false;
 const worker={topic:'run/child',handle:'child',drop(){dropped=true;}};
 mock.module(${JSON.stringify(resolve("lib/wm.ts"))},()=>({attach:(run,handle,cwd)=>{expect([run,handle,cwd]).toEqual(['run','child','/other/repository']);return worker;},wait:async()=>new Map([[worker,{kind:'exited',tail:'pane gone'}]])}));
 mock.module(${JSON.stringify(resolve("lib/board/store.ts"))},()=>({readAll:()=>[],readFrom:()=>({messages:[],offset:0}),waitFor:async()=>undefined}));
 mock.module(${JSON.stringify(resolve("lib/board/mailbox.ts"))},()=>({mail:()=>{throw new Error('unexpected mail');}}));
 const {turnEnd}=await import(${JSON.stringify(resolve("lib/children.ts"))});
 const end=await turnEnd(['run/child'],{cwd:'/other/repository'});
 expect(end.kind).toBe('closed');expect(end.unreachable).toBe(true);expect(end.text).toBe('pane gone');expect(dropped).toBe(true);
 `;
 const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
 const errors = await new Response(proc.stderr).text();
 expect({ code: await proc.exited, errors }).toEqual({ code: 0, errors: "" });
});

test("a restarted worker report re-enters the wait without reattaching to its dead pane", async () => {
 const script = `
import {mock,expect} from 'bun:test';
const prior={id:'prior',ts:'2026-09-27T09:25:00.000Z',topic:'run/child',tags:['done'],from:{},body:'old report'};
const restarted={id:'restarted',ts:'2026-09-27T09:35:00.000Z',topic:'run/child',tags:['done'],from:{},body:'done\\nnew report'};
const messages=[prior];let waited=false;
mock.module(${JSON.stringify(resolve("lib/wm.ts"))},()=>({attach:()=>{throw new Error('must not reattach to a dead worker');}}));
mock.module(${JSON.stringify(resolve("lib/board/store.ts"))},()=>({readAll:()=>messages,readFrom:()=>({messages:[...messages],offset:messages.length}),waitFor:async(query,options)=>{expect(query.topic).toBe('run/child');waited=true;messages.push(restarted);return restarted;}}));
mock.module(${JSON.stringify(resolve("lib/board/mailbox.ts"))},()=>({mail:()=>{throw new Error('unexpected mail');}}));
const {waitForTurnEnd}=await import(${JSON.stringify(resolve("lib/children.ts"))});
const first=await waitForTurnEnd(['run/child'],{after:{'run/child':'prior'}});
expect(first).toEqual({id:'run/child',kind:'finished',text:'done\\nnew report',cursor:'restarted'});expect(waited).toBe(true);
const exitedAt=Date.parse('2026-09-27T09:30:00.000Z');
const recovered=await waitForTurnEnd(['run/child'],{after:{'run/child':'wm:exited:'+exitedAt}});
expect(recovered.cursor).toBe('restarted');
`;
 const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
 const errors = await new Response(proc.stderr).text();
 expect({ code: await proc.exited, errors }).toEqual({ code: 0, errors: "" });
});
