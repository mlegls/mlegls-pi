import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clip, commandFailure, isAncestor } from "./checks.ts";

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

// 2026-10-29 (concept): a reviewer was sent the head of a failed gate's output, which stopped mid-test among passing cases.
test("a failed gate's report keeps the failing tail and exit, not the head its message repeats", () => {
	let error: unknown;
	try { execFileSync("bash", ["-c", "for i in $(seq 1 3000); do echo \"(pass) case $i\" >&2; done; echo '(fail) the broken case' >&2; echo summary; exit 3"], { encoding: "utf8", stdio: "pipe" }); }
	catch (e) { error = e; }
	const { summary, log } = commandFailure(error, 2000);
	expect(summary).toStartWith("Command failed: bash -c");
	expect(summary.split("\n")[0]).toEndWith("(exit 3)");
	expect(summary).toContain("(fail) the broken case");
	expect(summary).toContain("--- stdout (tail) ---\nsummary");
	expect(summary.length).toBeLessThan(2400);
	expect(log).toContain("(pass) case 1\n");
	expect(clip("abcdefghij", 20)).toBe("abcdefghij");
});
