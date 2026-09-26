import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { segments } from "../lib/raw.ts";

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

test("activated skills are exact in bash output and plain outside it", () => {
	const root = mkdtempSync(join(tmpdir(), "ab-skill-exact-"));
	const path = join(root, "SKILL.md");
	const rules = "Only close when verified. Do not deploy unless approved. File issues here; use notes otherwise.\n".repeat(12);
	writeFileSync(path, rules + "expanded: !`printf once`\n");
	const run = (active: boolean) => spawnSync(process.execPath, [cli, "skill", path], {
		cwd: root, env: { ...process.env, AB_OUT: active ? join(root, "attach") : "" }, encoding: "utf8",
	});
	try {
		const plain = run(false), protectedOutput = run(true);
		expect(plain.status).toBe(0);
		expect(protectedOutput.status).toBe(0);
		expect(plain.stdout).toContain(rules + "expanded: once\n");
		expect(plain.stdout).not.toContain("\x1b]");
		const parts = segments(protectedOutput.stdout);
		expect(parts.filter(p => p.raw).map(p => p.text).join("")).toBe(plain.stdout.trimEnd() + "\n");
		expect(parts.filter(p => !p.raw).every(p => !p.text.trim())).toBe(true);
	} finally { rmSync(root, { recursive: true, force: true }); }
});
