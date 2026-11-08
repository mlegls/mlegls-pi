// bin/bb-pi gives a worker's identity (.wm/launch.env) to the pi bb runs on the thread's session, and only to it: bb
// also starts a sessionless pi in the same worktree, which with that identity took turns on the worker's handle
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
	writeFileSync(join(bin, "pi"), "#!/bin/sh\necho \"$PI_WM_HANDLE\"\n");
	chmodSync(join(bin, "pi"), 0o755);
	const cwd = join(dir, "worktree");
	mkdirSync(join(cwd, ".wm"), { recursive: true });
	writeFileSync(join(cwd, ".wm", "launch.env"), "PI_WM_HANDLE='run/worker-1'\n");
	const topic = (...args: string[]) => {
		const { stdout } = Bun.spawnSync([bbPi, ...args], { cwd, env: { PATH: bin + ":/usr/bin:/bin" } });
		return stdout.toString().trim();
	};
	expect(topic("--mode", "rpc", "--session", join(dir, "s.jsonl"))).toBe("run/worker-1");
	expect(topic("--mode", "rpc", "--no-session", "--extension", "x.mjs")).toBe("");
});

// bb's own --append-system-prompt stops pi discovering APPEND_SYSTEM.md, so bb-pi passes it after bb's.
test("the personal APPEND_SYSTEM.md follows bb's appended prompt", () => {
	const dir = mkdtempSync(join(tmpdir(), "bb-pi-"));
	const bin = join(dir, "bin");
	mkdirSync(bin);
	writeFileSync(join(bin, "pi"), "#!/bin/sh\necho \"$@\"\n");
	chmodSync(join(bin, "pi"), 0o755);
	const agent = join(dir, "agent");
	mkdirSync(agent);
	const run = (...args: string[]) => Bun.spawnSync([bbPi, ...args], { cwd: dir, env: { PATH: bin + ":/usr/bin:/bin", PI_CODING_AGENT_DIR: agent } }).stdout.toString().trim();
	expect(run("--append-system-prompt", "bb.md")).toBe("--append-system-prompt bb.md");
	writeFileSync(join(agent, "APPEND_SYSTEM.md"), "mine");
	expect(run("--append-system-prompt", "bb.md")).toBe("--append-system-prompt bb.md --append-system-prompt " + join(agent, "APPEND_SYSTEM.md"));
	expect(run("--mode", "rpc")).toBe("--mode rpc");
});
