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

test("ordinary TS imports transform parameter properties, share ESM identity, await dependencies, and retain results beside JS/CJS", () => fixture(async (kernel, cwd) => {
	for (const [name, source] of Object.entries({
		"package.json": '{"type":"module"}',
		"value.ts": 'export class Value { constructor(public value: number) {} }; export const shared = new Value(await Promise.resolve(41));',
		"entry.ts": 'import { shared } from "./value.ts"; export { shared }; export const ready = await Promise.resolve(shared.value + 1);',
		"plain.js": 'export const value = 7;',
		"legacy.cjs": 'module.exports = { value: 9 };',
	})) await writeFile(join(cwd, name), source);
	await cell(kernel, 'state.imported = await import("./entry.ts"); state.shared = state.imported.shared;');
	expect(await cell(kernel, 'state.direct = await import("./value.ts"); const again = await import("./entry.ts"); show(state.imported === again, state.shared === state.direct.shared, state.shared.value, state.imported.ready);')).toBe("true true 41 42\n");
	await cell(kernel, 'state.shared.value++; state.plain = await import("./plain.js"); state.legacy = await import("./legacy.cjs");');
	expect(await cell(kernel, 'show(state.direct.shared.value, state.plain.value, state.legacy.default.value);')).toBe("42 7 9\n");
}), 15000);

test("reserved names reject redeclaration before effects; nested shadowing leaves immutable APIs usable", () => fixture(async (kernel, cwd) => {
	await writeFile(join(cwd, "note.txt"), "retained original");
	const names = JSON.parse((await cell(kernel, 'show(JSON.stringify([...Object.keys(__exec), "__exec"]));')).trim());
	for (const name of names) {
		for (const declaration of ["const", "let", "var", "function"]) {
			const binding = declaration === "function" ? "function " + name + "() {}" : declaration + " " + name + " = 1;";
			const rejected = await kernel.execute('state.leaked = true; show("must not run"); ' + binding);
			expect(rejected.error).toContain("SyntaxError");
			expect(rejected.output).toBe("");
		}
	}
	expect(await cell(kernel, 'show(state.leaked); { const read = 1, state = 2, __exec = 3; show(read, state, __exec); }')).toBe("undefined\n1 2 3\n");
	expect(await cell(kernel, 'show(Object.isFrozen(__exec), ["ui","exa","board","wm","term","host","console"].every(k => Object.isFrozen(__exec[k])), Object.isFrozen(show), Object.isFrozen(sh));')).toBe("true true true true\n");
	expect(await cell(kernel, 'show([...Object.keys(__exec), "__exec"].every(k => { const original = globalThis[k]; Reflect.set(globalThis, k, {}); Reflect.deleteProperty(globalThis, k); return globalThis[k] === original; }), Reflect.set(__exec, "read", 0), Reflect.set(ui, "help", 0), Reflect.set(show, "large", 0), Reflect.set(sh, "raw", 0));')).toBe("true false false false false\n");
	for (const code of ['state = {};', '__exec = {};', 'show = 1;', 'ui.help = 1;']) {
		expect((await kernel.execute(code)).error).toContain("TypeError");
	}
	expect(await cell(kernel, 'await show((await ui.help())[0].description, (await read("note.txt")).text);')).toBe("help from host retained original\n");
}, { call: async ({ namespace, method }) => {
	if (namespace !== "ui" || method !== "help") throw new Error("Unexpected host request");
	return [{ description: "help from host" }];
} }), 15000);

test("registry omits disabled modules and cannot bypass the host module gate", () => fixture(async (kernel) => {
	expect(await cell(kernel, 'show(Object.keys(__exec).sort().join(","));')).toBe("console,host,notify,show,state\n");
	expect(await cell(kernel, 'show(typeof read, typeof sh, typeof ui, typeof exa, typeof board, typeof wm, typeof term);')).toBe("undefined undefined undefined undefined undefined undefined undefined\n");
	for (const namespace of ["ui", "exa", "board", "wm", "term", "fs", "sh"]) {
		const result = await kernel.execute(`await __exec.host.call(${JSON.stringify(namespace)}, "help", {});`);
		expect(result.error).toContain("disabled");
	}
}, { modules: [], call: async () => { throw new Error("Disabled capability reached host"); } }), 15000);

// Reusing scratch names must not lose deliberately retained work, even after a failed cell.
test("fresh strict cells retain only explicit mutable state across calls and errors", () => fixture(async kernel => {
	const scratch = 'const value: number = 40; let next = value + 1; var last = next + 1; function answer() { return last; } state.answer = answer;';
	await cell(kernel, scratch);
	expect(await cell(kernel, 'show(typeof value, typeof next, typeof last, typeof answer, state.answer());')).toBe("undefined undefined undefined undefined 42\n");
	await cell(kernel, scratch);
	expect(await cell(kernel, 'show(Object.getPrototypeOf(state) === null, state === __exec.state); state.__proto__ = 7; show(state.__proto__, Object.getPrototypeOf(state) === null); delete state.__proto__;')).toBe("true true\n7 true\n");
	expect((await kernel.execute('accidentalGlobal = 1;')).error).toContain("ReferenceError");
	const failed = await kernel.execute('state.saved = await Promise.resolve(41); throw new Error("later failure");');
	expect(failed.error).toContain("later failure");
	expect(await cell(kernel, 'show(state.saved + 1, state.answer()); delete state.saved; delete state.answer; show(Object.keys(state));')).toBe("42 42\n[]\n");
}), 15000);
