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
	expect(batch.messages[0]).toMatchObject({ topic: "c/u1", tags: ["done"], body: "ok", bodyTruncated: true });
	expect(batch.messages[0].data).toBeUndefined();
});

test("cli help bypasses validation and usage errors stay on stderr", () => {
	const help = run(["--help"]);
	expect(help.code).toBe(0);
	expect(help.stderr).toBe("");
	expect(help.stdout).toStartWith("usage: bun lib/board.ts cursor\n");
	for (const args of [["-h"], ["help"], ["wait", "--help"], ["send", "--help"], ["read", "--limit", "nope", "--help"]]) {
		expect(run(args)).toEqual(help);
	}
	for (const [args, message] of [
		[["wait", "--topic", "x"], "--from-offset required (bun lib/board.ts cursor before spawn)"],
		[["send"], "topic required"],
	] as const) {
		const r = run([...args]);
		expect(r).toEqual({ code: 2, stdout: "", stderr: `error: ${message}\n${help.stdout}` });
	}
	expect(run(["unknown"])).toEqual({ code: 2, stdout: "", stderr: help.stdout });
});

test("cli rejects non-integer numeric flags", () => {
	expect(run(["wait", "--topic", "x", "--from-offset", "nope"]).stderr).toContain("from-offset");
	expect(run(["wait", "--topic", "x", "--from-offset", "-1"]).stderr).toContain("from-offset");
	expect(run(["read", "--limit", "1.5"]).stderr).toContain("limit");
	expect(run(["read", "--fields", "meta", "--body-chars", "NaN"]).stderr).toContain("body-chars");
	expect(run(["wait", "--topic", "x", "--from-offset", "0", "--timeout", "-2"]).stderr).toContain("timeout");
});
