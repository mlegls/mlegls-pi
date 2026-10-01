// Captures the pi screens right after a lifecycle command, for the review packet.
// Usage: bun redrive-capture.ts ROOT
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { historyThread, newThread, sendThread } from "../../../lib/thread";
import { getThread } from "../../../lib/thread/registry";
import { readLive } from "../../../lib/session-meta/live";

const root = process.argv[2]!;
const f = JSON.parse(await readFile(join(root, "fixture.json"), "utf8"));
for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_SESSION_.*|AB_THREAD_ID|TMUX(?:_PANE)?|ZMX_SESSION)$/.test(key)) delete process.env[key];
Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), ZMX_DIR: join(root, "zmx"), PI_CODING_AGENT_DIR: join(root, "agent") });
process.chdir(f.repo);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8" }).trim();
async function child(name: string) {
	const t = await newThread({ cwd: f.repo, worktree: name, parent: f.thread });
	for (let i = 0; i < 120 && !readLive().some(l => l.sessionId === t.sessionId); i++) await sleep(500);
	await writeFile(join(t.cwd, name + ".txt"), name + "\n"); git(t.cwd, "add", name + ".txt"); git(t.cwd, "commit", "-qm", name);
	return t;
}
const x = await child("x");
await sendThread(f.thread, "/thread archive " + x.id + "\r");
for (let i = 0; i < 60 && !(await getThread(x.id))?.archived; i++) await sleep(500);
await sleep(1000);
let out = "## source pi after /thread archive <child id>\n" + await historyThread(f.thread);
const y = await child("y");
await sendThread(y.id, "/thread merge\r");
for (let i = 0; i < 100; i++) {
	const h = await historyThread(y.id).catch(() => "");
	if (h.includes("Running ab thread")) { out += "\n## child pi after bare /thread merge\n" + h; break; }
	await sleep(50);
}
await writeFile(join(import.meta.dir, "redrive-screens.txt"), out);
