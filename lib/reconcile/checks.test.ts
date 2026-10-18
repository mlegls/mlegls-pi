import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAncestor } from "./checks.ts";

test("isAncestor reads exit 1 as not an ancestor and reports other failures", () => {
	const dir = mkdtempSync(join(tmpdir(), "is-ancestor-"));
	try {
		const git = (...args: string[]) => execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();
		git("init", "-qb", "main");
		git("commit", "-q", "--allow-empty", "-m", "a");
		const a = git("rev-parse", "HEAD");
		git("checkout", "-qb", "side");
		git("commit", "-q", "--allow-empty", "-m", "b");
		const b = git("rev-parse", "HEAD");
		git("checkout", "-q", "main");
		expect(isAncestor(dir, a, b)).toBe(true);
		expect(isAncestor(dir, b)).toBe(false);
		expect(() => isAncestor(dir, "0".repeat(40))).toThrow(/exit 128/);
	} finally { rmSync(dir, { recursive: true, force: true }); }
});
