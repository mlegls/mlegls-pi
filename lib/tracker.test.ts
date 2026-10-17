import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTracker } from "./tracker";

// A fake tracker CLI: each call takes the next behavior from the plan file.
const root = mkdtempSync(join(tmpdir(), "tracker-run-"));
mkdirSync(join(root, "docs", "issues"), { recursive: true });
const cli = join(root, "issues.ts");
writeFileSync(cli, [
	'import { readFileSync, writeFileSync } from "node:fs";',
	'const plan = JSON.parse(readFileSync(process.env.PLAN!, "utf8")); const step = plan.shift(); writeFileSync(process.env.PLAN!, JSON.stringify(plan));',
	'if (step === "kill") process.kill(process.pid, "SIGKILL");',
	'if (step === "silent") process.exit(3);',
	'if (step === "say") { console.error("frontmatter must be a mapping"); process.exit(1); }',
	'console.log(JSON.stringify({ issues: [{ slug: "a" }] }));',
].join("\n"));
const plan = (...steps: string[]) => { const f = join(root, "plan.json"); writeFileSync(f, JSON.stringify(steps)); process.env.PLAN = f; };
afterAll(() => { delete process.env.PLAN; rmSync(root, { recursive: true, force: true }); });

test("a snapshot killed without a word is retried once", () => {
	plan("kill", "ok");
	expect([...getTracker(root, { cli }).snapshot().keys()]).toEqual(["a"]);
});

test("a failure with nothing on stderr names how the tracker ended, for both attempts", () => {
	plan("kill", "silent");
	expect(() => getTracker(root, { cli }).snapshot()).toThrow(/snapshot --json \(exit status 3, nothing on stderr\) \(first attempt: .*snapshot --json \(killed by SIGKILL, nothing on stderr\)\)/);
});

test("the tracker's own diagnostic is reported as it said it", () => {
	plan("say", "say");
	expect(() => getTracker(root, { cli }).snapshot()).toThrow("frontmatter must be a mapping (failed twice)");
});
