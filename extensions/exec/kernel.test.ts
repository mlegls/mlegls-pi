import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel, type KernelLate } from "./kernel";
import type { LedgerEntry } from "../../lib/outline-read/ledger";

async function fixture(run: (kernel: Kernel, cwd: string, entries: LedgerEntry[], late: KernelLate[]) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-contract-"));
	const entries: LedgerEntry[] = [], late: KernelLate[] = [];
	const kernel = new Kernel({ cwd, ledger: [], persist: entry => { entries.push(entry); }, onLate: event => late.push(event) });
	try { await writeFile(join(cwd, "example.ts"), "export function oldName() {\n  return 42;\n}\n"); await run(kernel, cwd, entries, late); }
	finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}

async function cell(kernel: Kernel, code: string) {
	const result = await kernel.execute(code);
	expect(result.error).toBeUndefined();
	return result.output;
}

async function until(predicate: () => boolean | Promise<boolean>) {
	const deadline = Date.now() + 3000;
	while (!(await predicate())) {
		if (Date.now() > deadline) throw new Error("Condition did not become true within 3s");
		await Bun.sleep(20);
	}
}

test("explicitly retained read selections and typed values survive calls; promised outlines render and short refs edit", () => fixture(async (kernel, cwd) => {
	await cell(kernel, 'const count: number = 41; state.count = count; state.source = await read("example.ts"); state.hits = await grep(/oldName/, ["example.ts"]);');
	expect(await cell(kernel, 'show(state.count + 1); await show(state.source.outline());')).toContain("oldName");
	expect(await cell(kernel, 'show(state.count + 1);')).toBe("42\n");
	await cell(kernel, 'await edit("=" + state.hits.rows[0].anchor + "\\nexport function newName() {");');
	expect(await readFile(join(cwd, "example.ts"), "utf8")).toContain("function newName()");
	const failed = await kernel.execute('show("before failure"); throw new Error("intentional");');
	expect(failed.output).toBe("before failure\n");
	expect(failed.error).toContain("intentional");
}), 15000);

test("a slow show yields its cell and arrives later by handle; show.sync and wait hold the result", () => fixture(async (kernel, _cwd, _entries, late) => {
	const yielded = await kernel.execute('show("now"); state.job = sh("sleep 0.4; printf finished; exit 7"); show(state.job.then(r => r.stdout)); state.set = 1;', { id: 7, yieldMs: 100 });
	expect(yielded.running).toBe(true);
	expect(yielded.output).toContain("[c7.1]\nnow\n");
	expect(yielded.output).toContain("pending c7.2");
	expect(await cell(kernel, 'show(state.set);')).toBe("1\n");
	await until(() => late.some(event => event.handle === "c7.2"));
	expect(late.find(event => event.handle === "c7.2")!.content).toEqual([{ type: "text", text: "finished\n" }]);
	await until(() => late.some(event => event.handle === "c7"));
	expect(late.find(event => event.handle === "c7")!.passive).toBe(true);
	expect(await cell(kernel, 'const result = await state.job; show(result.stdout, result.exitCode);')).toBe("finished 7\n");
	expect((await cell(kernel, 'show.pull("c7.2");')).trimEnd()).toBe("finished");
	expect((await cell(kernel, 'show.pull("c7");')).trimEnd()).toBe("now\nfinished");
	const synced = await kernel.execute('show.sync(sh("sleep 0.3; printf synced").then(r => r.stdout));', { yieldMs: 50 });
	expect(synced.running).toBeUndefined();
	expect(synced.output).toBe("synced\n");
	await kernel.execute('show(sh("sleep 0.3; printf later").then(r => r.stdout));', { id: 20, yieldMs: 50 });
	expect((await kernel.execute('await wait("c20.1");', { yieldMs: 50 })).output).toBe("settled: c20.1\n");
	const failed = await kernel.execute('await sh("sleep 0.2"); throw new Error("late failure");', { id: 30, yieldMs: 50 });
	expect(failed.running).toBe(true);
	await until(() => late.some(event => event.handle === "c30"));
	expect(late.find(event => event.handle === "c30")).toMatchObject({ passive: false, error: expect.stringContaining("late failure") });
}), 15000);

test("interrupt detaches; a wedged kernel is killed with its shell descendants; fresh kernel restores latest edited anchors", () => fixture(async (kernel, cwd, entries) => {
	await cell(kernel, 'const first = await read("example.ts"); await edit("=" + first.rows[0].anchor + "\\nexport function latest() {"); state.latest = await read("example.ts");');
	const anchor = (await cell(kernel, 'show(state.latest.rows[0].anchor);')).trim();
	expect(entries.length).toBeGreaterThan(1);
	await cell(kernel, 'const child = sh("sleep 60 & echo $! > child.pid; wait");');
	let pid = 0;
	await until(async () => { try { pid = Number(await readFile(join(cwd, "child.pid"), "utf8")); return pid > 0; } catch { return false; } });
	const controller = new AbortController();
	const interrupted = kernel.execute('show("looping"); await new Promise(r => setTimeout(r, 50)); while (true) {}', { signal: controller.signal });
	const timer = setTimeout(() => controller.abort(), 150);
	try {
		const result = await interrupted;
		expect(result.running).toBe(true);
		expect(result.output).toContain("looping");
		expect(result.output).toContain("Detached on interrupt");
	} finally { clearTimeout(timer); }
	await until(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
	expect(await cell(kernel, 'show(typeof state.latest); const restored = await read("example.ts"); show(restored.rows[0].anchor);')).toBe(`undefined\n${anchor}\n`);
	await cell(kernel, `await edit(${JSON.stringify("=" + anchor + "\nexport function restoredEdit() {")});`);
	expect(await readFile(join(cwd, "example.ts"), "utf8")).toContain("function restoredEdit()");
}), 15000);


test("filtered source references retain snapshot context, replace only selected rows, and reject external changes", () => fixture(async (kernel, cwd) => {
	const path = join(cwd, "example.ts");
	const original = "// TODO keep\nexport function task() {\n  // TODO change\n  return 42;\n}\n";
	await writeFile(path, original);
	await cell(kernel, 'state.snapshot = await read("example.ts"); const todos = await grep(/TODO/g, "example.ts"); state.chosen = todos.filter(row => row.text.includes("change"));');
	const context = await cell(kernel, 'await show(state.chosen.context(1)); show(state.chosen.rows[0].anchor === state.snapshot.rows[2].anchor);');
	expect(context).toContain("export function task()");
	expect(context).toContain("return 42");
	expect(context).toContain("true");
	await cell(kernel, 'await show(await replace(state.chosen, async (text, row) => text.replace("TODO", "DONE") + " line=" + row.line));');
	expect(await readFile(path, "utf8")).toBe(original.replace("  // TODO change", "  // DONE change line=3"));
	const savedContext = await cell(kernel, 'await show(state.chosen.context(1));');
	expect(savedContext).toContain("TODO change");
	expect(savedContext).not.toContain("DONE");
	await cell(kernel, 'state.current = await grep("DONE", "example.ts");');
	const external = original.replace("TODO change", "externally changed");
	await writeFile(path, external);
	const stale = await kernel.execute('await show(await replace(state.current, () => "must not overwrite"));');
	expect(stale.error ?? stale.output).toMatch(/stale|changed|read.*again/i);
	expect(await readFile(path, "utf8")).toBe(external);
}), 15000);


test("discovery honors ignores but explicit reads work; limited search reports incompleteness", () => fixture(async (kernel, cwd) => {
	await writeFile(join(cwd, ".ignore"), "ignored.ts\n");
	await writeFile(join(cwd, "ignored.ts"), "// needle hidden\n");
	await writeFile(join(cwd, "example.ts"), "// needle one\n// needle two\n");
	expect(await cell(kernel, 'show((await find()).map(path => path.split("/").pop()).sort().join(","));')).toBe("example.ts\n");
	expect(await cell(kernel, 'const visible = await grep("needle"); show(visible.rows.length, visible.complete);')).toBe("2 true\n");
	expect(await cell(kernel, 'show((await read("ignored.ts")).text); show((await grep("needle", "ignored.ts")).rows.length);')).toContain("needle hidden");
	expect(await cell(kernel, 'state.limited = await grep("needle", "example.ts", {limit: 1}); show(state.limited.rows.length, state.limited.complete); await show(state.limited);')).toContain("1 false\n");
	expect(await cell(kernel, 'await show(state.limited);')).toContain("[incomplete:");
	expect(await cell(kernel, 'const zero = await grep("needle", "example.ts", {limit: 0}); show(zero.rows.length, zero.complete);')).toBe("0 false\n");
	expect(await cell(kernel, 'show((await grep("needle", "ignored.ts")).rows.length);')).toBe("1\n");
	expect(await cell(kernel, 'show((await find("*.ts")).map(path => path.split("/").pop()).sort().join(","));')).toBe("example.ts\n");
}), 15000);

test("process stdout/stderr written by a cell is a collapsed side stream, pullable as cN.io", () => fixture(async (kernel) => {
	const output = await cell(kernel, 'globalThis.console.warn("DeprecationWarning: old"); process.stdout.write("raw\\n"); show("visible")');
	expect(output).toBe('visible\n[io: 2 lines (1 stderr) written to stdout/stderr, not shown: "DeprecationWarning: old"; show.pull("c1.io")]\n');
	expect(await cell(kernel, 'await show.pull("c1.io")')).toBe("DeprecationWarning: old\nraw\n\n");
	expect(await cell(kernel, 'await show.pull("c1")')).toBe("visible\n\n");
	expect(await cell(kernel, 'show("quiet")')).toBe("quiet\n");
}));

test("Bun Shell $ quotes interpolations, rejects nonzero exits with stderr, and shows stdout", () => fixture(async (kernel) => {
	expect(await cell(kernel, 'const name = "a b; echo injected"; show(await $`printf %s ${name}`)')).toBe("a b; echo injected\n");
	const failed = await kernel.execute('await $`exit 3`');
	expect(failed.error).toContain("exit code 3");
	expect(await cell(kernel, 'show(await $`echo out; echo err 1>&2; exit 4`.nothrow())')).toBe("out\nstderr:\nerr\n\n[exit 4]\n");
}));
