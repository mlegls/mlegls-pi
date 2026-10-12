// bin/bb-pi gives a worker's identity (.wm/launch.env) to the pi bb runs on the thread's session, and only to it: bb
// also starts a sessionless pi in the same worktree, which with that identity took turns on the worker's board topic
// as a second writer (docs/issues/bb-move-leaves-source-pi-running.md).
import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const bbPi = fileURLToPath(new URL("../../bin/bb-pi", import.meta.url));

test("only the session-carrying pi bb starts in a worktree gets the worker's identity", () => {
	const dir = mkdtempSync(join(tmpdir(), "bb-pi-"));
	const bin = join(dir, "bin");
	mkdirSync(bin);
	writeFileSync(join(bin, "pi"), "#!/bin/sh\necho \"$PI_BOARD_TOPIC\"\n");
	chmodSync(join(bin, "pi"), 0o755);
	const cwd = join(dir, "worktree");
	mkdirSync(join(cwd, ".wm"), { recursive: true });
	writeFileSync(join(cwd, ".wm", "launch.env"), "PI_BOARD_TOPIC='run/worker-1'\n");
	const topic = (...args: string[]) => {
		const { stdout } = Bun.spawnSync([bbPi, ...args], { cwd, env: { PATH: bin + ":/usr/bin:/bin" } });
		return stdout.toString().trim();
	};
	expect(topic("--mode", "rpc", "--session", join(dir, "s.jsonl"))).toBe("run/worker-1");
	expect(topic("--mode", "rpc", "--no-session", "--extension", "x.mjs")).toBe("");
});
