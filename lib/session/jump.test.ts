import { expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fakeBb } from "../thread/fake-bb";
import { childSession } from "./jump";

let root: string, saved: NodeJS.ProcessEnv;
beforeEach(() => { saved = { ...process.env }; root = mkdtempSync(join(tmpdir(), "jump-repo-")); });
afterEach(() => { process.env = saved; rmSync(root, { recursive: true, force: true }); });

// Replays wm-workers-over-threads drive check 2: /jump follows the worker's bb thread to its current pi session.
test("jump resolves the worker's session file from its bb thread; unknown handles are errors", async () => {
	const project = join(realpathSync(root), "main");
	execFileSync("git", ["init", "-q", "-b", "main", project]);
	execFileSync("git", ["-C", project, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root"]);
	process.env.BB_PI_BRIDGE_SESSION_DIR = join(root, "sessions");
	const bb = fakeBb(root);
	bb.addThread("bbt-w", project, "r/w");
	writeFileSync(join(bb.dir, "thread-bbt-w.json"), JSON.stringify({ ...bb.threads()[0], events: [{ seq: 1, type: "thread/identity", createdAt: 1, data: { providerThreadId: "pi-w" } }] }));
	expect(await childSession("w", project)).toBe(join(root, "sessions", "pi-w.jsonl"));
	await expect(childSession("missing", project)).rejects.toThrow("no registered worker");
});
