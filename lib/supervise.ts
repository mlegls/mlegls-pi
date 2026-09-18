// Serial join controller. Caller owns subscriptions: do not wake on worker topics.
// bun lib/supervise.ts request.json > result.json
// request: {run, handles:[{handle,ticket,agent}], testCommand:"bun test", cwd?, maxRetries?}
// Pending carries resumable state. Resolve via wm.send (or edit state.handles), then
// pass result.state back next turn. No wake primitive. ticket is reread on respawn.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as wm from "./wm";
import { decide, type Questions, type Options, type State, type Decisions, type Ask } from "./decide";
import { readAll, send as post, type Message } from "../extensions/board/store";

export interface Handle {
 handle: string;
 ticket: string;
 agent: string;
 retries?: number;
 conflictSent?: boolean;
}
export interface Metrics { reports: number; decisions: number; respawns: number; coordinatorBytes: number }
export interface Supervision {
 run: string;
 handles: Handle[];
 testCommand: string;
 cwd?: string;
 maxRetries?: number;
 decisionOptions?: Options;
 seen?: string[];
 metrics?: Metrics;
}
export interface TestResult { exitCode: number; tail: string }
export type MergeResult = { kind: "merged" } | { kind: "conflict"; files: string[] } | { kind: "error"; error: string };
export interface Evidence { report: string; merge: string; tests: string }
export const questions = {
 route: { type: "choice", instructions: "Classify the worker outcome. Checkpoint defaults to respawn, not steering. Never call a failed test or unresolved merge clean. Requests for choices or scope changes belong to the coordinator.", criteria: {
  clean: "Done report, successful merge and passing tests; no unresolved decision.",
  "needs-merge-attention": "Merge conflicts the worker can resolve on its branch.",
  "needs-decision": "A coordinator choice, blocked requirement, ambiguous outcome, or failed tests needing a decision.",
  respawn: "Checkpoint/context exhaustion or exited worker: resume ticket in a fresh session."
 } },
 excerpt: { type: "choice", instructions: "Select the evidence most relevant for the coordinator to decide what happens next.", criteria: {
  report: "Worker report or question", merge: "Merge conflict or error", tests: "Project test output"
 } }
} satisfies Questions;

export function evidence(outcome: wm.Outcome, merge: MergeResult, tests: TestResult): Evidence {
 return { report: JSON.stringify({ kind: outcome.kind, body: ("message" in outcome ? outcome.message.body : outcome.tail).slice(-12000) }),
  merge: JSON.stringify(merge), tests: JSON.stringify({ exitCode: tests.exitCode, tail: tests.tail.slice(-8000) }) };
}
export interface Dependencies {
 attach: typeof wm.attach;
 wait: typeof wm.wait;
 merge: typeof wm.merge;
 spawn: typeof wm.spawn;
 decide: (state: State, questions: Questions, options?: Options) => Promise<Decisions | Ask>;
 test: (command: string, cwd: string) => Promise<TestResult>;
 ticket: (path: string) => string;
 reports: () => Message[];
 ack: (message: Message) => void | Promise<void>;
}
// Drain both streams with bounded memory, including suites longer than a tool deadline.
async function test(command: string, cwd: string): Promise<TestResult> {
 const child = Bun.spawn(["bash", "-lc", command], { cwd, stdout: "pipe", stderr: "pipe" });
 let tail = "";
 async function drain(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  for await (const bytes of stream) tail = (tail + decoder.decode(bytes, { stream: true })).slice(-8000);
  tail = (tail + decoder.decode()).slice(-8000);
 }
 await Promise.all([drain(child.stdout), drain(child.stderr)]);
 return { exitCode: await child.exited, tail };
}
const defaults: Dependencies = {
 attach: wm.attach, wait: wm.wait, merge: wm.merge, spawn: wm.spawn, decide, test,
 ticket: path => readFileSync(path, "utf8"), reports: readAll,
 // Delivery acks are session-local; a script records seen IDs and a protocol ack,
 // not another pi session's delivery queue.
 ack: message => { post({ topic: message.topic, tags: ["ack"], body: "Handled " + message.id, data: { id: message.id }, from: { name: "supervise" } }); }
};
export type Result =
 | { kind: "done"; state: Supervision }
 | { kind: "pending"; handle: string; report: wm.Outcome; excerpt: { source: keyof Evidence; text: string }; evidence: Evidence; reason: string; state: Supervision };

export async function supervise(input: Supervision, overrides: Partial<Dependencies> = {}): Promise<Result> {
 const d = { ...defaults, ...overrides };
 const state: Supervision = structuredClone(input);
 const cwd = state.cwd = resolve(state.cwd ?? process.cwd());
 const limit = state.maxRetries ?? 2;
 if (!state.run || !state.testCommand || !Number.isInteger(limit) || limit < 0) throw new Error("run, testCommand and nonnegative maxRetries required");
 if (new Set(state.handles.map(h => h.handle)).size !== state.handles.length || state.handles.some(h => !h.handle || !h.ticket || !h.agent)) throw new Error("Unique handles with ticket and agent required");
 const seen = new Set(state.seen ?? []);
 const metrics = state.metrics ??= { reports: 0, decisions: 0, respawns: 0, coordinatorBytes: 0 };
 const workers = new Map<string, wm.Worker>();
 const queued: Array<[wm.Worker, wm.Outcome]> = [];
 const terminal = ["done", "blocked", "needs-input", "checkpoint"] as const;
 try {
  const history = d.reports();
  for (const h of state.handles) {
   const w = d.attach(state.run, h.handle, cwd);
   workers.set(h.handle, w);
   // Earlier checkpoints are superseded by the latest terminal report.
   const m = history.findLast(m => m.topic === w.topic && terminal.some(t => m.tags.includes(t)));
   if (m && !seen.has(m.id)) queued.push([w, { kind: terminal.find(t => m.tags.includes(t))!, message: m }]);
  }
  while (workers.size) {
   if (!queued.length) queued.push(...await d.wait([...workers.values()], { mode: "any" }));
   const item = queued.shift();
   if (!item) continue;
   const [w, report] = item;
   const h = state.handles.find(h => h.handle === w.handle);
   if (!h || ("message" in report && seen.has(report.message.id))) continue;
   let merge: MergeResult;
   try { await d.merge(w); merge = { kind: "merged" }; }
   catch (error) { merge = error instanceof wm.MergeConflict ? { kind: "conflict", files: error.files } : { kind: "error", error: String(error) }; }
   let tests: TestResult;
   try { tests = await d.test(state.testCommand, cwd); }
   catch (error) { tests = { exitCode: -1, tail: String(error) }; }
   const context = evidence(report, merge, tests);
   let route: string = "needs-decision", source: keyof Evidence = "report", reason = "";
   try {
    const answer = await d.decide({ ...context }, questions, state.decisionOptions);
    if ("kind" in answer) reason = "Decision backend asks the caller";
    else { route = answer.route.choice; if (Object.hasOwn(context, answer.excerpt?.choice)) source = answer.excerpt.choice as keyof Evidence; }
   } catch (error) { reason = "Classification failed: " + error; }
   metrics.reports++;
   if ("message" in report) seen.add(report.message.id);
   state.seen = [...seen];
   // Guard destructive cleanup even if classification contradicts execution evidence.
   if (route === "clean" && (report.kind !== "done" || merge.kind !== "merged" || tests.exitCode !== 0)) { route = "needs-decision"; reason = "Clean classification contradicted execution evidence"; }
   if (route === "needs-merge-attention" && merge.kind === "conflict" && !h.conflictSent) {
    await w.send("Merge conflicts: " + merge.files.join(", ") + "\nMerge the coordinator branch into yours, resolve and commit, then report again.");
    h.conflictSent = true;
    continue;
   }
   if (route === "clean") {
    if ("message" in report) await d.ack(report.message);
    await w.close();
    workers.delete(w.handle);
    state.handles = state.handles.filter(j => j !== h);
    continue;
   }
   if (route === "respawn" && (h.retries ?? 0) < limit && merge.kind !== "error") {
    const ticket = d.ticket(resolve(cwd, h.ticket));
    const retries = (h.retries ?? 0) + 1;
    const handle = h.handle + "-retry" + retries;
    await w.close(true);
    workers.delete(w.handle);
    const next = await d.spawn({ run: state.run, handle, agent: h.agent, base: w.branch, cwd,
     prompt: "Hacking session. Continue the ticket from the checkpoint commits on this branch. Read " + h.ticket + "; it is the source of scope. Commit coherent chunks and report on the board.\n\n" + ticket });
    Object.assign(h, { handle, retries, conflictSent: false });
    workers.set(handle, next);
    metrics.respawns++;
    continue;
   }
   reason ||= route === "respawn" ? "Respawn limit reached or merge failed" : route === "needs-merge-attention" ? "Conflict already sent once or no conflict list" : "Coordinator decision required";
   metrics.decisions++;
   const payload = { kind: "pending" as const, handle: h.handle, report, excerpt: { source, text: context[source] }, evidence: context, reason };
   metrics.coordinatorBytes += Buffer.byteLength(JSON.stringify(payload));
   return { ...payload, state };
  }
  return { kind: "done", state };
 } finally { for (const w of workers.values()) w.drop(); }
}

if (import.meta.main) {
 const path = process.argv[2];
 if (!path) { console.error("usage: bun lib/supervise.ts request.json"); process.exit(2); }
 console.log(JSON.stringify(await supervise(JSON.parse(readFileSync(path, "utf8"))), null, 2));
}
