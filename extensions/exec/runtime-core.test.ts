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

test("shadowed conveniences recover from an immutable registry, even after shadowing __exec", () => fixture(async (kernel, cwd) => {
	await writeFile(join(cwd, "note.txt"), "retained original");
	await cell(kernel, 'const originals = __exec; const read = 1, sh = 2, show = 3, ui = 4, exa = 5, board = 6, wm = 7, term = 8, host = 9, notify = 10, console = 11;');
	expect(await cell(kernel, 'await __exec.show((await __exec.read("note.txt")).text, (await __exec.sh("printf recovered")).stdout, (await __exec.ui.help())[0].description);')).toBe("retained original recovered help from host\n");
	await cell(kernel, 'const __exec = "shadow";');
	expect(await cell(kernel, 'globalThis.__exec.show(__exec, originals === globalThis.__exec);')).toBe("shadow true\n");
	expect(await cell(kernel, 'globalThis.__exec.show(Object.isFrozen(originals), ["ui","exa","board","wm","term","host","console"].every(k => Object.isFrozen(originals[k])), Object.isFrozen(originals.show), Object.isFrozen(originals.sh));')).toBe("true true true true\n");
	expect(await cell(kernel, 'originals.show(Reflect.set(globalThis, "__exec", {}), Reflect.deleteProperty(globalThis, "__exec"), Reflect.set(originals, "read", 0), Reflect.set(originals.ui, "help", 0), Reflect.set(originals.show, "large", 0), Reflect.set(originals.sh, "raw", 0));')).toBe("false false false false false false\n");
	expect(await cell(kernel, 'await originals.show((await originals.ui.help())[0].description, (await originals.read("note.txt")).text);')).toBe("help from host retained original\n");
}, { call: async ({ namespace, method }) => {
	if (namespace !== "ui" || method !== "help") throw new Error("Unexpected host request");
	return [{ description: "help from host" }];
} }), 15000);

test("registry omits disabled modules and cannot bypass the host module gate", () => fixture(async (kernel) => {
	expect(await cell(kernel, 'show(Object.keys(__exec).sort().join(","));')).toBe("console,host,notify,show\n");
	expect(await cell(kernel, 'show(typeof read, typeof sh, typeof ui, typeof exa, typeof board, typeof wm, typeof term);')).toBe("undefined undefined undefined undefined undefined undefined undefined\n");
	for (const namespace of ["ui", "exa", "board", "wm", "term", "fs", "sh"]) {
		const result = await kernel.execute(`await __exec.host.call(${JSON.stringify(namespace)}, "help", {});`);
		expect(result.error).toContain("disabled");
	}
}, { modules: [], call: async () => { throw new Error("Disabled capability reached host"); } }), 15000);
