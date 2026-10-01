// Review redrive of /thread archive|abandon|merge through real canonical pi TUIs.
// Usage: bun redrive.ts ROOT   (ROOT from fixture.ts prepare; run fixture.ts cleanup ROOT after)
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { newThread, sendThread } from "../../../lib/thread";
import { allThreads, getThread } from "../../../lib/thread/registry";
import { readLive } from "../../../lib/session-meta/live";

const root = process.argv[2]!;
const f = JSON.parse(await readFile(join(root, "fixture.json"), "utf8"));
for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_SESSION_.*|AB_THREAD_ID|TMUX(?:_PANE)?|ZMX_SESSION)$/.test(key)) delete process.env[key];
Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), ZMX_DIR: join(root, "zmx"), PI_CODING_AGENT_DIR: join(root, "agent") });
process.chdir(f.repo);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until<T>(get: () => T | Promise<T>, label: string): Promise<NonNullable<T>> {
	for (let i = 0; i < 120; i++) { const v = await get(); if (v) return v as NonNullable<T>; await sleep(500); }
	throw new Error("Timed out: " + label);
}
const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8" }).trim();
const log = (event: string, data: unknown) => console.log(JSON.stringify({ event, ...(data as object) }));
async function child(name: string) {
	const t = await newThread({ cwd: f.repo, worktree: name, parent: f.thread });
	await until(() => readLive().find(l => l.sessionId === t.sessionId), name + " pi ready");
	return t;
}
// 1. bare /thread merge inside an owning child with a commit: merges into main, retires, its pi exits.
const m = await child("m");
await writeFile(join(m.cwd, "m.txt"), "m\n"); git(m.cwd, "add", "m.txt"); git(m.cwd, "commit", "-qm", "m");
await sendThread(m.id, "/thread merge\r");
await until(async () => (await getThread(m.id))?.archived, "m archived");
log("merge-bare", { archived: true, mainHasFile: git(f.repo, "ls-files", "m.txt"), branches: git(f.repo, "branch", "--format=%(refname:short)"), pi: readLive().some(l => l.sessionId === m.sessionId) });
// 2. bare /thread abandon inside an owning child: no merge.
const a = await child("a");
await writeFile(join(a.cwd, "a.txt"), "a\n"); git(a.cwd, "add", "a.txt"); git(a.cwd, "commit", "-qm", "a");
await sendThread(a.id, "/thread abandon\r");
await until(async () => (await getThread(a.id))?.archived, "a archived");
log("abandon-bare", { mainHasFile: git(f.repo, "ls-files", "a.txt"), branches: git(f.repo, "branch", "--format=%(refname:short)") });
// 3. /thread archive <id> typed in the source thread's pi addressing its child; the source stays.
const b = await child("b");
await writeFile(join(b.cwd, "b.txt"), "b\n"); git(b.cwd, "add", "b.txt"); git(b.cwd, "commit", "-qm", "b");
await sendThread(f.thread, "/thread archive " + b.id + "\r");
await until(async () => (await getThread(b.id))?.archived, "b archived");
log("archive-by-id", { mainHasFile: git(f.repo, "ls-files", "b.txt"), sourceActive: !(await getThread(f.thread))!.archived, sourcePi: readLive().some(l => l.sessionId === (readLive().find(x => x.thread === f.thread)?.sessionId)) });
// 4. bare /thread archive in a child that has a child: subtree walk from inside, post-order.
const p = await child("p");
const q = await newThread({ cwd: p.cwd, worktree: "q", parent: p.id });
await until(() => readLive().find(l => l.sessionId === q.sessionId), "q pi ready");
await writeFile(join(q.cwd, "q.txt"), "q\n"); git(q.cwd, "add", "q.txt"); git(q.cwd, "commit", "-qm", "q");
await sendThread(p.id, "/thread archive\r");
await until(async () => (await getThread(p.id))?.archived && (await getThread(q.id))?.archived, "p,q archived");
log("archive-subtree", { branches: git(f.repo, "branch", "--format=%(refname:short)"), threads: (await allThreads(true)).map(t => [t.branch, t.archived]) });
