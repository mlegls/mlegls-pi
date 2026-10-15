import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { campaigns, summary } from "./main";

test("status lists run states and skips the GitHub tracker's journals beside them", () => {
	const cwd = mkdtempSync(join(tmpdir(), "campaigns-"));
	try {
		execFileSync("git", ["init", "-q"], { cwd });
		const dir = join(cwd, ".git", "reconcile");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "gh-1.json"), JSON.stringify({ root: "gh-1", backend: "threads", cwd, chains: {}, exceptions: {}, log: [], finished: "done",
			landed: {}, results: {}, landingOps: {}, refinements: {}, moved: {} }));
		writeFileSync(join(dir, "gh-1.github.json"), JSON.stringify({ version: 1, repository: "github.com/o/r", issues: {}, creates: {} }));
		const listed = campaigns(cwd);
		expect(listed.map(s => s.root)).toEqual(["gh-1"]);
		expect(summary(listed[0])).toMatchObject({ root: "gh-1", finished: "done", chains: {} });
	} finally { rmSync(cwd, { recursive: true, force: true }); }
});
