import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { saveThread } from "../../../lib/thread/registry";
import { send } from "../../../lib/board/store";

// Isolated CLI first-use state: no agents, credentials, or persistent registry edits.
const root = realpathSync(mkdtempSync(join(tmpdir(), "ab-row-")));
const saved = { ...process.env };
try {
	for (const key of Object.keys(process.env)) if (/^(PI_BOARD_.*|PI_WM_.*|PI_SESSION_.*|BB_THREAD_ID|AB_THREAD_ID|ZMX_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), ZMX_DIR: join(root, "zmx") });
	const cwd = process.cwd();
	const reason = "Archive conflict unresolved\nblocked: needs a decision\n" + "conflict details ".repeat(30);
	for (const id of ["parent", "child", "next"]) {
		await saveThread({ id, sessionId: id, sessionFile: join(root, id + ".jsonl"), cwd, project: cwd,
			ownership: "guest", archived: false, created: "2026-10-14T00:00:0" + ["parent", "child", "next"].indexOf(id) + "Z",
			...(id === "child" ? { parent: "parent", blocked: { action: "archive" as const, parentBranch: "main", files: [], reason } } : {}) });
	}
	send({ topic: "thread/child", tags: ["blocked"], from: { session: "child", name: "fixture" }, body: reason });
	const args = process.argv.slice(2);
	process.stdout.write(execFileSync("bun", [resolve("lib/thread/cli.ts"), "thread", "ls", ...args], { encoding: "utf8", env: process.env }));
} finally {
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
}
