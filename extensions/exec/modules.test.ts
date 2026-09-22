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

test("resolveModules substitutes coordination only inside native hosts", async () => {
	const { resolveModules, MODULES } = await import("./modules");
	expect(resolveModules(undefined, undefined, {})).toEqual([...MODULES]);
	const inside = resolveModules(undefined, undefined, { ORCA_WORKTREE_ID: "repo::/work" });
	expect(inside).not.toContain("board");
	expect(inside).not.toContain("wm");
	expect(inside).toContain("sh");
	expect(resolveModules("board,wm", undefined, { ORCA_WORKTREE_ID: "repo::/work" })).toEqual([]);
});


test("Paseo takes precedence over inherited Orca; instructions stay host-local", async () => {
  const { resolveModules, describeModules } = await import("./modules");
  const { executionHost } = await import("../../lib/execution-host");
  const env = { PASEO_AGENT_ID: "parent", ORCA_WORKTREE_ID: "inherited" };
  expect(executionHost(env)).toBe("paseo");
  expect(resolveModules("board,wm", undefined, env)).toEqual([]);
  expect(describeModules([], "default", env)).toContain("paseo.withClient");
  expect(describeModules([], "default", env)).not.toContain("orca.runs");
  expect(describeModules([], "default", {})).not.toContain("orca.runs");
  expect(describeModules([], "reader", env)).not.toContain("paseo.withClient");
});

// Session audit: UI journeys went straight to raw actions because only ui was advertised.
test("exec advertises delegated computer use, except in the read-only profile", async () => {
  const { describeModules } = await import("./modules");
  const description = describeModules(["ui"]);
  expect(description).toContain("computer.run(options)");
  expect(description).toContain("computer.browser(page)");
  expect(description).toContain("when a browser CLI is needed");
  expect(describeModules([], "reader")).not.toContain("computer.run");
});
