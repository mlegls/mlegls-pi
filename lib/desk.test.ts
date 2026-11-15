import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanDesk, removeAttention } from "./desk";

test("desk writes retain archived-owner attention, recover its owner, and drop archived-owner roles", async () => {
	const repo = mkdtempSync("/tmp/desk-");
	const saved = process.env.BB_CLI;
	try {
		execFileSync("git", ["-C", repo, "init", "-q"]);
		const cli = join(repo, "bb");
		writeFileSync(cli, "#!/bin/sh\nprintf '%s\\n' '[{\"id\":\"thr_old\",\"archivedAt\":1},{\"id\":\"thr_pickup\",\"archivedAt\":null},{\"id\":\"thr_role\",\"archivedAt\":null}]'\n");
		chmodSync(cli, 0o755);
		process.env.BB_CLI = cli;
		mkdirSync(join(repo, "desk"));
		mkdirSync(join(repo, ".git/pickup"));
		const roles = join(repo, "desk/ROLES.md"), attention = join(repo, "desk/ATTENTION.md");
		for (const scenario of [
			{ pickup: { enabled: true, owner: "thr_pickup" }, role: "thr_role", target: "thr_pickup" },
			{ pickup: { enabled: true, owner: "thr_old" }, role: "thr_role", target: "thr_role" },
			{ pickup: { enabled: false, owner: "thr_pickup" }, role: "thr_role", target: "thr_role" },
			{ pickup: null, role: "thr_role", target: "thr_role" },
			{ pickup: null, role: "thr_old", target: null },
		]) {
			writeFileSync(join(repo, ".git/pickup/state.json"), JSON.stringify(scenario.pickup));
			writeFileSync(roles, "# Roles\n- working: @thread:thr_old — expired\n- role: supervisor — @thread:" + scenario.role + "\n");
			writeFileSync(attention, "# Attention\n\n## Still needed\n\nOwner: @thread:thr_old\n\nPlease decide.\n");
			await cleanDesk(repo);
			const first = readFileSync(attention, "utf8");
			expect(first).toContain("## Still needed");
			expect(first).toContain("Please decide.");
			expect(first).toContain(scenario.target ? "Owner: @thread:" + scenario.target : "Owner: @thread:thr_old (owner gone)");
			if (scenario.target) expect(first).toContain("Previous owner: @thread:thr_old");
			expect(readFileSync(roles, "utf8")).not.toContain("@thread:thr_old");
			await cleanDesk(repo);
			expect(readFileSync(attention, "utf8")).toBe(first);
			await removeAttention(scenario.target ?? "thr_old", "Still needed", repo);
			expect(readFileSync(attention, "utf8")).not.toContain("## Still needed");
		}
	} finally {
		if (saved === undefined) delete process.env.BB_CLI; else process.env.BB_CLI = saved;
		rmSync(repo, { recursive: true, force: true });
	}
});
