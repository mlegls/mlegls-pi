// Synchronous ticket loop (bulk-synchronous, Ralph-style): each iteration triages the ready frontier into one
// mutually independent batch, runs it through implement → verify → integrate as a parallel map (supervise's
// script in batch mode), and joins at a barrier. Exceptions never wake anyone: the child is deferred (branch
// kept) and recorded in the loop's ledger, which the next triage reads. The ledger is also triage's journal.
//   ab supervise loop [target] [--budget N] [--timebox MIN] [--test CMD] [--model M] [--effort E]
// Without a target the whole tracker is in scope; with nothing to do the loop idles until docs/issues changes.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, watch } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import type { JobContext } from "../daemon.ts";
import * as supervise from "./supervise.ts";

export interface Input { carried?: State | null; target: string; cwd: string; ownerSession?: string; budget: number; timebox: number; test?: string; model: string; effort: string; ledger: string; commands: string; run: string }
interface Batch { items: string[]; deadline: number; state: unknown }
export interface State { iteration: number; batch?: Batch; held: Record<string, string>; triages: number }
interface Issue { slug: string; file: string; partOf: string | null; frontier: boolean; done: boolean; archived?: boolean; priority?: string | null; effectiveStage: string }

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const IDLE_MAX_MS = 30 * 60_000;
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);

// In-flight overlay stays on: work other sessions have claimed is not ours to schedule.
function candidates(input: Input): Issue[] {
 const issues: Issue[] = JSON.parse(execFileSync("bun", [TRACKER, "snapshot", ...(input.target ? [input.target] : []), "--json"], { cwd: input.cwd, encoding: "utf8" })).issues;
 return issues.filter(i => i.frontier && !i.done && !i.archived && !issues.some(j => j.partOf === i.slug && !j.done));
}

function ledgerTail(file: string, n = 60) {
 if (!existsSync(file)) return "(empty: first iteration)";
 return readFileSync(file, "utf8").trimEnd().split("\n").slice(-n).join("\n");
}

function pi(prompt: string, model: string, effort: string, signal: AbortSignal): Promise<string> {
 return new Promise((resolve, reject) => {
  const child = spawn("pi", ["-p", "--no-session", "--no-tools", "--model", model, "--thinking", effort], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  const kill = () => child.kill();
  signal.addEventListener("abort", kill, { once: true });
  child.stdout.on("data", d => out += d); child.stderr.on("data", d => err += d);
  child.on("error", reject);
  child.on("close", code => { signal.removeEventListener("abort", kill); code === 0 ? resolve(out) : reject(new Error("pi exited " + code + ": " + err.trim().split("\n").pop())); });
  child.stdin.end(prompt);
 });
}

interface Triage { batch: string[]; hold: { slug: string; question: string }[]; notes: string }
async function triage(input: Input, ready: Issue[], signal: AbortSignal): Promise<Triage> {
 const tickets = ready.map(i => "### " + i.slug + " (priority " + (i.priority ?? "?") + ", stage " + i.effectiveStage + (i.partOf ? ", part of " + i.partOf : "") + ")\n" + readFileSync(i.file, "utf8").slice(0, 2500)).join("\n\n");
 const prompt = [
  "You triage one iteration of a synchronous ticket loop. Everything you pick runs in parallel on separate branches from the same base, each through implement → verify → integrate, and the iteration ends when all of them integrate or are deferred. Choose the highest-priority batch of at most " + input.budget + " tickets that are mutually independent: no two should change the same interface, data shape or files in ways that conflict semantically. Textual merge conflicts are cheap (the ticket is deferred and retried); semantic collisions are not. Prefer tickets of similar expected size in one batch, since the barrier waits for the slowest (timebox " + input.timebox + " min).",
  "Hold a ticket instead when it cannot succeed without its author: the ledger shows it deferred for needs-input, blocked, or a contract problem, and its text has not answered that. A held ticket is skipped until its file changes. Give each hold the specific question the author must answer.",
  "A ticket deferred for a transient reason (timeboxed, merge conflict, flaky environment, launch failure) may be retried.",
  "notes: short durable observations future triages should know (ordering constraints you discovered, recurring causes). They are recorded in the ledger, which is your journal: read earlier triage notes below and do not re-derive what they settle.",
  "Reply with only a JSON object: {\"batch\": [slug...], \"hold\": [{\"slug\": ..., \"question\": ...}], \"notes\": \"...\"}.",
  "## Loop ledger (most recent last, JSON lines)\n\n" + ledgerTail(input.ledger),
  "## Ready tickets\n\n" + tickets,
 ].join("\n\n");
 const text = await pi(prompt, input.model, input.effort, signal);
 const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
 const t = JSON.parse(json) as Triage;
 const known = new Set(ready.map(i => i.slug));
 return { batch: (t.batch ?? []).filter(s => known.has(s)).slice(0, input.budget), hold: (t.hold ?? []).filter(h => known.has(h?.slug)), notes: t.notes ?? "" };
}

// Idle until the tracker changes (a new or edited ticket, an integration closing one), or a safety interval.
function changed(cwd: string, signal: AbortSignal) {
 return new Promise<void>(done => {
  let timer: ReturnType<typeof setTimeout>;
  const finish = () => { clearTimeout(timer); watcher.close(); signal.removeEventListener("abort", finish); done(); };
  const watcher = watch(join(cwd, "docs/issues"), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(finish, 5000); });
  setTimeout(finish, IDLE_MAX_MS);
  signal.addEventListener("abort", finish, { once: true });
 });
}

export async function run(job: JobContext) {
 const input = job.input as Input;
 const state: State = (job.state as State | null) ?? input.carried ?? { iteration: 0, held: {}, triages: 0 };
 const save = () => job.save(state);
 const record = (entry: Record<string, unknown>) => appendFileSync(input.ledger, JSON.stringify({ at: new Date().toISOString(), iteration: state.iteration, ...entry }) + "\n");
 let idle = false;
 while (!job.signal.aborted) {
  if (!state.batch) {
   const ready = candidates(input).filter(i => state.held[i.slug] !== hash(i.file));
   if (!ready.length) {
    if (!idle) record({ kind: "idle" });
    idle = true; await changed(input.cwd, job.signal); continue;
   }
   let t: Triage;
   try { t = await triage(input, ready, job.signal); state.triages++; }
   catch (error) { record({ kind: "triage-failed", error: String(error).slice(0, 500) }); await changed(input.cwd, job.signal); continue; }
   for (const h of t.hold) { const i = ready.find(i => i.slug === h.slug)!; state.held[h.slug] = hash(i.file); }
   record({ kind: "triage", ready: ready.map(i => i.slug), batch: t.batch, hold: t.hold, notes: t.notes });
   if (!t.batch.length) { await save(); if (!idle) record({ kind: "idle" }); idle = true; await changed(input.cwd, job.signal); continue; }
   idle = false;
   state.batch = { items: t.batch, deadline: Date.now() + input.timebox * 60_000, state: null };
   await save();
  }
  const b = state.batch;
  const sub: JobContext = {
   id: job.id + "-" + state.iteration, signal: job.signal, log: job.log, state: b.state,
   save: async s => { b.state = s; await save(); },
   input: { ticket: input.target, run: input.run, cwd: input.cwd, owner: "", ownerSession: input.ownerSession, budget: b.items.length, test: input.test, commands: input.commands, items: b.items, ledger: input.ledger, deadline: b.deadline } satisfies supervise.Input,
  };
  await supervise.run(sub);
  if (job.signal.aborted) return;
  delete state.batch; state.iteration++;
  await save();
 }
}
