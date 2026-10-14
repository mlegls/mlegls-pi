import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Ledger } from "./ledger";
import { registerReadTool } from "./read";

test("quoted space-containing paths resolve, and existing unquoted literals win over splitting", async () => {
	const cwd = await mkdtemp(join(tmpdir(), "outline-read-"));
	try {
		await mkdir(join(cwd, "dir"));
		await writeFile(join(cwd, "dir/a b.md"), "space-containing file\n");
		// Both split paths also exist: the unquoted literal must still win.
		await writeFile(join(cwd, "dir/a"), "first split file\n");
		await writeFile(join(cwd, "b.md"), "second split file\n");
		let read!: ToolDefinition;
		registerReadTool({ registerTool: (tool: ToolDefinition) => { read = tool; } } as ExtensionAPI, {
			ledger: new Ledger(), persist: () => {}, sources: [], plain: true,
		});
		for (const path of ['"dir/a b.md"', "dir/a b.md"]) {
			const result = await read.execute("read", { path }, undefined, undefined, { cwd } as Parameters<typeof read.execute>[4]);
			expect(result.content).toEqual([{ type: "text", text: "dir/a b.md (1 lines)\nspace-containing file" }]);
		}
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
});
