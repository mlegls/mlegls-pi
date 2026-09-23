import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { PRELUDE } from "./index.ts";

const run = (script: string) => { const r = spawnSync("bash", ["-c", PRELUDE + script], { encoding: "utf8" }); return { out: r.stdout, err: r.stderr, code: r.status }; };

test("an unhandled failure mid-script reports its line and command, and the script continues", () => {
	const r = run("echo a\nfalse\nls /nonexistent-xyz\necho b");
	// One stream, in order: the report sits right after the failure.
	expect(r.out).toMatch(/^a\n\[exit 1 at line 2: false\]\nls: .*nonexistent-xyz.*\n\[exit \d+ at line 3: ls \/nonexistent-xyz\]\nb\n$/);
	expect(r.code).toBe(0);
});

test("handled failures stay quiet", () => {
	const r = run("grep -q x /dev/null || echo none\nif false; then :; fi\nfalse && echo never\ntrue");
	expect(r.out).toBe("none\n");
});

test("the trap reaches functions and command substitutions", () => {
	const r = run("f() { false; }\nf\nx=$(false; echo y)\necho \"x=$x\"");
	expect(r.out).toContain("[exit 1 at line 1: false]");
	expect(r.out).toContain("[exit 1 at line 3: false]");
	expect(r.out).toContain("x=y\n");
});
