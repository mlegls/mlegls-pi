import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "pi-board-cli-"));
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const cli = join(import.meta.dir, "board.ts");
function run(args: string[]) {
	const r = Bun.spawnSync(["bun", cli, ...args], { env: { ...process.env, PI_BOARD_DIR: dir } });
	return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

test("cli send then meta-read round-trips json", () => {
	const sent = run(["send", "c/u1", "--tag", "done", "--body", "okay"]);
	expect(sent.code).toBe(0);
	expect(JSON.parse(sent.stdout).body).toBe("okay");
	const listed = run(["read", "--topic", "c/*", "--tags", "done", "--fields", "meta", "--body-chars", "2"]);
	expect(listed.code).toBe(0);
	const batch = JSON.parse(listed.stdout);
	expect(batch).toMatchObject({ omitted: 0, total: 1 });
	expect(batch.messages[0]).toMatchObject({ topic: "c/u1", tags: ["done"], body: "ok" });
	expect(batch.messages[0].data).toBeUndefined();
});

test("cli wait requires from-offset", () => {
	const r = run(["wait", "--topic", "x"]);
	expect(r.code).not.toBe(0);
	expect(r.stderr).toContain("from-offset");
});
