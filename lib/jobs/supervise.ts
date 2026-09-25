// Supervision loop as an ab daemon job: the script owns scheduling; the owning LLM agent is
// woken (by message) only on exceptions. Design: docs/issues/scripted-supervision-loop.md.
//   ab supervise start <ticket> [--budget N] [--test CMD]   (from the owning agent)
//   ab supervise status | resume <job> <child> verify|integrate|drop|redispatch
// Children are created with the owner as parent, so they show under it in the host.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync, watch } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { homedir } from "node:os";
import { dispatch, integrate, retire as retireWorker, type Handle } from "../dispatch.ts";
import * as route from "../route.ts";
import * as children from "../children.ts";
import { parse } from "../report.ts";
import * as paseo from "../paseo.ts";
import type { JobContext } from "../daemon.ts";

export interface Input { ticket: string; cwd: string; owner: string; budget: number; test?: string; commands: string; carried?: State | null }
type Phase = "implement" | "verify" | "supervise";
interface Child { slug: string; phase: Phase; handle: Handle; cursor?: string; implementer?: Handle; waiting?: string }
export interface Metrics { wakes: number; ownerBytes: number; launched: number; completed: number }
export interface State { children: Record<string, Child>; integrated: string[]; metrics: Metrics; finished?: boolean; crossing?: Child }
export type Command = { child: string; action: "verify" | "integrate" | "drop" | "redispatch" };

// One integration at a time per checkout, across every supervise job in this daemon: concurrent
// loops on one checkout otherwise race rebase/ff-only merges and run hooks and tests on a moving tree.
const merging = new Map<string, Promise<unknown>>();
const serial = <T>(key: string, f: () => Promise<T>): Promise<T> => {
 const next = (merging.get(key) ?? Promise.resolve()).catch(() => {}).then(f);
 merging.set(key, next);
 return next;
};
const idOf = (c: Child) => "agentId" in c.handle ? c.handle.agentId : c.handle.handle;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const HACK = "Hacking session: reach the ticket's first use fast and try it; no systematic audit. Commit coherent chunks on your branch.";

interface Issue { slug: string; file: string; partOf: string | null; assignee?: string | null; frontier: boolean; done: boolean; effectiveStage: string }
function snapshot(input: Input): Issue[] {
 return JSON.parse(execFileSync("bun", [TRACKER, "snapshot", input.ticket, "--json"], { cwd: input.cwd, encoding: "utf8" })).issues;
}
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const caveats = (h: Record<string, unknown> | null) => { const c = h?.caveats; return Array.isArray(c) ? c.length > 0 : !!c && !/^(none|no|\[\])$/i.test(String(c).trim()); };
// Verifier outcomes live under handoff.stories as held/failed/unobservable per story; anything but held needs the owner.
const unheld = (h: Record<string, unknown> | null) => { const s = JSON.stringify(h?.stories ?? null); return s === "null" || /"(failed|unobservable)"|:\s*"?(failed|unobservable)/i.test(s); };
// Workers record what they met on the way in prose; digesting it is the owner's, since the loop reads no diffs.
// Advisory Jev findings over the subtree: observations that link no owning issue, and bodies turning into logs.
function residuals(input: Input): string {
 try {
  const { reports } = JSON.parse(execFileSync("bun", [TRACKER, "lint", input.ticket, "--json"], { cwd: input.cwd, encoding: "utf8", timeout: 300_000 }));
  const found = (reports as { slug: string; entry?: { findings: { kind: string; probability: number }[] } }[])
   .flatMap(r => (r.entry?.findings ?? []).filter(f => f.kind === "unowned" || f.kind === "journal").map(f => r.slug + " " + f.kind + " p=" + f.probability.toFixed(2)));
  return found.length ? "\nFile each unowned observation as an idea or link its owner; move a log's records to attachments:\n" + found.join("\n") : "";
 } catch (error) { return "\nResidual lint unavailable: " + (error instanceof Error ? error.message : String(error)).slice(0, 300); }
}
const HANDOFF = "End with the status sentinel and a fenced yaml handoff (agents/_common.md keys). ";


export async function run(job: JobContext) {
 const input = job.input as Input;
 const state: State = (job.state as State | null) ?? input.carried ?? { children: {}, integrated: [], metrics: { wakes: 0, ownerBytes: 0, launched: 0, completed: 0 } };
 const save = () => job.save(state);
 const wake = async (text: string) => {
  const message = "supervise " + input.ticket + " (job " + job.id + "): " + text;
  state.metrics.wakes++; state.metrics.ownerBytes += Buffer.byteLength(message);
  await children.send(input.owner, message); await save();
 };
 const except = async (c: Child, reason: string, text = "") => {
  c.waiting = reason;
  await wake(c.phase + " " + c.slug + ": " + reason + "\n\n" + text.slice(-3000) +
   "\n\nchild agent " + ("agentId" in c.handle ? c.handle.agentId : c.handle.handle) + ", worktree " + c.handle.path +
   "\nSteer it directly (its next turn end returns to the loop), or: ab supervise resume " + input.ticket + " " + c.slug + " verify|integrate|drop|redispatch");
 };
 const launch = async (slug: string, phase: Phase, prompt: string, base: string, assignee?: string | null, stance?: string) => {
  const prepared = await route.prepare(prompt, { assignee: assignee ?? undefined, stance });
  if (prepared.kind !== "ready") throw new Error("routing needs triage for " + slug);
  const receipt = await dispatch([{ handle: phase === "verify" ? slug + "-verify" : slug, prompt, agent: prepared.agent, model: prepared.model, effort: prepared.effort, base }],
   { run: input.ticket, cwd: input.cwd, maxConcurrent: 1, active: [], parent: input.owner });
  if (!receipt.submitted[0]) throw new Error("launch failed for " + slug + ": " + (receipt.failed?.error ?? "pending"));
  state.metrics.launched++;
  return receipt.submitted[0];
 };
 // Unmerged branches (drop, redispatch) survive for the owner to inspect; merged ones are deleted.
 const retire = async (h: Handle) => { await retireWorker(h as any, { cwd: input.cwd }).catch(e => job.log("retire " + h.handle + ": " + e)); };
 // A ticket's close rides its branch: stage: done is committed in the child's worktree before the
 // merge, so integration is one merge and nothing else writes the owner's checkout.
 const close = (c: Child, handle: Handle) => {
  const issue = snapshot(input).find(i => i.slug === c.slug);
  if (!issue || issue.done) return;
  const rel = relative(realpathSync(input.cwd), realpathSync(issue.file)), file = join(handle.path, rel);
  if (rel.startsWith("..") || !existsSync(file)) return;
  const text = readFileSync(file, "utf8"), closed = text.replace(/^stage: \w+$/m, "stage: done");
  if (closed === text) return;
  writeFileSync(file, closed);
  git(handle.path, "commit", "-qm", "Close " + c.slug, "--", rel);
 };
 const verifyPrompt = (slug: string, ticket: string, report: string) => ["Verify the ticket below: " + HACK,
  "Your branch starts at the implementer's commits. First use as the ticket's user; record what you observe; update guides/replays only where the encounter earns them. " + HANDOFF + "stories: each story or promise you checked with held, failed or unobservable; caveats: [] when there are none.",
  "Ticket " + slug + ":\n\n" + ticket, "Implementer's report:\n\n" + report].join("\n\n");
 const integrateChild = (c: Child, handle: Handle) => serial(input.cwd, async () => {
  try { close(c, handle); await integrate(handle as any, { cwd: input.cwd }); }
  catch (error) { return except(c, "integration failed", String(error)); }
  // Merged: the child is integrated whatever the tests say; its handle was retired with the merge.
  delete state.children[c.slug]; state.integrated.push(c.slug); state.metrics.completed++;
  await save();
  if (c.implementer) await retire(c.implementer);
  if (input.test) {
   try { execFileSync("bash", ["-lc", input.test], { cwd: input.cwd, stdio: "pipe" }); }
   catch (error: any) { await wake("tests fail after integrating " + c.slug + "\n\n" + (String(error.stdout ?? "") + String(error.stderr ?? "")).slice(-3000)); }
  }
 });
 // Children whose handle no longer resolves (retired, deleted, timeline unreadable) wait for the owner
 // instead of failing the job; not persisted, so a restart probes them again.
 const lost = new Set<string>();
 const probe = async (cs: Child[]) => {
  let found = false;
  for (const c of cs) {
   try { await children.last(idOf(c)); }
   catch (error) { found = true; lost.add(c.slug); await except(c, "handle no longer resolves: " + message(error)); }
  }
  return found;
 };

 // Pending owner commands (resume) are applied between turn ends.
 const file = input.commands;
 let applied = 0;
 const commands = (): Command[] => existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
 const apply = async () => {
  const all = commands();
  for (const cmd of all.slice(applied)) {
   const c = state.children[cmd.child];
   if (!c) { await wake("resume: no live child " + cmd.child); continue; }
   c.waiting = undefined; lost.delete(c.slug);
   try {
    if (cmd.action === "drop") { await retire(c.handle); if (c.implementer) await retire(c.implementer); delete state.children[c.slug]; }
    else if (cmd.action === "integrate") await integrateChild(c, c.handle);
    else if (cmd.action === "verify") await toVerify(c, (await children.last(idOf(c)))?.text ?? "");
    else if (cmd.action === "redispatch") { await retire(c.handle); delete state.children[c.slug]; }
   } catch (error) { await except(c, "resume " + cmd.action + " failed: " + message(error)); }
  }
  applied = all.length; await save();
 };
 const toVerify = async (c: Child, report: string) => {
  const issue = snapshot(input).find(i => i.slug === c.slug)!;
  const branch = git(c.handle.path, "branch", "--show-current");
  const handle = await launch(c.slug, "verify", verifyPrompt(c.slug, readFileSync(issue.file, "utf8"), report), branch, "agent", "verify");
  Object.assign(c, { implementer: c.handle, handle, phase: "verify", cursor: undefined });
  await save();
 };

 applied = commands().length; // commands issued before a restart were applied then
 while (!job.signal.aborted) {
  await apply();
  // Fill the budget from the subtree's frontier: direct children only; non-leaves get supervise.
  const issues = snapshot(input);
  const head = git(input.cwd, "rev-parse", "HEAD");
  for (const i of issues.filter(i => i.partOf === input.ticket && i.frontier && !i.done && !state.children[i.slug] && !state.integrated.includes(i.slug))) {
   if (Object.keys(state.children).length >= input.budget) break;
   const nonleaf = issues.some(j => j.partOf === i.slug && !j.done);
   const prompt = nonleaf
    ? HACK + "\n\nSupervise the subtree of " + i.file + " with a budget of " + Math.max(1, Math.floor(input.budget / 2)) + ": run ab supervise start " + i.slug + " and handle what it wakes you with; end your turn with done when it reports the subtree done.\n\n" + readFileSync(i.file, "utf8")
    : HACK + " Existing regressions and lints only; no new permanent acceptance tests; a fresh verifier follows you. " + HANDOFF + "commit, setup (how to try it), stories, caveats: [] when there are none.\n\nTicket " + i.file + ":\n\n" + readFileSync(i.file, "utf8");
   try { state.children[i.slug] = { slug: i.slug, phase: nonleaf ? "supervise" : "implement", handle: await launch(i.slug, nonleaf ? "supervise" : "implement", prompt, head, i.assignee, nonleaf ? "supervise" : undefined) }; }
   catch (error) { await wake("could not launch " + i.slug + ": " + error); }
   await save();
  }
  const live = Object.values(state.children);
  if (!live.length) break;
  const watched = live.filter(c => !lost.has(c.slug));
  const ids = watched.map(idOf);
  const cursors = Object.fromEntries(watched.filter(c => c.cursor).map(c => [idOf(c), c.cursor!]));
  const stop = new AbortController();
  const abort = () => stop.abort();
  job.signal.addEventListener("abort", abort);
  const watcher = watch(dirname(file), (_, name) => { if (name === basename(file)) stop.abort(); });
  let end: children.TurnEnd;
  // With every child lost, only an owner command (or stop) moves the loop.
  const idle = () => new Promise<never>((_, reject) => stop.signal.addEventListener("abort", () => reject(stop.signal.reason), { once: true }));
  try { end = ids.length ? await children.turnEnd(ids, { after: cursors, signal: stop.signal }) : await idle(); }
  catch (error) { if (stop.signal.aborted || await probe(watched)) continue; throw error; }
  finally { watcher?.close(); job.signal.removeEventListener("abort", abort); }
  const c = watched[ids.indexOf(end.id)];
  c.cursor = end.cursor; c.waiting = undefined; await save();
  await (async () => {
  const r = parse(end.text);
  if (end.kind !== "finished") { await except(c, "turn ended: " + end.kind, end.text); return; }
  // A child supervisor ends its turn while its own loop runs; only a status sentinel reports.
  if (c.phase === "supervise" && r.status === null) return;
  if (r.status !== "done") { await except(c, r.status ?? "no status sentinel", end.text); return; }
  if (c.phase === "implement") {
   if (caveats(r.handoff)) await except(c, "done with caveats", end.text);
   else if (git(c.handle.path, "status", "--porcelain")) await except(c, "done with uncommitted changes", end.text);
   else await toVerify(c, end.text);
  } else if (c.phase === "verify") {
   if (caveats(r.handoff) || unheld(r.handoff)) await except(c, "verification did not hold cleanly", end.text);
   else await integrateChild(c, c.handle);
  } else await integrateChild(c, c.handle);
  })().catch(error => except(c, "loop error: " + (error instanceof Error ? error.message : String(error)), end.text));
 }
 if (job.signal.aborted) return;
 const open = snapshot(input).filter(i => i.partOf === input.ticket && !i.done);
 if (open.length) { await wake("idle: nothing live, but not done: " + open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", ") + ". Resolve, then ab supervise start " + input.ticket + " again."); return; }
 state.finished = true; await save();
 await wake("done: " + state.integrated.length + " children integrated at " + git(input.cwd, "rev-parse", "--short", "HEAD") + ". metrics " + JSON.stringify(state.metrics) + ". Crossing-story verification is yours to decide." + residuals(input));
}
