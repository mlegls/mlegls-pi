import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRoot, isPathInside } from "./lsp-client";

describe("LSP project root discovery", () => {
	test("uses the nearest marker within the workspace", () => {
		const workspace = mkdtempSync(join(tmpdir(), "pi-lsp-"));
		try {
			const nested = join(workspace, "packages", "app");
			mkdirSync(join(nested, "src"), { recursive: true });
			writeFileSync(join(workspace, "package.json"), "{}");
			writeFileSync(join(nested, "package.json"), "{}");

			expect(findProjectRoot(join(nested, "src", "index.ts"), workspace, ["package.json"])).toBe(nested);
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	test("walks up to a marker at the workspace root", () => {
		const workspace = mkdtempSync(join(tmpdir(), "pi-lsp-"));
		try {
			mkdirSync(join(workspace, "src"));
			writeFileSync(join(workspace, "Cargo.toml"), "");
			expect(findProjectRoot(join(workspace, "src", "main.rs"), workspace, ["Cargo.toml"])).toBe(workspace);
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	test("does not discover projects outside the workspace", () => {
		const workspace = mkdtempSync(join(tmpdir(), "pi-lsp-workspace-"));
		const external = mkdtempSync(join(tmpdir(), "pi-lsp-external-"));
		try {
			writeFileSync(join(external, "pyproject.toml"), "");
			expect(findProjectRoot(join(external, "main.py"), workspace, ["pyproject.toml"])).toBeUndefined();
			expect(isPathInside(workspace, join(external, "main.py"))).toBe(false);
		} finally {
			rmSync(workspace, { recursive: true, force: true });
			rmSync(external, { recursive: true, force: true });
		}
	});
});
