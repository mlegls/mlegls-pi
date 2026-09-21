import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ExtensionRunner, SessionManager, wrapRegisteredTools } from "@earendil-works/pi-coding-agent";
import { loadExtensions } from "../../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js";
import { visibleWidth } from "@earendil-works/pi-tui";
import { getThemeByName, initTheme } from "../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js";
import { stripVTControlCharacters } from "node:util";
import { Kernel, type KernelOptions, type KernelResult, type KernelTrace } from "./kernel";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";
const text = (r: any) => r.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
const entries = (r: KernelResult) => r.trace!.entries;
async function until(predicate: () => boolean) {
	const deadline = Date.now() + 5000;
	while (!predicate()) { if (Date.now() > deadline) throw new Error("Expected live update within 5s"); await Bun.sleep(10); }
}
async function fixture(run: (kernel: Kernel, cwd: string) => Promise<void>, options: Partial<KernelOptions> = {}) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-presentation-"));
	const kernel = new Kernel({ cwd, ledger: [], persist() {}, ...options });
	try {
		await writeFile(join(cwd, "sample.ts"), "// visible\n// hidden-retained\n");
		await writeFile(join(cwd, "pixel.png"), Buffer.from(png, "base64"));
		await run(kernel, cwd);
	} finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}

// Want: watch actual overlapping work without disclosing retained values to the model.
test("live invocation order is independent of completion order; explicit show remains a filter", () => fixture(async kernel => {
	const updates: KernelTrace[] = [];
	let complete = false;
	const work = kernel.execute('const slow = sh("sleep .25; echo slow; echo second"); const fast = sh(`printf fast\nprintf tail`); state.source = await read("sample.ts"); await Promise.all([slow, fast]);', undefined, t => updates.push(t)).then(r => { complete = true; return r; });
	await until(() => updates.some(t => t.entries.some(e => e.state === "pending")));
	expect(complete).toBe(false);
	const saved = JSON.stringify(updates[0]);
	const result = await work;
	expect(result.error).toBeUndefined();
	expect(entries(result).map(e => e.name)).toEqual(["sh", "sh", "read"]);
	expect(entries(result)[0].args).toContain("sleep .25");
	expect(entries(result)[0].result).toContain("slow\nsecond");
	expect(entries(result)[0].result).toContain("[exitCode=0]\nstdout:\n");
	expect(entries(result)[1].args).toBe("printf fast\nprintf tail");
	const sourcePreview = entries(result)[2].result!;
	expect(sourcePreview).toContain("sample.ts:\n");
	expect(sourcePreview).toMatch(/1 [a-z0-9]+│\/\/ visible\n/);
	expect(sourcePreview.match(/\/\/ visible/g)).toHaveLength(1);
	expect(sourcePreview).not.toContain("rows:");
	expect(entries(result)[1].result).toContain("fast");
	expect(updates.some(t => t.entries[0]?.state === "pending" && t.entries[1]?.state === "ok")).toBe(true);
	expect(JSON.stringify(updates[0])).toBe(saved);
	expect(result.content).toEqual([]);
	expect(result.output).toBe("");
	const shown = await kernel.execute('await show(state.source.lines(1,1));');
	expect(shown.output).toContain("visible");
	expect(shown.output).not.toContain("hidden-retained");
}), 20000);

// Want: a returned cell must not falsely report that its retained work finished.
test("retained jobs, operation errors, and interruption remain distinct", () => fixture(async kernel => {
	const pending = await kernel.execute('state.job = sh("sleep .2; printf retained");');
	expect(pending.trace!.finished).toBe(true);
	expect(entries(pending)[0].state).toBe("pending");
	expect((await kernel.execute('await show(await state.job);')).output).toContain("retained");
	const failed = await kernel.execute('await read("absent.ts");');
	expect(failed.error).toBeTruthy();
	expect(entries(failed)[0].state).toBe("error");
	expect(entries(failed)[0].error).toContain("absent.ts");
	const controller = new AbortController();
	const updates: KernelTrace[] = [];
	const work = kernel.execute('await sh("sleep 60");', controller.signal, t => updates.push(t));
	await until(() => updates.some(t => t.entries.some(e => e.state === "pending")));
	controller.abort();
	const interrupted = await work;
	expect(interrupted.error).toMatch(/cancel|interrupt/i);
	expect(entries(interrupted)[0].state).toBe("interrupted");
	expect((await kernel.execute('show(typeof state.job);')).output).toBe("undefined\n");
}), 20000);

// Want: observing arguments is bounded and never executes user presentation hooks.
test("trace previews are passive, byte-bounded, and omit image payloads", () => fixture(async kernel => {
	const passive = await kernel.execute('let touched = 0; const probe = { get secret() { touched++; throw Error("getter invoked"); }, content() { touched++; throw Error("content invoked"); }, [Symbol.for("nodejs.util.inspect.custom")]() { touched++; throw Error("inspect invoked"); } }; const pattern = /visible/gim; for (const key of ["source", "flags", "global"]) Object.defineProperty(pattern, key, { get() { touched++; throw Error("regexp getter invoked"); } }); await sh("printf passive", probe, pattern); await grep(/visible/gi, "sample.ts"); show(touched);');
	expect(passive.error).toBeUndefined();
	expect(passive.output).toBe("0\n");
	expect(entries(passive)[0].args).toContain("/visible/gim");
	expect(entries(passive)[1].args).toContain("/visible/gi");
	expect(entries(passive)[1].result).toMatch(/1 [a-z0-9]+│\/\/ visible/);
	const image = await kernel.execute('const image = await read("pixel.png");');
	expect(image.error).toBeUndefined();
	expect(image.content).toEqual([]);
	expect(JSON.stringify(image.trace)).not.toContain(png);
	const large = await kernel.execute('for (let i=0;i<80;i++) await write("large.txt", "界".repeat(10000));');
	expect(large.error).toBeUndefined();
	expect(entries(large).length).toBeLessThanOrEqual(64);
	expect(large.trace!.omitted).toBeGreaterThan(0);
	expect(large.trace!.truncated).toBe(true);
	expect(Buffer.byteLength(JSON.stringify(large.trace))).toBeLessThanOrEqual(64 * 1024);
	for (const entry of entries(large)) for (const preview of [entry.args, entry.result, entry.error]) if (preview) expect(Buffer.byteLength(preview)).toBeLessThanOrEqual(4096);
	expect(large.output).toBe("");
	const burstUpdates: KernelTrace[] = [];
	const burst = await kernel.execute('for (let i=0;i<1000;i++) { try { sh(null); } catch {} }', undefined, t => burstUpdates.push(t));
	expect(entries(burst)).toHaveLength(64);
	expect(burst.trace!.omitted).toBe(936);
	expect(burstUpdates.length).toBeLessThan(64);
	expect(burstUpdates.at(-1)).toEqual(burst.trace);
}), 20000);

// Want: selected capabilities disappear, including the generic RPC route, across reset.
test("Kernel modules default to all, empty means core only, and host rejects excluded RPC", async () => {
	const names = '[typeof read,typeof sh,typeof exa,typeof board,typeof wm,typeof term,typeof ui,typeof show,typeof notify,typeof console]';
	await fixture(async kernel => {
		expect((await kernel.execute('show(' + names + '.join(","));')).output).toBe("function,function,object,object,object,object,object,function,function,object\n");
	});
	let dispatched = 0;
	await fixture(async kernel => {
		expect((await kernel.execute('show(' + names + '.join(","));')).output).toBe("undefined,undefined,undefined,undefined,undefined,undefined,undefined,function,function,object\n");
		expect((await kernel.execute('await host.call("board", "list", {});')).error).toMatch(/disabled|excluded|not enabled/i);
		// Node IPC is deliberately accessible (not a sandbox); the host must also gate it.
		await kernel.execute('process.send({type:"request",id:987654,namespace:"board",method:"list",args:{}}); await new Promise(r=>setTimeout(r,50));');
		expect(dispatched).toBe(0);
	}, { modules: [], call: async () => { dispatched++; return {}; } });
}, 20000);

async function session(flags: Record<string, string>, run: (s: any) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-presentation-session-"));
	const loaded = await loadExtensions([resolve(import.meta.dir, "index.ts")], cwd);
	expect(loaded.errors).toEqual([]);
	const manager = SessionManager.inMemory(cwd);
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, cwd, manager, {} as any);
	// Match CLI lifecycle: factory has already run when runner receives parsed flags.
	for (const [name, value] of Object.entries(flags)) runner.setFlagValue(name, value);
	let active = ["exec"];
	const errors: unknown[] = [];
	runner.onError(error => errors.push(error));
	runner.bindCore({ refreshTools() {}, appendEntry: (kind: string, data: unknown) => manager.appendCustomEntry(kind, data), sendMessage() {}, getActiveTools: () => active, setActiveTools: (names: string[]) => { active = names; }, getAllTools: () => runner.getAllRegisteredTools().map(t => t.definition) } as any, { getModel: () => undefined, getScopedModels: () => [], isIdle: () => true, isProjectTrusted: () => true, getSignal: () => undefined, hasPendingMessages: () => false, getContextUsage: () => undefined, getSystemPrompt: () => "" } as any);
	try {
		await runner.emit({ type: "session_start" } as any);
		const definition = () => runner.getAllRegisteredTools().find(t => t.definition.name === "exec")!.definition;
		let id = 0;
		const exec = (code: string, onUpdate?: any) => wrapRegisteredTools(runner.getAllRegisteredTools(), runner).find(t => t.name === "exec")!.execute(String(++id), { code }, undefined, onUpdate);
		await writeFile(join(cwd, "pixel.png"), Buffer.from(png, "base64"));
		await run({ exec, runner, definition, cwd });
		expect(errors).toEqual([]);
	} finally { await runner.emit({ type: "session_shutdown" } as any); await rm(cwd, { recursive: true, force: true }); }
}

test("loader-applied flags update advertised API and survive session tree and command reset", () => session({ "exec-modules": "fs,sh,board", "exec-deny-modules": "sh,board" }, async ({ exec, runner, definition }) => {
	const check = async () => {
		expect(text(await exec('show(typeof read,typeof sh,typeof board,typeof exa,typeof wm,typeof term,typeof ui);'))).toBe("function undefined undefined undefined undefined undefined undefined\n");
		const description = definition().description;
		expect(description).toContain("read(");
		for (const api of ["await sh`", "board.send(", "exa.search(", "wm.spawn(", "term.spawn(", "ui.findRoots"]) expect(description).not.toContain(api);
		expect(description).toContain("show(");
		expect(description).toContain("notify(");
	};
	await check();
	await runner.emit({ type: "session_tree" } as any);
	await check();
	await runner.getCommand("exec-reset")!.handler("", runner.createContext());
	await check();
}), 20000);


// Want: collapsed rows summarize what ran, while expansion separates evidence from source.
test("real tool result renders narrow/wide and expanded/collapsed without guessing calls from code", () => session({}, async ({ exec, definition }) => {
	const code = 'const never = () => exa.search("not invoked"); const pic = await read("pixel.png"); await show(pic); throw Error("after image");';
	const updates: any[] = [];
	const result = await exec(code, (update: any) => updates.push(update));
	expect(result.content.some((c: any) => c.type === "image")).toBe(true);
	expect(text(result)).toContain("after image");
	expect(text(result)).not.toContain("args:");
	expect(JSON.stringify(result.details.trace)).not.toContain(png);
	expect(updates.some(update => update.details?.trace?.entries.some((e: any) => e.state === "pending"))).toBe(true);
	expect(updates.every(update => !JSON.stringify(update.content).includes("args:"))).toBe(true);
	initTheme("dark", false);
	const theme = getThemeByName("dark")!;
	const tool = definition();
	for (const expanded of [false, true]) {
		const context = { state: {}, args: { code }, executionStarted: true, argsComplete: true, isPartial: false, expanded, showImages: true, isError: true, toolCallId: "image-error", cwd: process.cwd(), invalidate() {} };
		const call = tool.renderCall({ code }, theme, context);
		const body = tool.renderResult(result, { expanded, isPartial: false }, theme, context);
		for (const width of [12, 100]) {
			const header = call.render(width);
			const lines = body.render(width);
			for (const line of [...header, ...lines]) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
			if (width === 100) {
				const summary = stripVTControlCharacters(header.join("\n"));
				expect(summary).toContain("read");
				expect(summary).not.toContain("exa");
				expect(summary).toContain("image");
			}
			if (!expanded) expect(lines.length).toBeGreaterThan(0);
			if (expanded && width === 100) {
				const display = stripVTControlCharacters(lines.join("\n"));
				expect(display).toContain("args:");
				expect(display).toContain("result:");
				expect(display).toContain("after image");
				expect(display).not.toContain(png);
				expect(display.indexOf("Operations")).toBeLessThan(display.indexOf("Output"));
				expect(display.indexOf("Output")).toBeLessThan(display.indexOf("Source TypeScript"));
				expect(display).toContain("not invoked");
			}
		}
	}
}), 20000);


// Want: a selected real host module stays usable without advertising or exposing its peers.
test("board-only RPC retains complete results while show selects model-visible content", () => session({ "exec-modules": "board" }, async ({ exec, definition, cwd }) => {
	const previous = process.env.PI_BOARD_DIR;
	process.env.PI_BOARD_DIR = join(cwd, "board");
	try {
		const result = await exec('await board.send({topic:"audit",body:"selected"}); await board.send({topic:"audit",body:"unshown"}); const messages = await board.read({topic:"audit"}); show(messages.messages.filter(m=>m.body==="selected").map(m=>m.body));');
		expect(result.details.error).toBeUndefined();
		expect(result.details.trace.entries.map((e: any) => e.name)).toEqual(["board.send", "board.send", "board.read"]);
		expect(result.details.trace.entries[2].result).toContain("unshown");
		expect(text(result)).toContain("selected");
		expect(text(result)).not.toContain("unshown");
		const excluded = await exec('await host.call("exa", "search", {query:"never sent"});');
		expect(excluded.details.error).toMatch(/disabled|excluded|not enabled/i);
		expect(definition().description).not.toContain("wm.");
	} finally {
		if (previous === undefined) delete process.env.PI_BOARD_DIR; else process.env.PI_BOARD_DIR = previous;
	}
}), 20000);
