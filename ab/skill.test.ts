import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve(import.meta.dir, "main.ts");

test("skill names fall back to global Pi skills, but local names and explicit paths win", () => {
	const root = mkdtempSync(join(tmpdir(), "ab-skill-"));
	const home = join(root, "home");
	const workspace = join(root, "work");
	const global = join(home, ".pi/agent/skills", "example");
	const local = join(workspace, "example");
	mkdirSync(global, { recursive: true });
	mkdirSync(workspace);
	writeFileSync(join(global, "SKILL.md"), "global !`printf global-command`");
	const run = (name: string) => spawnSync("bun", [cli, "skill", name], {
		cwd: workspace, env: { ...process.env, HOME: home }, encoding: "utf8",
	});
	try {
		const fallback = run("example");
		expect(fallback.status).toBe(0);
		expect(fallback.stdout).toContain(`Skill: ${join(global, "SKILL.md")}`);
		expect(fallback.stdout).toContain("global global-command");
		expect(fallback.stdout).toContain(`PI_WORKSPACE=${realpathSync(workspace)}`);

		mkdirSync(local);
		writeFileSync(join(local, "SKILL.md"), "local");
		expect(run("example").stdout).toContain("local");
		expect(run("./example").stdout).toContain(`Skill: ${join(realpathSync(local), "SKILL.md")}`);
		const missing = run("./missing");
		expect(missing.status).toBe(2);
		expect(missing.stderr).toContain("missing");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
