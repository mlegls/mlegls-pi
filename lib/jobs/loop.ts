// Synchronous ticket loop (bulk-synchronous, Ralph-style): each iteration triages the ready frontier into one
// mutually independent batch, runs it through implement → drive → review → integrate as a parallel map (supervise's
// script in batch mode), and joins at a barrier, where a consolidation pass relates what landed together.
// Exceptions never wake anyone: the child is deferred (branch kept) and recorded in the loop's ledger, which
// the next triage reads. The ledger is also triage's journal.
//   ab supervise loop [target] [--budget N] [--timebox MIN] [--test CMD] [--model M] [--effort E]
// Without a target the whole tracker is in scope; with nothing to do the loop idles until docs/issues changes.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, watch, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { JobContext } from "../daemon.ts";
import * as supervise from "./supervise.ts";
import { agent, roleBody } from "../agents.ts";

export interface Input { carried?: State | null; target: string;
 // A subtree loop, run by its parent's barrier: it triages the node's children and returns once its subtree has
 // no ready work, joining and closing the node if its children are all done. The top level never returns.
 nested?: boolean;
 // The parent triage's note for this subtree, shown to every triage of it.
 note?: string; cwd: string; ownerSession?: string; budget: number; timebox: number; test?: string; model: string; effort: string; ledger: string; commands: string; run: string }
// items are leaves (one supervise batch); nodes are subtrees, each its own nested loop, and the barrier waits for all.
interface Batch { items: string[]; deadline: number; state: unknown; notes?: Record<string, string>; nodes?: Record<string, State | null> }
// tests: every earlier batch's driver tests; each later integration gate runs them all.
export interface State { iteration: number; batch?: Batch; final?: unknown; outcome?: string; held: Record<string, string>; triages: number; harness?: number; tests?: string[]; unjoined?: supervise.Input["unjoined"] }
interface Issue { slug: string; file: string; partOf: string | null; frontier: boolean; done: boolean; archived?: boolean; priority?: string | null; effectiveStage: string }

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const IDLE_MAX_MS = 30 * 60_000;
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);

// In-flight overlay stays on: work other sessions have claimed is not ours to schedule.
// Candidates are the target's direct children (the tracker's roots at the top level): ready leaves, and nodes
// with a ready leaf somewhere below. A leaf target is its own only candidate.
function snapshot(input: Input): Issue[] {
 return JSON.parse(execFileSync("bun", [TRACKER, "snapshot", ...(input.target ? [input.target] : []), "--json"], { cwd: input.cwd, encoding: "utf8" })).issues;
}
export function candidates(input: Input, issues = snapshot(input)): Issue[] {
 const open = (i: Issue) => !i.done && !i.archived;
 const kids = (slug: string) => issues.filter(j => j.partOf === slug && open(j));
 const ready = (i: Issue): boolean => { const k = kids(i.slug); return k.length ? k.some(ready) : i.frontier; };
 const slugs = new Set(issues.map(i => i.slug));
 const top = input.target ? kids(input.target) : issues.filter(i => !i.partOf || !slugs.has(i.partOf));
 const scope = input.target && !top.length && !input.nested ? issues.filter(i => i.slug === input.target) : top;
 return scope.filter(i => open(i) && ready(i));
}
// A node stays a node after its children are done: its own loop still owes the final join and closes it.
export const isNode = (issues: Issue[], slug: string) => issues.some(j => j.partOf === slug && !j.archived);

/** A hold becomes the author's to answer: the question goes into the issue and the issue goes to the human, so
 * the tracker (not the ledger) is the inbox and frontier skips it until it's handed back. */
export function holdOnIssue(cwd: string, file: string, question: string, iteration: number) {
	const text = readFileSync(file, "utf8");
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
	if (!m) throw new Error("no frontmatter in " + file);
	const fm = /^assignee:.*$/m.test(m[1]) ? m[1].replace(/^assignee:.*$/m, "assignee: human") : m[1] + "\nassignee: human";
	const body = text.slice(m[0].length).trimEnd();
	writeFileSync(file, "---\n" + fm + "\n---\n" + body + "\n\nQuestion from `ab supervise loop` (iteration " + iteration + ", " + new Date().toISOString().slice(0, 10) + "): " + question + " Answer here and set `assignee: agent` to send it back.\n");
	execFileSync("git", ["commit", "-qm", "hold " + file.replace(/.*\//, "").replace(/\.md$/, "") + ": question for the author", "--", file], { cwd, stdio: "ignore" });
}

// Deferrals the harness caused, not the ticket. Triage can't fix these by retrying or holding tickets.
export const HARNESS = /^(launch failed|worker did not start|unreachable|resume failed|loop error)/;

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

interface Triage { batch: string[]; hold: { slug: string; question: string }[]; context: Record<string, string>; notes: string }
async function triage(input: Input, ready: Issue[], issues: Issue[], signal: AbortSignal): Promise<Triage> {
 const below = (slug: string): Issue[] => issues.filter(j => j.partOf === slug && !j.done && !j.archived).flatMap(j => [j, ...below(j.slug)]);
 const tickets = ready.map(i => {
  const sub = below(i.slug);
  return "### " + i.slug + " (priority " + (i.priority ?? "?") + ", stage " + i.effectiveStage + (i.partOf ? ", part of " + i.partOf : "") + (sub.length ? ", subtree: " + sub.length + " open, " + sub.filter(j => j.frontier && !below(j.slug).length).length + " ready leaves" : "") + ")\n" + readFileSync(i.file, "utf8").slice(0, 2500)
   + (sub.length ? "\n\nOpen below it: " + sub.map(j => j.slug).join(", ") : "");
 }).join("\n\n");
 const triager = agent(input.nested ? "node-triage" : "triage");
 const prompt = [
  roleBody("triage"), triager?.body,
  (input.nested ? "You are the loop of node " + input.target + "; the items are its children." + (input.note ? " The parent loop's note for this subtree: " + input.note : "") : "You are the top-level loop; the items are the tracker's roots.") + " Budget: " + input.budget + " items. Timebox: " + input.timebox + " min for leaves; subtrees run until they have no ready work.",
  "## Loop ledger (most recent last, JSON lines)\n\n" + ledgerTail(input.ledger),
  "## Ready tickets\n\n" + tickets,
 ].filter(Boolean).join("\n\n");
 const text = await pi(prompt, input.model, input.effort, signal);
 const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
 const t = JSON.parse(json) as Triage;
 const known = new Set(ready.map(i => i.slug));
 const batch = (t.batch ?? []).filter(s => known.has(s)).slice(0, input.budget);
 return { batch, hold: (t.hold ?? []).filter(h => known.has(h?.slug)), context: Object.fromEntries(Object.entries(t.context ?? {}).filter(([s, n]) => batch.includes(s) && typeof n === "string")), notes: t.notes ?? "" };
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

// A subtree's budget: half the parent's, as in the supervision tree, but never below two.
const share = (budget: number) => Math.max(2, Math.floor(budget / 2));

export async function run(job: JobContext) {
 const input = job.input as Input;
 const state: State = (job.state as State | null) ?? input.carried ?? { iteration: 0, held: {}, triages: 0 };
 const save = () => job.save(state);
 if (!job.state) { delete state.harness; delete state.outcome; delete state.final; } // a fresh start gets a clean count
 if (state.outcome) return;
 const record = (entry: Record<string, unknown>) => appendFileSync(input.ledger, JSON.stringify({ at: new Date().toISOString(), iteration: state.iteration, ...entry }) + "\n");
 const sub = (id: string, over: Partial<supervise.Input>, get: () => unknown, set: (s: unknown) => void): JobContext => ({
  id, signal: job.signal, log: job.log, state: get(), save: async s => { set(s); await save(); },
  input: { ticket: input.target, run: input.run, cwd: input.cwd, owner: "", ownerSession: input.ownerSession, budget: 1, test: input.test, commands: input.commands, ledger: input.ledger, tests: state.tests, joinTimeboxMs: input.timebox * 60_000, unjoined: state.unjoined, ...over } satisfies supervise.Input,
 });
 const landed = (done: supervise.State | null) => {
  state.tests = [...new Set([...(state.tests ?? []), ...(done?.tests ?? [])])];
  if (done?.join?.done) delete state.unjoined;
  else if (done?.integrated.length) state.unjoined = { slugs: [...(state.unjoined?.slugs ?? []), ...done.integrated], base: state.unjoined?.base ?? done.base!, reviews: { ...state.unjoined?.reviews, ...done.reviews } };
 };
 // A subtree loop with no ready work returns to its parent: joined and closed if its children are all done.
 const finish = async (why: string) => {
  const issues = snapshot(input);
  if (candidates(input, issues).length || issues.some(i => i.partOf === input.target && !i.done && !i.archived)) {
   state.outcome = why; await save(); record({ kind: "returned", outcome: why }); return;
  }
  if (!(state.final as supervise.State | null)?.finished) {
   await supervise.run(sub(job.id + "-final", { items: [], nodeJoin: true, budget: 1 }, () => state.final ?? null, s => { state.final = s; }));
   if (job.signal.aborted) return;
  }
  const node = issues.find(i => i.slug === input.target);
  if (node && !node.done) await supervise.serialized(input.cwd, async () => {
   const text = readFileSync(node.file, "utf8");
   writeFileSync(node.file, /^stage: \w+$/m.test(text) ? text.replace(/^stage: \w+$/m, "stage: done") : text.replace(/^---\n/, "---\nstage: done\n"));
   await supervise.commitRetrying(input.cwd, "-qm", "Close " + input.target, "--", node.file);
  });
  state.outcome = "done"; await save(); record({ kind: "returned", outcome: "done" });
 };
 let idle = false;
 while (!job.signal.aborted) {
  if (!state.batch) {
   const issues = snapshot(input);
   const ready = candidates(input, issues).filter(i => state.held[i.slug] !== hash(i.file));
   if (!ready.length) {
    if (input.nested) return finish("no ready work");
    if (!idle) record({ kind: "idle" });
    idle = true; await changed(input.cwd, job.signal); continue;
   }
   let t: Triage;
   try { t = await triage(input, ready, issues, job.signal); state.triages++; }
   catch (error) {
    record({ kind: "triage-failed", error: String(error).slice(0, 500) });
    if (input.nested) return finish("triage failed");
    await changed(input.cwd, job.signal); continue;
   }
   for (const h of t.hold) {
    const i = ready.find(i => i.slug === h.slug)!;
    try { await supervise.serialized(input.cwd, async () => holdOnIssue(input.cwd, i.file, h.question, state.iteration)); }
    catch (error) { state.held[h.slug] = hash(i.file); record({ kind: "hold-unfiled", slug: h.slug, error: String(error).slice(0, 300) }); }
   }
   record({ kind: "triage", ready: ready.map(i => i.slug), batch: t.batch, hold: t.hold, context: t.context, notes: t.notes });
   if (!t.batch.length) {
    await save();
    if (input.nested) return finish("triage picked nothing");
    if (!idle) record({ kind: "idle" }); idle = true; await changed(input.cwd, job.signal); continue;
   }
   idle = false;
   const nodes = t.batch.filter(slug => isNode(issues, slug));
   state.batch = { items: t.batch.filter(slug => !nodes.includes(slug)), deadline: Date.now() + input.timebox * 60_000, state: null, notes: t.context, nodes: Object.fromEntries(nodes.map(n => [n, null])) };
   await save();
  }
  const b = state.batch;
  const nodeTriager = agent("node-triage");
  const runs: Promise<unknown>[] = [];
  if (b.items.length && !(b.state as supervise.State | null)?.finished)
   runs.push(supervise.run(sub(job.id + "-" + state.iteration, { items: b.items, deadline: b.deadline, notes: b.notes, budget: b.items.length }, () => b.state, s => { b.state = s; })));
  for (const slug of Object.keys(b.nodes ?? {})) {
   if (b.nodes![slug]?.outcome) continue;
   const name = "loop-" + slug.replace(/[^A-Za-z0-9_-]/g, "-"), dir = dirname(input.ledger);
   runs.push(run({
    id: job.id + "/" + slug, signal: job.signal, log: job.log, state: b.nodes![slug],
    save: async s => { b.nodes![slug] = s as State; await save(); },
    input: { target: slug, nested: true, cwd: input.cwd, ownerSession: input.ownerSession, budget: share(input.budget), timebox: input.timebox, test: input.test, model: nodeTriager?.model ?? input.model, effort: nodeTriager?.effort ?? input.effort, ledger: join(dir, name + ".jsonl"), commands: join(dir, name + ".commands.jsonl"), run: name, note: b.notes?.[slug], carried: { iteration: 0, held: {}, triages: 0, tests: state.tests } } satisfies Input,
   }).then(() => { if (!job.signal.aborted) record({ kind: "subtree", slug, outcome: b.nodes![slug]?.outcome }); }));
  }
  // Barrier: every leaf and subtree settles before the next triage. A failed subtree fails this loop after its siblings settle.
  const settled = await Promise.allSettled(runs);
  if (job.signal.aborted) return;
  const failed = settled.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
  const done = b.state as supervise.State | null;
  landed(done);
  for (const n of Object.values(b.nodes ?? {})) state.tests = [...new Set([...(state.tests ?? []), ...(n?.tests ?? [])])];
  delete state.batch; state.iteration++;
  // Harness breakage stops the loop instead of churning the backlog: two harness deferrals in a row
  // (in one batch or across consecutive ones) mean the next batch would most likely fail the same way.
  const harness = Object.entries(done?.deferred ?? {}).filter(([, reason]) => HARNESS.test(reason));
  state.harness = harness.length ? (state.harness ?? 0) + harness.length : 0;
  await save();
  if (failed) throw failed.reason;
  if (state.harness >= 2) {
   record({ kind: "stopped", reason: "harness", deferred: Object.fromEntries(harness) });
   throw new Error("stopped after repeated harness failures (" + harness.map(([s, r]) => s + ": " + r).join("; ") + "); fix the harness, then ab supervise loop again");
  }
 }
}
