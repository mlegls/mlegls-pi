import { expect, test } from "bun:test";
import cuaRecording from "./fixtures/cua-direct-textedit.json";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel, type KernelNotification, type KernelOptions } from "./kernel";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { install as sessionExtension } from "../../lib/session/host";
import { TmuxTerminalManager, terminalServerName, tmuxAvailable } from "../../lib/session/tmux";
import { createComputerUseBridge } from "./computer-use";
import { createExecServices, type ExecServices } from "./services";

async function fixture(run: (kernel: Kernel, cwd: string, notices: KernelNotification[]) => Promise<void>, call?: KernelOptions["call"]) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-migration-"));
	const notices: KernelNotification[] = [];
	const kernel = new Kernel({ cwd, ledger: [], persist() {}, call, onNotification: n => notices.push(n) });
	try { await run(kernel, cwd, notices); }
	finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}

async function cell(kernel: Kernel, code: string) {
	const result = await kernel.execute(code);
	if (result.error) throw new Error(result.error);
	return result;
}

async function until(predicate: () => boolean) {
	const deadline = Date.now() + 5000;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Expected host event within 5s");
		await Bun.sleep(10);
	}
}

test("shell results remain queryable while show and notify render literal streams, not object inspection", () => fixture(async (kernel, _cwd, notices) => {
	const command = "printf 'first\\nsecond\\n'; printf 'warning one\\nwarning two\\n' >&2; exit 7";
	expect((await cell(kernel, `state.shellJob = sh(${JSON.stringify(command)}); state.shellResult = await state.shellJob;`)).output).toBe("");
	const shown = (await cell(kernel, "await show(state.shellResult);")).output;
	expect(shown).toContain("first\nsecond\n");
	expect(shown).toContain("warning one\nwarning two\n");
	expect(shown).toMatch(/(?:exit|code)[^\n]*7/i);
	expect((await cell(kernel, "show(JSON.stringify([state.shellResult.stdout, state.shellResult.stderr, state.shellResult.exitCode, state.shellResult.stdoutTruncated, state.shellResult.stderrTruncated]));")).output.trim()).toBe(JSON.stringify(["first\nsecond\n", "warning one\nwarning two\n", 7, false, false]));
	const ordinary = (await cell(kernel, "show({...state.shellResult});")).output;
	expect(ordinary).toContain("stdout:");
	expect(ordinary).toContain("first\\nsecond\\n");
	await cell(kernel, 'notify(state.shellJob, "shell-report");');
	await until(() => notices.length === 1);
	expect(notices[0].label).toBe("shell-report");
	expect(notices[0].output.trimEnd()).toBe(shown.trimEnd());

	await cell(kernel, `state.largeShell = await sh(${JSON.stringify("node -e 'process.stdout.write(\"x\".repeat(1100000));process.stderr.write(\"y\".repeat(1100000))'")});`);
	expect((await cell(kernel, "show(JSON.stringify([state.largeShell.stdout.slice(0,1048576).length, state.largeShell.stderr.slice(0,1048576).length, state.largeShell.stdoutTruncated, state.largeShell.stderrTruncated]));")).output.trim()).toBe(JSON.stringify([1024 * 1024, 1024 * 1024, true, true]));
	const bounded = (await cell(kernel, "show(state.largeShell);")).output;
	expect(bounded).toMatch(/stdout[^\n]*truncat/i);
	expect(bounded).toMatch(/stderr[^\n]*truncat/i);
	expect(bounded).toContain("[output truncated]");
	expect((await cell(kernel, "show(state.largeShell.stderr.slice(1000000,1000004));")).output).toBe("yyyy\n");
}), 20000);

test("write creates parents and overwrites; retained read anchors still protect intervening writes", () => fixture(async (kernel, cwd) => {
	await cell(kernel, 'await write("nested/example.ts", "const value = 1;\\n"); const original = await read("nested/example.ts"); await edit("=" + original.rows[0].anchor + "\\nconst value = 2;"); state.edited = await read("nested/example.ts");');
	expect(await readFile(join(cwd, "nested/example.ts"), "utf8")).toBe("const value = 2;\n");
	await cell(kernel, 'await write("nested/example.ts", "const value = 3; // 奀\\n");');
	const stale = await kernel.execute('await edit("=" + state.edited.rows[0].anchor + "\\nconst value = 99;");');
	expect(stale.error).toMatch(/stale|changed|read.*again/i);
	expect(await readFile(join(cwd, "nested/example.ts"), "utf8")).toBe("const value = 3; // 奀\n");
	await cell(kernel, 'const fresh = await read("nested/example.ts"); await edit("=" + fresh.rows[0].anchor + "\\nconst value = 4;");');
	expect(await readFile(join(cwd, "nested/example.ts"), "utf8")).toBe("const value = 4;\n");
}), 15000);

// Session lifecycle stays in the host; only the Kernel child is disposable.
test.skipIf(!tmuxAvailable())("term sessions retain shell state across cancelled waits and kernel reset, then wait any/all", async () => {
	const lifecycle = new Map<string, (...args: any[]) => any>();
	const events = new EventEmitter();
	const sessionId = randomUUID();
	const manager = new TmuxTerminalManager(terminalServerName(sessionId));
	let waiting = false, cancelled = false;
	let services: ExecServices;
	const pi = {
		on: (name: string, handler: (...args: any[]) => any) => lifecycle.set(name, handler),
		events,
		sendMessage() {},
		registerCommand() {},
	} as any;
	sessionExtension(pi);
	try {
		await fixture(async (kernel, cwd) => {
			const ctx = { cwd, sessionManager: { getSessionId: () => sessionId, getBranch: () => [] } } as any;
			services = createExecServices(pi, ctx);
			await lifecycle.get("session_start")!({}, ctx);
			await cell(kernel, 'state.terminals = await term.spawn({terminals:[{name:"left",command:"sh"},{name:"right",command:"sh"}]}); await term.send("left", "value=41"); const cursors = Object.fromEntries((await Promise.all(state.terminals.map(t=>term.view(t.id)))).map(t=>[t.id,t.cursor])); state.changed = term.wait({ids:["left","right"],mode:"any",cursors,waitMs:5000});');
			await cell(kernel, 'await term.send("left", "echo answer=$((value+1))", {submit:false}); await term.sendRaw("left", ["Enter"]);');
			const change = JSON.parse((await cell(kernel, 'show(JSON.stringify(await state.changed));')).output);
			expect((await cell(kernel, 'show((await term.view("left")).output);')).output).toContain("answer=42");
			expect(change.changed).toEqual(["left"]);
			expect(change.timedOut).not.toBe(true);
			expect(change.snapshots.find((s: any) => s.id === "right").status).toBe("running");

			waiting = false;
			const controller = new AbortController();
			const pending = kernel.execute('await term.wait({ids:["left","right"],mode:"all",waitMs:30000});', controller.signal);
			await until(() => waiting);
			controller.abort();
			expect((await pending).error).toMatch(/cancel/i);
			await until(() => cancelled);
			expect((await cell(kernel, 'show(typeof state.terminals); show((await term.list()).map(t=>t.id).sort().join(","));')).output).toBe("undefined\nleft,right\n");
			await cell(kernel, 'await term.send("left", "echo survived=$((value+1))");');
			expect((await cell(kernel, 'show((await term.view("left", {lines:50})).output);')).output).toContain("survived=42");
			await cell(kernel, 'await term.send("left", "exit 3"); await term.send("right", "exit 4");');
			const all = JSON.parse((await cell(kernel, 'show(JSON.stringify(await term.wait({ids:["left","right"],mode:"all",waitMs:5000})));')).output);
			expect(all.timedOut).not.toBe(true);
			expect(all.snapshots.map((s: any) => [s.id, s.status, s.exitCode]).sort()).toEqual([["left", "exited", 3], ["right", "exited", 4]]);
			expect((await cell(kernel, 'const ended = await term.end("left"); show(ended.id, ended.ended); await term.end("right"); show((await term.list()).length);')).output).toBe("left true\n0\n");
		}, ({ namespace, method, args, signal }) => {
			if (namespace !== "term") throw new Error("Unexpected namespace " + namespace);
			if (method === "wait") {
				waiting = true;
			}
			return services.call({ namespace, method, args, signal }).finally(() => { if (signal.aborted) cancelled = true; });
		});
	} finally {
		await lifecycle.get("session_shutdown")?.({});
		await manager.killServer();
	}
}, 30000);


const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";

// Native Cua observation from the reviewed TextEdit encounter; ordered image blocks
// retain the existing exec transport checks independently of desktop delivery.
test("Cua results cross Kernel RPC with native tokens, ordered images, errors and lifecycle reset", async () => {
 const observation=cuaRecording.record.find(r=>r.method==="get_window_state")!.response;
 const snapshot=(observation.structuredContent as any).snapshot_id;
 let backendState: string | undefined;
 const lifecycle=new Map<string,(...args:any[])=>any>();
 let releaseLate: (()=>void) | undefined, lateSettled=false;
 const pi={on:(name:string,handler:any)=>lifecycle.set(name,handler),appendEntry(){throw Error("Native snapshots must not be journaled");}} as any;
 let services: ExecServices;
 const requests: any[]=[];
 const bridge=await createComputerUseBridge(pi,()=>({
  async call(method:string,args:any) {
   requests.push({method,args});
   if(method==="get_window_state") {backendState=snapshot;return {...observation,content:[
    {type:"text",text:"TextEdit snapshot " + snapshot},{type:"image",data:pixel,mimeType:"image/png"},
    {type:"text",text:"detail crop"},{type:"image",data:pixel,mimeType:"image/png"},{type:"text",text:"end observation"},
   ]};}
   if(method==="verify_state") return new Promise(resolve=>{releaseLate=()=>{backendState="late";resolve({content:[],structuredContent:{status:"unknown"}});};});
   if(args.snapshot_id!==backendState) throw Error("Stale Cua snapshot; get_window_state again");
   backendState=undefined;
   return {isError:true,content:[{type:"text",text:"Action refused"},{type:"image",data:pixel,mimeType:"image/png"}],structuredContent:{code:"refused"}};
  },async help(){return [];},async reset(){backendState=undefined;},async close(){backendState=undefined;},async setup(){},
 }));
 await fixture(async(kernel,cwd)=>{
  const ctx={cwd,sessionManager:{getSessionId:()=>"cua-migration",getBranch:()=>[]}} as any;
  services=createExecServices(pi,ctx,{ui:bridge});await lifecycle.get("session_start")!({},ctx);
  expect((await cell(kernel,'state.observation=await ui.get_window_state({...'+JSON.stringify(cuaRecording.target)+'});')).content).toEqual([]);
  const shown=await cell(kernel,'await show(state.observation);');
  expect(shown.content.map(c=>c.type)).toEqual(["text","image","text","image","text"]);
  expect(shown.content.filter(c=>c.type==="image")).toEqual([{type:"image",data:pixel,mimeType:"image/png"},{type:"image",data:pixel,mimeType:"image/png"}]);
  const inspected=(await cell(kernel,'show(JSON.stringify(state.observation)); show({...state.observation});')).output;
  expect(inspected).not.toContain(pixel);expect(inspected).toContain(snapshot);expect(inspected).toContain("element_token");
  expect(shown.output).not.toContain(pixel);
  const failed=await kernel.execute('await show(state.observation); await ui.click({...'+JSON.stringify(cuaRecording.target)+',snapshot_id:"missing",element_index:1});');
  expect(failed.error).toContain("Stale Cua snapshot");expect(failed.content.filter(c=>c.type==="image")).toHaveLength(2);
  const refused=await kernel.execute('const s=state.observation.structuredContent; const r=await ui.click({pid:s.pid,window_id:s.window_id,snapshot_id:s.snapshot_id,element_token:s.elements[1].element_token}); show(r.isError,r.structuredContent.code); await show(r);');
  expect(refused.error).toContain("UI operation failed");expect(refused.output).toContain("true refused");expect(refused.content.filter(c=>c.type==="image")).toHaveLength(1);
  expect(requests[2].args.element_token).toBe((observation.structuredContent as any).elements[1].element_token);
  expect((await cell(kernel,'show(typeof ui.findRoots,typeof ui.act,typeof ui.observe);')).output).toBe("undefined undefined undefined\n");
  const controller=new AbortController();
  const pending=kernel.execute('await ui.verify_state({...'+JSON.stringify(cuaRecording.target)+',expect:[]});',controller.signal);
  await until(()=>releaseLate!==undefined);controller.abort();expect((await pending).error).toMatch(/cancel/i);
  const reset=lifecycle.get("session_tree")!({},ctx);releaseLate!();await reset;await until(()=>lateSettled);
  expect((await cell(kernel,'show(typeof state.observation);')).output).toBe("undefined\n");
  expect((await kernel.execute('await ui.click({...'+JSON.stringify(cuaRecording.target)+',snapshot_id:'+JSON.stringify(snapshot)+',element_index:1});')).error).toContain("Stale Cua snapshot");
  await cell(kernel,'await ui.get_window_state({...'+JSON.stringify(cuaRecording.target)+'});');
  await lifecycle.get("session_shutdown")!({},ctx);
 },({namespace,method,args,signal})=>services.call({namespace,method,args,signal}).finally(()=>{if(signal.aborted)lateSettled=true;}));
},20000);
