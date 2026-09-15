import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel, type KernelNotification } from "./kernel";
import type { LedgerEntry } from "../outline-read/ledger";

async function fixture(run: (kernel: Kernel, cwd: string, entries: LedgerEntry[], notifications: KernelNotification[]) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-contract-"));
	const entries: LedgerEntry[] = [], notifications: KernelNotification[] = [];
	const kernel = new Kernel({ cwd, ledger: [], persist: entry => { entries.push(entry); }, onNotification: event => notifications.push(event) });
	try { await writeFile(join(cwd, "example.ts"), "export function oldName() {\n  return 42;\n}\n"); await run(kernel, cwd, entries, notifications); }
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

test("read selections and typed bindings survive calls; promised outlines render and short refs edit", () => fixture(async (kernel, cwd) => {
	await cell(kernel, 'const count: number = 41; const source = await read("example.ts"); const hits = await grep(/oldName/, ["example.ts"]);');
	expect(await cell(kernel, 'show(count + 1); await show(source.outline());')).toContain("oldName");
	expect(await cell(kernel, 'show(count + 1);')).toBe("42\n");
	await cell(kernel, 'await edit("=" + hits.rows[0].anchor + "\\nexport function newName() {");');
	expect(await readFile(join(cwd, "example.ts"), "utf8")).toContain("function newName()");
	const failed = await kernel.execute('show("before failure"); throw new Error("intentional");');
	expect(failed.output).toBe("before failure\n");
	expect(failed.error).toContain("intentional");
}), 15000);

test("saved shell promises notify the host after the originating call and remain awaitable", () => fixture(async (kernel, _cwd, _entries, notifications) => {
	await cell(kernel, 'const job = sh("sleep 0.2; printf finished; exit 7"); notify(job, "job");');
	expect(notifications).toHaveLength(0);
	await until(() => notifications.length === 1);
	expect(notifications[0].label).toBe("job");
	expect(notifications[0].output).toContain("finished");
	expect(await cell(kernel, 'const result = await job; show(result.stdout, result.exitCode);')).toBe("finished 7\n");
}), 15000);

test("interrupt kills looping kernel and shell descendants; fresh kernel restores latest edited anchors", () => fixture(async (kernel, cwd, entries) => {
	await cell(kernel, 'const first = await read("example.ts"); await edit("=" + first.rows[0].anchor + "\\nexport function latest() {"); const latest = await read("example.ts");');
	const anchor = (await cell(kernel, 'show(latest.rows[0].anchor);')).trim();
	expect(entries.length).toBeGreaterThan(1);
	await cell(kernel, 'const child = sh("sleep 60 & echo $! > child.pid; wait");');
	let pid = 0;
	await until(async () => { try { pid = Number(await readFile(join(cwd, "child.pid"), "utf8")); return pid > 0; } catch { return false; } });
	const controller = new AbortController();
	const interrupted = kernel.execute('show("looping"); while (true) {}', controller.signal);
	const timer = setTimeout(() => controller.abort(), 150);
	try {
		const result = await interrupted;
		expect(result.error).toContain("cancelled");
		expect(result.output).toContain("looping");
	} finally { clearTimeout(timer); }
	await until(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
	expect(await cell(kernel, 'show(typeof latest); const restored = await read("example.ts"); show(restored.rows[0].anchor);')).toBe(`undefined\n${anchor}\n`);
	await cell(kernel, `await edit(${JSON.stringify("=" + anchor + "\nexport function restoredEdit() {")});`);
	expect(await readFile(join(cwd, "example.ts"), "utf8")).toContain("function restoredEdit()");
}), 15000);
