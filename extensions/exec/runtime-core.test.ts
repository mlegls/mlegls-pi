import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel, type KernelOptions } from "./kernel";

async function fixture(run: (kernel: Kernel, cwd: string) => Promise<void>, options: Partial<KernelOptions> = {}) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-runtime-core-"));
	const kernel = new Kernel({ cwd, ledger: [], persist() {}, ...options });
	try { await run(kernel, cwd); }
	finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}

async function cell(kernel: Kernel, code: string) {
	const result = await kernel.execute(code);
	if (result.error) throw new Error(result.error);
	return result.output;
}

test("ordinary TS imports transform parameter properties, share ESM identity, await dependencies, and persist beside JS/CJS", () => fixture(async (kernel, cwd) => {
	for (const [name, source] of Object.entries({
		"package.json": '{"type":"module"}',
		"value.ts": 'export class Value { constructor(public value: number) {} }; export const shared = new Value(await Promise.resolve(41));',
		"entry.ts": 'import { shared } from "./value.ts"; export { shared }; export const ready = await Promise.resolve(shared.value + 1);',
		"plain.js": 'export const value = 7;',
		"legacy.cjs": 'module.exports = { value: 9 };',
	})) await writeFile(join(cwd, name), source);
	await cell(kernel, 'const imported = await import("./entry.ts"); const shared = imported.shared;');
	expect(await cell(kernel, 'const direct = await import("./value.ts"); const again = await import("./entry.ts"); show(imported === again, shared === direct.shared, shared.value, imported.ready);')).toBe("true true 41 42\n");
	await cell(kernel, 'shared.value++; const plain = await import("./plain.js"); const legacy = await import("./legacy.cjs");');
	expect(await cell(kernel, 'show(direct.shared.value, plain.value, legacy.default.value);')).toBe("42 7 9\n");
}), 15000);
