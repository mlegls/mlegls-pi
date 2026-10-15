#!/usr/bin/env bun
import {spawnSync} from "node:child_process";
import {readFileSync, appendFileSync, existsSync, unlinkSync} from "node:fs";
const args=process.argv.slice(2), input=args.includes("-")?readFileSync(0,"utf8"):undefined;
const payload=input?JSON.parse(input):{}, operation=payload.query?.match(/(?:query|mutation)\s+(\w+)/)?.[1]??"REST";
appendFileSync(process.env.ENCOUNTER_CALLS!,operation+"\n");
const result=spawnSync(process.env.ENCOUNTER_GH!,args,{input,encoding:"utf8"});
const flag=process.env.ENCOUNTER_LOSS!;
if(result.status===0&&existsSync(flag)&&operation==="TrackerCreate"){unlinkSync(flag);process.stderr.write("deliberately lost successful create response\n");process.exit(70);}
if(result.status===0&&existsSync(flag+".comment")&&operation==="TrackerWrite"&&payload.query.includes("addComment")){unlinkSync(flag+".comment");process.stderr.write("deliberately lost successful comment response\n");process.exit(70);}
if(result.status===0&&existsSync(flag+".detach")&&operation==="REST"&&args.includes("DELETE")&&args.some(arg=>arg.endsWith("/sub_issue"))){unlinkSync(flag+".detach");process.stderr.write("deliberately lost successful detach response\n");process.exit(70);}
if(result.status===0&&existsSync(flag+".release")&&operation==="TrackerWrite"&&payload.query.includes("removeAssigneesFromAssignable")){unlinkSync(flag+".release");process.stderr.write("deliberately lost successful release response\n");process.exit(70);}
process.stdout.write(result.stdout??"");process.stderr.write(result.stderr??"");process.exit(result.status??1);
