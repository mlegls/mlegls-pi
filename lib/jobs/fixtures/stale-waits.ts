// Isolated replay for docs/attachments/surface-stale-waits-after-owner-replies/index.md.
// Real loop, Git and CLI; fixture worker transport, tracker and daemon status response.
import { mock, setSystemTime } from "bun:test";
import { mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { State } from "../supervise";

const root = realpathSync(process.env.HOME!);
const repo = join(root, "repo");
mkdirSync(repo);
const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
git("init", "-q"); git("-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-qm", "fixture");
const tracker = join(root, ".pi/agent/skills/tracker/scripts");
mkdirSync(tracker, { recursive: true });
writeFileSync(join(tracker, "issues.ts"), 'console.log(JSON.stringify({issues:[]}));');
const commands = join(root, "commands");
writeFileSync(commands, "");
const input = { ticket: "fixture", cwd: repo, owner: "mail/fixture", ownerSession: "fixture-owner", budget: 1, commands };
let saved: State = { children: { leaf: { slug: "leaf", phase: "implement", handle: { run: "fixture", handle: "leaf", path: repo }, startup: { launchedAt: 0, mode: "command" } } }, integrated: [], metrics: { wakes: 0, ownerBytes: 0, launched: 0, completed: 0 } };
const statusFile = join(root, "status.json");
const preload = join(root, "status-preload.ts");
writeFileSync(preload, `import {mock} from 'bun:test'; import {readFileSync} from 'node:fs'; mock.module(${JSON.stringify(resolve("lib/daemon.ts"))},()=>({status:async()=>JSON.parse(readFileSync(${JSON.stringify(statusFile)},'utf8'))}));`);
function status(empty = false) {
 writeFileSync(statusFile, JSON.stringify(empty ? [] : [{ id: "fixture-job", type: "supervise", status: "running", input, state: saved }]));
 return execFileSync(process.execPath, ["--preload", preload, resolve("ab/main.ts"), "supervise", "status", "fixture"], { cwd: repo, encoding: "utf8" }).trim();
}

const messages: { at: string; text: string }[] = [];
let releaseNotice!: () => void;
const noticeHeld = new Promise<void>(resolve => { releaseNotice = resolve; });
let latest: any = null;
let pending: ((turn: any) => void) | undefined;
const turns: any[] = [];
let watches = 0;
function report(cursor: string, text: string) {
 latest = { id: "fixture/leaf", kind: "finished", cursor, text };
 if (pending) { const deliver = pending; pending = undefined; deliver(latest); }
 else turns.push(latest);
}
mock.module(resolve("lib/children.ts"), () => ({
 last: async () => latest,
 send: async (_owner: string, text: string) => {
  await noticeHeld;
  messages.push({ at: new Date().toISOString(), text });
 },
 turnEnd: async (_ids: string[], options: { signal: AbortSignal }) => {
  watches++;
  if (turns.length) return turns.shift();
  return new Promise((resolve, reject) => {
   pending = resolve;
   const abort = () => { if (pending === resolve) pending = undefined; reject(new Error("aborted")); };
   if (options.signal.aborted) abort(); else options.signal.addEventListener("abort", abort, { once: true });
  });
 },
}));
const { run } = await import("../supervise");
// Advance the loop's wall clock and scheduled callbacks together, without waiting half an hour.
const realTimeout = globalThis.setTimeout;
const realClear = globalThis.clearTimeout;
let now = Date.parse("2026-09-30T12:00:00.000Z");
setSystemTime(now);
let serial = 0;
const timers = new Map<number, { at: number; fn: () => void }>();
globalThis.setTimeout = ((fn: () => void, ms: number) => { const id = ++serial; timers.set(id, { at: now + ms, fn }); return id; }) as any;
globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as any;
async function settle() { for (let i = 0; i < 4; i++) await new Promise(resolve => realTimeout(resolve, 5)); }
async function until(predicate: () => boolean) {
 for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => realTimeout(resolve, 5)); }
 throw new Error("fixture did not reach expected state");
}
async function advance(ms: number) {
 now += ms; setSystemTime(now);
 for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
 await settle();
}
let control: AbortController;
let running: Promise<void>;
function start() {
 control = new AbortController();
 running = run({ id: "fixture-job", input, state: structuredClone(saved), signal: control.signal, save: async state => { saved = structuredClone(state) as State; }, log: console.error });
}
async function stop() { control.abort(); await running; }
const observations: Record<string, unknown> = {};
const reminders = () => messages.filter(m => m.text.includes(": stale wait:"));
try {
 observations.empty = status(true);
 report("1", "blocked\nNeed owner decision"); start();
 await until(() => !!saved.children.leaf.waiting && !!pending);
 observations.initialStatus = status();
 await advance(31 * 60_000);
 observations.beforeMail = { reminders: reminders().length, status: status() };
 releaseNotice();
 await until(() => !!saved.children.leaf.exceptionMailAt && !!pending);
 observations.mailAt = messages[0].at;
 await advance(30 * 60_000 - 1);
 observations.beforeThreshold = reminders().length;
 await advance(1);
 await until(() => reminders().length === 1 && !!pending);
 observations.atThreshold = [...reminders()];
 await advance(30 * 60_000);
 observations.afterAnother30 = reminders().length;
 await stop(); start(); await until(() => !!pending);
 await advance(30 * 60_000);
 observations.afterRestart = reminders().length;
 // A new exception has its own reminder, but a subsequent child turn cancels it.
 report("2", "needs-input\nA different question");
 await until(() => saved.children.leaf.waiting === "needs-input" && !!saved.children.leaf.exceptionMailAt && !!pending);
 await advance(29 * 60_000);
 report("3", "checkpoint\nOwner steer received; working");
 await until(() => saved.children.leaf.waiting === "checkpoint" && !!pending);
 await advance(2 * 60_000);
 observations.childTurnBeforeThreshold = { reminders: reminders().length, status: status() };
 report("4", "blocked\nAnother exception");
 await until(() => saved.children.leaf.waiting === "blocked" && !!saved.children.leaf.exceptionMailAt && !!pending);
 observations.newExceptionStatus = status();
 await advance(30 * 60_000);
 await until(() => reminders().length === 2 && !!pending);
 observations.newExceptionReminders = [...reminders()];
 await advance(30 * 60_000);
 observations.finalReminders = reminders().length;
 observations.watches = watches;
 console.log(JSON.stringify(observations, null, 2));
} finally {
 releaseNotice(); await stop();
 globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClear; setSystemTime();
}
