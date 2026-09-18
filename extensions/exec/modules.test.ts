import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel } from "./kernel";

async function withKernel(cwd: string, run: (kernel: Kernel) => Promise<void>) {
	const kernel = new Kernel({ cwd, ledger: [], persist() {} });
	try { await run(kernel); }
	finally { await kernel.dispose(); }
}

async function cell(kernel: Kernel, code: string) {
	const result = await kernel.execute(code);
	if (result.error) throw new Error(result.error);
	return result.output;
}

test("project .pi/exec shadows lib by name, extras are project.*, and another cwd is unaffected", async () => {
	const overridden = await mkdtemp(join(tmpdir(), "exec-project-mod-"));
	const plain = await mkdtemp(join(tmpdir(), "exec-project-plain-"));
	try {
		await mkdir(join(overridden, ".pi", "exec"), { recursive: true });
		await writeFile(join(overridden, ".pi", "exec", "dispatch.ts"), "export async function dispatch() { return \"override\"; }\nexport const mark = \"project\";\n");
		await writeFile(join(overridden, ".pi", "exec", "localmod.ts"), "export const value = 7;\n");
		await withKernel(overridden, async kernel => {
			expect(await cell(kernel, "show(await dispatch.dispatch(), dispatch.mark, project.localmod.value);")).toBe("override project 7\n");
		});
		await withKernel(plain, async kernel => {
			expect(await cell(kernel, "show(typeof dispatch.dispatch, typeof project.localmod);")).toBe("function undefined\n");
		});
	} finally {
		await rm(overridden, { recursive: true, force: true });
		await rm(plain, { recursive: true, force: true });
	}
}, 20000);
