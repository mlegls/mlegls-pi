import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("reattachment distinguishes closed targets from open targets and unavailable status", async () => {
 const script = `
 import {mock,expect} from 'bun:test';
 import * as cp from 'node:child_process';
 let mode='open';const calls=[];
 mock.module('node:child_process',()=>({...cp,execFile:(cmd,args,opts,cb)=>{
  calls.push({cmd,args,cwd:opts.cwd});
  if(mode==='offline')return cb(Object.assign(new Error('offline'),{code:1}),'','offline');
  if(cmd==='tmux')return cb(null,'','');
  if(mode==='malformed')return cb(null,'invalid json','');
  cb(null,JSON.stringify(args[0]==='status'?{agents:[]}:mode==='missing'?[]:[{handle:'worker',is_open:mode==='open'}]),'');
 }}));
 const {attach,wait,workmuxStatus}=await import(${JSON.stringify(resolve("lib/wm.ts"))});
 const w=attach('run','worker','/other/repo');
 try {
  expect(await workmuxStatus(w.cwd)).toEqual([]);
  await w.observe(undefined,new Map());
  expect((await wait([w],{timeoutMs:5})).size).toBe(0);
  for(const state of ['offline','malformed']){
   mode=state;
   await expect(workmuxStatus(w.cwd)).rejects.toThrow();
   await expect(w.observe(undefined,new Map())).rejects.toThrow();
   expect((await wait([w],{timeoutMs:5})).size).toBe(0);
  }
  mode='closed';await w.observe(undefined,new Map());
  expect((await w.next()).kind).toBe('exited');
  expect(calls.filter(c=>c.cmd==='workmux').every(c=>c.cwd==='/other/repo')).toBe(true);
 }finally{w.drop();}
 const absent=attach('run','worker','/other/repo');
 try{mode='missing';await absent.observe(undefined,new Map());expect((await absent.next()).kind).toBe('exited');}finally{absent.drop();}
 `;
 const child = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
 const errors = await new Response(child.stderr).text();
 expect({ code: await child.exited, errors }).toEqual({ code: 0, errors: "" });
});
