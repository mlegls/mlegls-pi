// Supervision loop as an ab daemon job: the script owns scheduling; the owning LLM agent is
// woken (by message) only on exceptions. Design: docs/issues/scripted-supervision-loop.md.
//   ab supervise start <ticket> [--budget N] [--test CMD]   (from the owning agent)
//   ab supervise status | resume <job> <child> verify|integrate|drop|redispatch
// Children are wm workers spawned with the owner as parent session; the owner is woken on
// its mailbox (mail/xxxxxxxx, lib/board/mailbox).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, realpathSync, watch } from "node:fs";
import { basename, dirname, join, resolve, relative } from "node:path";
import { homedir } from "node:os";
import { dispatch, integrate, retire as retireWorker, topic, type Handle } from "../dispatch.ts";
import * as route from "../route.ts";
import * as children from "../children.ts";
import { parse } from "../report.ts";
import type { JobContext } from "../daemon.ts";
import { resolveSession } from "../session-meta/identity";

export interface Input { ticket: string; cwd: string; owner: string; ownerSession?: string; budget: number; test?: string; commands: string; carried?: State | null }
type Phase = "implement" | "verify" | "visual-review" | "supervise";
interface Child { slug: string; phase: Phase; handle: Handle; cursor?: string; implementer?: Handle; previous?: Handle[]; waiting?: string; unreachable?: boolean; evidence?: Record<string, unknown>; acceptedHead?: string; visualReviewed?: boolean }
export interface Metrics { wakes: number; ownerBytes: number; launched: number; completed: number }
// Caveats are residuals, not stops: carried to the verifier and to the done message, where the owner files them.
export interface State { children: Record<string, Child>; integrated: string[]; metrics: Metrics; finished?: boolean; crossing?: Child; caveats?: Record<string, string[]> }
export type Command = { child: string; action: "verify" | "integrate" | "drop" | "redispatch" };

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const HACK = "Hacking session: reach the ticket's first use fast and try it; no systematic audit. Commit coherent chunks on your branch. Your parent alone integrates this branch; do not merge or push the canonical checkout.";
const EXECUTION_STANCES = ["fill", "auto-routine", "technical", "auto", "compile", "prune", "research", "session-triage"];

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
// Unknown, empty, or prose-only outcomes are not acceptance.
const unheld = (h: Record<string, unknown> | null) => !Array.isArray(h?.stories) || !h.stories.length || h.stories.some(s => !s || typeof s.story !== "string" || !s.story.trim() || s.outcome !== "held");
function evidencePacket(cwd: string, handoff: Record<string, unknown> | null) {
 const e = handoff?.evidence as { path?: unknown; visual?: unknown; shots?: unknown } | undefined;
 if (!e || typeof e.visual !== "boolean" || !Array.isArray(e.shots) || (e.visual && !e.shots.length) || (!e.visual && e.shots.length)) throw new Error("Evidence needs path, visual boolean, and shots (nonempty for visual journeys)");
 const tracked = (p: unknown) => {
  if (typeof p !== "string" || !p.startsWith("docs/attachments/") || p.split("/").includes("..")) throw new Error("Evidence must live under docs/attachments: " + p);
  const full = resolve(cwd, p);
  if (!existsSync(full) || !realpathSync(full).startsWith(realpathSync(cwd) + "/")) throw new Error("Missing or external evidence: " + p);
  git(cwd, "cat-file", "-e", "HEAD:" + p);
  return p;
 };
 const path = tracked(e.path);
 if (!path.endsWith(".md")) throw new Error("Evidence index must be Markdown");
 const shots = e.shots.map(tracked);
 if (shots.some(p => !/\.(png|jpe?g|webp)$/i.test(p))) throw new Error("Shots must name image files, not directories");
 return { path, visual: e.visual, shots };
}
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
  const prepared = await route.prepare(prompt, { assignee: assignee ?? undefined, stance, allowedStances: phase === "implement" ? EXECUTION_STANCES : [stance!] });
  if (prepared.kind !== "ready") throw new Error("routing needs triage for " + slug);
  const receipt = await dispatch([{ handle: phase === "implement" || phase === "supervise" ? slug : slug + "-" + phase + (state.children[slug]?.previous?.length ? "-" + state.children[slug].previous!.length : ""), prompt, agent: prepared.agent, model: prepared.model, effort: prepared.effort, base }],
   { run: input.ticket, cwd: input.cwd, maxConcurrent: 1, active: [], parent });
  if (!receipt.submitted[0]) throw new Error("launch failed for " + slug + ": " + (receipt.failed?.error ?? "pending"));
  state.metrics.launched++;
  return receipt.submitted[0];
 };
 // Unmerged branches (drop, redispatch) survive for the owner to inspect; merged ones are deleted.
 const retire = async (h: Handle) => { await retireWorker(h, { cwd: input.cwd }).catch(e => job.log("retire " + h.handle + ": " + e)); };
 const close = async (slug: string, cwd: string, evidence?: string) => {
  const issue = snapshot({ ...input, cwd }).find(i => i.slug === slug);
  if (!issue || !existsSync(issue.file)) throw new Error("Missing child issue " + slug + " in " + cwd);
  if (!issue.done) {
   // A shared/external tracker cannot ride this branch; refuse before writing outside it.
   git(cwd, "ls-files", "--error-unmatch", "--", issue.file);
   let body = readFileSync(issue.file, "utf8").replace(/^stage: \w+$/m, "stage: done");
   if (evidence) body += "\n\n## Verification evidence\n\n[Encounter and evidence](" + relative(realpathSync(dirname(issue.file)), realpathSync(resolve(cwd, evidence))) + ").\n";
   writeFileSync(issue.file, body);
   await commitRetrying(cwd, "-qm", "Close " + slug, "--", issue.file);
  }
 };
 const carried = () => { const l = listCaveats(state.caveats); return l ? "\nCaveats the children reported, integrated anyway; file each as an idea or link its owner:\n" + l : ""; };
 const verifyPrompt = (slug: string, ticket: string, report: string) => ["Verify the ticket below: " + HACK,
  "Your branch starts at the implementer's commits. Use the prepared environment; check its deployment kind, persona, seed and entry point before running setup. Wait for setup to finish. Missing preparation is unfinished delivery work, not a reason to substitute regression tests for the encounter. Follow docs/verification-evidence.md in the harness repository for the evidence packet and exact handoff schema. Commit a packet under docs/attachments/" + slug + "/ and link it from the ticket. Declare evidence.visual true for any rendered UI journey; a separate visual reviewer judges those screenshots. " + HANDOFF + "stories must be a nonempty array of {story, outcome}, with outcome held, failed or unobservable. evidence: {path: <repo-relative Markdown index>, visual: <boolean>, shots: [<repo-relative image paths>]}. An honest account of missing measurements is not the requested measurement. Unmet requirements stay blocked unless the contract is explicitly changed; caveats cannot waive them.",
  "Ticket " + slug + ":\n\n" + ticket, "Implementer's report:\n\n" + report].join("\n\n");
 const integrateChild = (c: Child, handle: Handle) => serialized(input.cwd, async () => {
  let packet: ReturnType<typeof evidencePacket> | undefined;
  if (c.phase !== "supervise") {
   if (!c.acceptedHead || c.acceptedHead !== git(handle.path, "rev-parse", "HEAD") || unheld(c.evidence ?? null)) return except(c, "fresh verification required before integration");
   packet = evidencePacket(handle.path, c.evidence ?? null);
   if (packet.visual && !c.visualReviewed) return except(c, "visual review required before integration");
  }
  // Failed preparation keeps both the owner HEAD and the child's resources intact.
  const attempt = () => integrate(handle, { cwd: input.cwd, keep: true, prepare: async worker => {
   // The loop owns this clean rebase; keep retries bound to the rebased revision.
   if (c.phase !== "supervise") { c.acceptedHead = git(worker.path, "rev-parse", "HEAD"); await save(); }
   if (input.test) execFileSync("bash", ["-lc", input.test], { cwd: worker.path, stdio: "pipe" });
   await close(c.slug, worker.path, packet?.path);
   if (c.phase !== "supervise") { c.acceptedHead = git(worker.path, "rev-parse", "HEAD"); await save(); }
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
  for (const old of c.previous ?? []) await retire(old);
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
   if (cmd.action === "drop") { await retire(c.handle); if (c.implementer) await retire(c.implementer); for (const old of c.previous ?? []) await retire(old); delete state.children[c.slug]; }
   try {
    if (cmd.action === "integrate") await integrateChild(c, c.handle);
    else if (cmd.action === "verify") await toVerify(c, (await children.last(topic(c.handle)))?.text ?? "");
    else if (cmd.action === "redispatch") { await retire(c.handle); if (c.implementer) await retire(c.implementer); for (const old of c.previous ?? []) await retire(old); delete state.children[c.slug]; }
   } catch (error) { await except(c, "resume failed", String(error)); }
  }
  applied = all.length; await save();
 };
 const toVerify = async (c: Child, report: string) => {
  const issue = snapshot(input).find(i => i.slug === c.slug)!;
  const branch = git(c.handle.path, "branch", "--show-current");
  const handle = await launch(c.slug, "verify", verifyPrompt(c.slug, readFileSync(issue.file, "utf8"), report), branch, "agent", "verify");
  (c.previous ??= []).push(c.handle);
  Object.assign(c, { handle, phase: "verify", cursor: handle.cursor, evidence: undefined, acceptedHead: undefined, visualReviewed: false });
  await save();
 };
 const toVisualReview = async (c: Child, report: string) => {
  const issue = snapshot(input).find(i => i.slug === c.slug)!;
  const packet = evidencePacket(c.handle.path, c.evidence ?? null);
  const prompt = ["Judge the collected visual evidence against this ticket. This is acceptance, not an open-ended design audit. Open the actual screenshots (use lib/cards.ts for contact sheets); the collector's held outcomes are claims, not your verdict. If you have the context and authority to fix a gap, fix it directly, re-drive the affected behavior and refresh the evidence. Collect missing states yourself when practical. Hand off only when context, authority or cost warrants it; do not weaken the contract. Your repairs do not automatically require another reviewer.",
   "Read ~/dev/mlegls-pi/docs/verification-evidence.md. Commit your per-claim judgment, any repairs and refreshed image references to the packet index " + packet.path + ". For this supervised review, use the shared handoff rather than data: {blocking,nits}: stories: [{story: <claim>, outcome: held|failed|unobservable}], evidence: " + JSON.stringify(packet) + " (update shots after repairs), caveats: []. End blocked only for requirements you cannot finish; done when all required claims hold on the repaired state. Record what changed and what you re-drove; pre-fix screenshots cannot establish the repaired outcome. A small regression can affect fewer than 2% of pixels: changing a gate's tolerance needs a known-bad probe or an explicitly unverified sensitivity claim.",
   "Ticket:\n" + readFileSync(issue.file, "utf8"), "Collector report:\n" + report].join("\n\n");
  const handle = await launch(c.slug, "visual-review", prompt, c.acceptedHead!, "agent:visual-reviewer", "visual-reviewer");
  (c.previous ??= []).push(c.handle);
  Object.assign(c, { handle, phase: "visual-review", cursor: handle.cursor });
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
    : HACK + " Existing regressions and lints only; no new permanent acceptance tests; a fresh verifier follows you. " + HANDOFF + "commit, setup (deployment kind, owned target, persona/auth, seed/state and runnable entry point), stories, caveats: [] when there are none. Prepare first-use setup before handoff, including Cloud vs anonymous-local requirements; never include secret values in evidence. Caveats are residuals the loop carries on, not stops: if the ticket's contract is not met, end blocked (or needs-input) instead of done.\n\nTicket " + i.file + ":\n\n" + readFileSync(i.file, "utf8");
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
  try { end = ids.length ? await children.turnEnd(ids, { cwd: input.cwd, after: cursors, signal: stop.signal }) : await new Promise<never>((_, reject) => stop.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); }
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
  c.cursor = end.cursor; c.waiting = undefined;
  if (c.phase === "verify") { c.evidence = undefined; c.acceptedHead = undefined; c.visualReviewed = false; }
  if (c.phase === "visual-review") c.visualReviewed = false;
  await save();
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
   if (unheld(r.handoff)) { await except(c, "verification did not hold cleanly", end.text); return; }
   const packet = evidencePacket(c.handle.path, r.handoff);
   if (git(c.handle.path, "status", "--porcelain")) { await except(c, "evidence must be committed", end.text); return; }
   c.evidence = r.handoff!; c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD"); c.visualReviewed = false;
   await save();
   if (packet.visual) await toVisualReview(c, end.text);
   else await integrateChild(c, c.handle);
  } else if (c.phase === "visual-review") {
   note(c.slug, caveats(r.handoff));
   if (unheld(r.handoff)) { await except(c, "visual acceptance did not hold", end.text); return; }
   const priorPath = (c.evidence?.evidence as { path?: string } | undefined)?.path;
   const packet = evidencePacket(c.handle.path, r.handoff);
   const changed = git(c.handle.path, "diff", "--name-only", c.acceptedHead!, "HEAD").split("\n").filter(Boolean);
   if (!packet.visual || packet.path !== priorPath || !changed.includes(packet.path) || git(c.handle.path, "status", "--porcelain")) { await except(c, "review must commit its judgment and current visual evidence", end.text); return; }
   c.evidence = r.handoff!;
   c.visualReviewed = true; c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD");
   await save();
   await integrateChild(c, c.handle);
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
