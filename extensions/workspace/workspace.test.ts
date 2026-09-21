import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandHome, resolveWorkspacePath } from "./workspace";

describe("workspace paths", () => {
	test("expands home directories", () => {
		expect(expandHome("~/dev")).not.toStartWith("~");
	});

	test("resolves relative directories", async () => {
		const root = await mkdtemp(join(tmpdir(), "pi-workspace-"));
		try {
			await mkdir(join(root, "nested"));
			expect(await resolveWorkspacePath("nested", root)).toBe(await realpath(join(root, "nested")));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("rejects files and missing paths", async () => {
		const root = await mkdtemp(join(tmpdir(), "pi-workspace-"));
		try {
			await writeFile(join(root, "file"), "");
			await expect(resolveWorkspacePath("file", root)).rejects.toThrow("not a directory");
			await expect(resolveWorkspacePath("missing", root)).rejects.toThrow("does not exist");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
