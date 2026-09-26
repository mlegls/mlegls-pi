// Supervision loop as an ab daemon job: the script owns scheduling; the owning LLM agent is
// woken (by message) only on exceptions. Design: docs/issues/scripted-supervision-loop.md.
//   ab supervise start <ticket> [--budget N] [--test CMD]   (from the owning agent)
//   ab supervise status | resume <job> <child> verify|integrate|drop|redispatch
// Children are wm workers spawned with the owner as parent session; the owner is woken on
// its mailbox (mail/xxxxxxxx, lib/board/mailbox).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, realpathSync, watch } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { dispatch, integrate, retire as retireWorker, topic, type Handle } from "../dispatch.ts";
import * as route from "../route.ts";
import * as children from "../children.ts";
import { parse } from "../report.ts";
import type { JobContext } from "../daemon.ts";
import { resolveSession } from "../session-meta/identity";

export interface Input { ticket: string; cwd: string; owner: string; ownerSession?: string; budget: number; test?: string; commands: string; carried?: State | null }
type Phase = "implement" | "verify" | "supervise";
interface Child { slug: string; phase: Phase; handle: Handle; cursor?: string; implementer?: Handle; waiting?: string; unreachable?: boolean }
export interface Metrics { wakes: number; ownerBytes: number; launched: number; completed: number }
// Caveats are residuals, not stops: carried to the verifier and to the done message, where the owner files them.
export interface State { children: Record<string, Child>; integrated: string[]; metrics: Metrics; finished?: boolean; crossing?: Child; caveats?: Record<string, string[]> }
export type Command = { child: string; action: "verify" | "integrate" | "drop" | "redispatch" };

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const HACK = "Hacking session: reach the ticket's first use fast and try it; no systematic audit. Commit coherent chunks on your branch.";

interface Issue { slug: string; file: string; partOf: string | null; assignee?: string | null; frontier: boolean; done: boolean; effectiveStage: string }
function snapshot(input: Input): Issue[] {
 // The loop's own state is authoritative for its children; the tracker's derived in-flight claims would
 // hide them (and a redispatched child's surviving branch) from it.
 return JSON.parse(execFileSync("bun", [TRACKER, "snapshot", input.ticket, "--json"], { cwd: input.cwd, encoding: "utf8", env: { ...process.env, TRACKER_NO_INFLIGHT: "1" } })).issues;
}
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
// Every loop runs in the one ab daemon, and loops over the same repository commit to the same checkout;
// preparation and integration run one loop at a time per repository (including symlink aliases).
const repoTurns = new Map<string, Promise<unknown>>();
function serialized<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
 const key = realpathSync(resolve(cwd, git(cwd, "rev-parse", "--git-common-dir")));
 const run = (repoTurns.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
 repoTurns.set(key, run);
 return run;
}
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>(done => {
 const t = setTimeout(done, ms); signal?.addEventListener("abort", () => { clearTimeout(t); done(); }, { once: true });
});
// Sessions outside the daemon (the owner, a human) also commit there; a lost ref or index lock is retried.
async function commitRetrying(cwd: string, ...args: string[]) {
 for (let attempt = 1; ; attempt++) {
  try { return git(cwd, "commit", ...args); }
  catch (error) { if (attempt >= 5 || !/cannot lock ref|index\.lock/.test(String(error))) throw error; await sleep(1000 * attempt); }
 }
}
const caveats = (h: Record<string, unknown> | null): string[] => { const c = h?.caveats; return Array.isArray(c) ? c.map(x => typeof x === "string" ? x : JSON.stringify(x)) : c && !/^(none|no|\[\])$/i.test(String(c).trim()) ? [String(c)] : []; };
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
// Caveats workers reported, for the owner to file as ideas or link to their owners.
const listCaveats = (all?: Record<string, string[]>) => Object.entries(all ?? {}).map(([slug, cs]) => cs.map(c => slug + ": " + c).join("\n")).join("\n");
const HANDOFF = "End with the status sentinel and a fenced yaml handoff (agents/_common.md keys). ";


export async function run(job: JobContext) {
 const input = job.input as Input;
 const state: State = (job.state as State | null) ?? input.carried ?? { children: {}, integrated: [], metrics: { wakes: 0, ownerBytes: 0, launched: 0, completed: 0 } };
 // Older persisted jobs stored only a delivery address. Never use the daemon's own session as parent.
 const parent = input.ownerSession ?? resolveSession(input.owner, (await import("../tree/graph").then(m => m.graph())).keys());
 if (!parent) throw new Error("Cannot resolve supervisor session: " + input.owner);
 const save = () => job.save(state);
 const note = (slug: string, found: string[]) => { if (found.length) (state.caveats ??= {})[slug] = [...(state.caveats[slug] ?? []), ...found]; };
 // Wakes are delivered in order; an owner mid-turn ("already has an active run") or a dropped connection
 // defers delivery rather than failing the loop, which keeps handling other children meanwhile.
 let deliveries: Promise<void> = Promise.resolve();
 const deliver = async (message: string) => {
  for (let attempt = 1; !job.signal.aborted; attempt++) {
   try { return await children.send(input.owner, message); }
   catch (error) {
    if (attempt === 1 || attempt % 10 === 0) job.log("wake deferred (" + attempt + "): " + error);
    await sleep(Math.min(60_000, 5000 * attempt), job.signal);
   }
  }
 };
 const wake = async (text: string) => {
  const message = "supervise " + input.ticket + " (job " + job.id + "): " + text;
  state.metrics.wakes++; state.metrics.ownerBytes += Buffer.byteLength(message);
  deliveries = deliveries.then(() => deliver(message));
  await save();
 };
 const except = async (c: Child, reason: string, text = "") => {
  c.waiting = reason;
  await wake(c.phase + " " + c.slug + ": " + reason + "\n\n" + text.slice(-3000) +
   "\n\nchild " + topic(c.handle) + ", worktree " + c.handle.path +
   "\nSteer it directly (its next turn end returns to the loop), or: ab supervise resume " + input.ticket + " " + c.slug + " verify|integrate|drop|redispatch");
 };
 const launch = async (slug: string, phase: Phase, prompt: string, base: string, assignee?: string | null, stance?: string) => {
  const prepared = await route.prepare(prompt, { assignee: assignee ?? undefined, stance });
  if (prepared.kind !== "ready") throw new Error("routing needs triage for " + slug);
  const receipt = await dispatch([{ handle: phase === "verify" ? slug + "-verify" : slug, prompt, agent: prepared.agent, model: prepared.model, effort: prepared.effort, base }],
   { run: input.ticket, cwd: input.cwd, maxConcurrent: 1, active: [], parent });
  if (!receipt.submitted[0]) throw new Error("launch failed for " + slug + ": " + (receipt.failed?.error ?? "pending"));
  state.metrics.launched++;
  return receipt.submitted[0];
 };
 // Unmerged branches (drop, redispatch) survive for the owner to inspect; merged ones are deleted.
 const retire = async (h: Handle) => { await retireWorker(h, { cwd: input.cwd }).catch(e => job.log("retire " + h.handle + ": " + e)); };
 const close = async (slug: string, cwd: string) => {
  const issue = snapshot({ ...input, cwd }).find(i => i.slug === slug);
  if (!issue || !existsSync(issue.file)) throw new Error("Missing child issue " + slug + " in " + cwd);
  if (!issue.done) {
   // A shared/external tracker cannot ride this branch; refuse before writing outside it.
   git(cwd, "ls-files", "--error-unmatch", "--", issue.file);
   writeFileSync(issue.file, readFileSync(issue.file, "utf8").replace(/^stage: \w+$/m, "stage: done"));
   await commitRetrying(cwd, "-qm", "Close " + slug, "--", issue.file);
  }
 };
 const carried = () => { const l = listCaveats(state.caveats); return l ? "\nCaveats the children reported, integrated anyway; file each as an idea or link its owner:\n" + l : ""; };
 const verifyPrompt = (slug: string, ticket: string, report: string) => ["Verify the ticket below: " + HACK,
  "Your branch starts at the implementer's commits. First use as the ticket's user; record what you observe; update guides/replays only where the encounter earns them. " + HANDOFF + "stories: each story or promise you checked with held, failed or unobservable; caveats: [] when there are none (residuals the loop carries on; a failed story is what stops it).",
  "Ticket " + slug + ":\n\n" + ticket, "Implementer's report:\n\n" + report].join("\n\n");
 const integrateChild = (c: Child, handle: Handle) => serialized(input.cwd, async () => {
  // Failed preparation keeps both the owner HEAD and the child's resources intact.
  const attempt = () => integrate(handle, { cwd: input.cwd, keep: true, prepare: async worker => {
   if (input.test) execFileSync("bash", ["-lc", input.test], { cwd: worker.path, stdio: "pipe" });
   await close(c.slug, worker.path);
  } });
  try { await attempt(); }
  catch (error: any) {
   return except(c, "integration failed", String(error) + "\n" + String(error.stdout ?? "") + String(error.stderr ?? ""));
  }
  delete state.children[c.slug]; state.integrated.push(c.slug); state.metrics.completed++;
  await save();
  // Crash after saving may leave resources behind, but never a saved handle we already retired.
  await retire(handle);
  if (c.implementer) await retire(c.implementer);
 });

 // Pending owner commands (resume) are applied between turn ends.
 const file = input.commands;
 let applied = 0;
 const commands = (): Command[] => existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
 const apply = async () => {
  const all = commands();
  for (const cmd of all.slice(applied)) {
   const c = state.children[cmd.child];
   if (!c) { await wake("resume: no live child " + cmd.child); continue; }
   c.waiting = undefined; c.unreachable = undefined;
   if (cmd.action === "drop") { await retire(c.handle); if (c.implementer) await retire(c.implementer); delete state.children[c.slug]; }
   try {
    if (cmd.action === "integrate") await integrateChild(c, c.handle);
    else if (cmd.action === "verify") await toVerify(c, (await children.last(topic(c.handle)))?.text ?? "");
    else if (cmd.action === "redispatch") { await retire(c.handle); delete state.children[c.slug]; }
   } catch (error) { await except(c, "resume failed", String(error)); }
  }
  applied = all.length; await save();
 };
 const toVerify = async (c: Child, report: string) => {
  const issue = snapshot(input).find(i => i.slug === c.slug)!;
  const branch = git(c.handle.path, "branch", "--show-current");
  const handle = await launch(c.slug, "verify", verifyPrompt(c.slug, readFileSync(issue.file, "utf8"), report), branch, "agent", "verify");
  Object.assign(c, { implementer: c.handle, handle, phase: "verify", cursor: handle.cursor });
  await save();
 };

 applied = commands().length; // commands issued before a restart were applied then
 let lostWatches = 0;
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
    : HACK + " Existing regressions and lints only; no new permanent acceptance tests; a fresh verifier follows you. " + HANDOFF + "commit, setup (how to try it), stories, caveats: [] when there are none. Caveats are residuals the loop carries on, not stops: if the ticket's contract is not met, end blocked (or needs-input) instead of done.\n\nTicket " + i.file + ":\n\n" + readFileSync(i.file, "utf8");
   try { const handle = await launch(i.slug, nonleaf ? "supervise" : "implement", prompt, head, i.assignee, nonleaf ? "supervise" : undefined); state.children[i.slug] = { slug: i.slug, phase: nonleaf ? "supervise" : "implement", handle, cursor: handle.cursor }; }
   catch (error) { await wake("could not launch " + i.slug + ": " + error); }
   await save();
  }
  const live = Object.values(state.children);
  if (!live.length) break;
  // A child the host cannot read sends no turn end; it waits for a resume command like any exception.
  for (const c of live) if (!c.unreachable && !existsSync(c.handle.path)) {
   c.unreachable = true;
   await except(c, "unreachable", "Worker worktree is missing: " + c.handle.path);
  }
  if (job.signal.aborted) return;
  const watched = live.filter(c => !c.unreachable);
  const ids = watched.map(c => topic(c.handle));
  const cursors = Object.fromEntries(watched.filter(c => c.cursor).map(c => [topic(c.handle), c.cursor!]));
  const stop = new AbortController();
  const abort = () => stop.abort();
  job.signal.addEventListener("abort", abort);
  const watcher = watch(dirname(file), (_, name) => { if (name === basename(file)) stop.abort(); });
  let end: children.TurnEnd;
  try { end = ids.length ? await children.turnEnd(ids, { after: cursors, signal: stop.signal }) : await new Promise<never>((_, reject) => stop.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); }
  catch (error) {
   if (stop.signal.aborted) continue;
   // A dropped host connection is not a child's failure: back off and watch again, telling the owner once.
   if (++lostWatches === 5) await wake("cannot watch children (still retrying): " + error);
   job.log("watch failed (" + lostWatches + "): " + error);
   await sleep(Math.min(60_000, 2000 * lostWatches), job.signal);
   continue;
  }
  finally { watcher?.close(); job.signal.removeEventListener("abort", abort); }
  lostWatches = 0;
  const c = watched[ids.indexOf(end.id)];
  c.cursor = end.cursor; c.waiting = undefined; await save();
  if (end.unreachable) { c.unreachable = true; await except(c, "unreachable", end.text); continue; }
  await (async () => {
  const r = parse(end.text);
  if (end.kind !== "finished") { await except(c, "turn ended: " + end.kind, end.text); return; }
  // A child supervisor ends its turn while its own loop runs; only a status sentinel reports.
  if (c.phase === "supervise" && r.status === null) return;
  if (r.status !== "done") { await except(c, r.status ?? "no status sentinel", end.text); return; }
  if (c.phase === "implement") {
   note(c.slug, caveats(r.handoff));
   if (git(c.handle.path, "status", "--porcelain")) await except(c, "done with uncommitted changes", end.text);
   else await toVerify(c, end.text);
  } else if (c.phase === "verify") {
   note(c.slug, caveats(r.handoff));
   if (unheld(r.handoff)) await except(c, "verification did not hold cleanly", end.text);
   else await integrateChild(c, c.handle);
  } else await integrateChild(c, c.handle);
  })().catch(error => except(c, "loop error: " + (error instanceof Error ? error.message : String(error)), end.text));
 }
 if (job.signal.aborted) return;
 const open = snapshot(input).filter(i => i.partOf === input.ticket && !i.done);
 if (open.length) { await wake("idle: nothing live, but not done: " + open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", ") + ". Resolve, then ab supervise start " + input.ticket + " again."); await deliveries; return; }
 state.finished = true; await save();
 await wake("done: " + state.integrated.length + " children integrated at " + git(input.cwd, "rev-parse", "--short", "HEAD") + ". metrics " + JSON.stringify(state.metrics) + ". Crossing-story verification is yours to decide." + carried() + residuals(input));
 await deliveries;
}
