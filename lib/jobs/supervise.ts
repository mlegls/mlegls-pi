// Supervision loop as an ab daemon job: the script owns scheduling; the owning LLM agent is
// woken (by message) only on exceptions. Design: docs/issues/scripted-supervision-loop.md.
//   ab supervise start <ticket> [--budget N] [--test CMD]   (from the owning agent)
//   ab supervise status | resume <job> <child> verify|integrate|drop|redispatch
// Children are wm workers spawned with the owner as parent session; the owner is woken on
// its mailbox (mail/xxxxxxxx, lib/board/mailbox).
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync, realpathSync, statSync, watch } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { basename, dirname, join, resolve, relative } from "node:path";
import { homedir } from "node:os";
import { dispatch, integrate, retire as retireWorker, topic, type Handle } from "../dispatch.ts";
import * as route from "../route.ts";
import * as children from "../children.ts";
import { parse } from "../report.ts";
import type { JobContext } from "../daemon.ts";
import { resolveSession } from "../session-meta/identity";
import { SPAWN_META } from "../session-meta/host";
import { workmuxStatus } from "../wm.ts";
export interface Input { ticket: string; cwd: string; owner: string; ownerSession?: string; budget: number; test?: string; commands: string; commandsApplied?: number; carried?: State | null;
 // Batch mode (lib/jobs/loop.ts): run exactly these items, and on any exception defer the child (retire it,
 // keep its branch, append to the ledger) instead of waking an owner. The run returns when the batch drains.
 items?: string[]; ledger?: string; deadline?: number; run?: string;
 // Per-ticket notes from the loop's triage, passed to the implementer.
 notes?: Record<string, string>;
 // Test commands from earlier batches; every integration gate runs all of them. The join's own timebox (batch mode).
 tests?: string[]; joinTimeboxMs?: number;
 // Landed in earlier batches whose join was skipped: the next join covers them too, from their base.
 unjoined?: { slugs: string[]; base: string; reviews: Record<string, unknown> } }
// Each leaf runs implement → drive → review → integrate; a non-leaf is one supervise child. Phases are agent roles (agents/roles/).
type Phase = "implement" | "drive" | "review" | "supervise" | "consolidate";
interface Child { slug: string; phase: Phase; handle: Handle; cursor?: string; implementer?: Handle; previous?: Handle[]; waiting?: string; unreachable?: boolean; evidence?: Record<string, unknown>; acceptedHead?: string; setup?: unknown; drive?: Record<string, unknown>; redriven?: boolean; startup?: { launchedAt: number; mode?: "pi" | "command"; sessionFound?: boolean; reported?: boolean; checkedAt?: number } }
export interface Metrics { wakes: number; ownerBytes: number; launched: number; completed: number; /** most children live at once: whether the budget ever binds */ peak?: number }
// Caveats are residuals, not stops: carried to the verifier and to the done message, where the owner files them.
export interface State { children: Record<string, Child>; integrated: string[]; metrics: Metrics; finished?: boolean; crossing?: Child; caveats?: Record<string, string[]>; commandsApplied?: number; commandInFlight?: number; deferred?: Record<string, string>;
 // Join: once this node's (or batch's) children have landed, drive its crossing stories and consolidate the combined change.
 base?: string; tests?: string[]; reviews?: Record<string, unknown>; setups?: Record<string, unknown>;
 join?: { key: string; drive: boolean; deadline?: number; skipped?: string; done?: boolean } }
export type Command = { child: string; action: "verify" | "integrate" | "drop" | "redispatch" };

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const STARTUP_GRACE_MS = 30_000;
const STARTUP_POLL_MS = 5_000;
interface Issue { slug: string; file: string; partOf: string | null; assignee?: string | null; frontier: boolean; done: boolean; effectiveStage: string }
function snapshot(input: Input): Issue[] {
 // The loop's own state is authoritative for its children; the tracker's derived in-flight claims would
 // hide them (and a redispatched child's surviving branch) from it.
 return JSON.parse(execFileSync("bun", [TRACKER, "snapshot", ...(input.ticket ? [input.ticket] : []), "--json"], { cwd: input.cwd, encoding: "utf8", env: { ...process.env, TRACKER_NO_INFLIGHT: "1" } })).issues;
}
// When a ticket has no direct children, it is the loop's single leaf.
function workItems(issues: Issue[], input: Input): Issue[] {
 if (input.items) return issues.filter(i => input.items!.includes(i.slug));
 const direct = issues.filter(i => i.partOf === input.ticket);
 return direct.length ? direct : issues.filter(i => i.slug === input.ticket);
}
const STARTUP_META = (entry: { type: string; customType?: string; data?: unknown }, handle: Handle) => {
 if (entry.type !== "custom" || entry.customType !== SPAWN_META || !entry.data || typeof entry.data !== "object") return false;
 const meta = entry.data as { run?: unknown; handle?: unknown };
 return meta.run === handle.run && meta.handle === handle.handle;
};
async function hasPiSession(handle: Handle) {
 const sessions = await SessionManager.list(handle.path);
 return sessions.some(session => {
  try { return SessionManager.open(session.path).getEntries().some(entry => STARTUP_META(entry, handle)); }
  catch { return false; }
 });
}
async function paneTail(cwd: string, handle: Handle) {
 const worker = (await workmuxStatus(cwd).catch(() => [])).find(entry => entry.worktree === handle.handle || resolve(entry.workdir) === resolve(handle.path));
 const session = handle.session ?? handle.run.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
 const target = worker?.pane_id || (session ? session + ":" + handle.handle : "");
 if (!target) return "";
 return execFileSync("tmux", ["capture-pane", "-p", "-J", "-S", "-100", "-t", target], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
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
// The driver's black-box tests: commands the integration gate runs on the reviewer's final head.
// Handoff `tests` name committed test files (repository-relative); anything else (prose, commands) is not run.
const testCommands = (h: Record<string, unknown> | null | undefined): string[] => Array.isArray(h?.tests) ? h.tests.filter((t): t is string => typeof t === "string" && /^[\w./-]+$/.test(t.trim()) && !t.includes("..")).map(t => t.trim()) : [];
// How the gate runs one test file; files that no longer exist (tidied away) are skipped.
function testRun(cwd: string, file: string): string[] | null {
 const full = resolve(cwd, file);
 if (!existsSync(full) || !statSync(full).isFile()) return null;
 if (/\.test\.[cm]?[jt]sx?$/.test(file)) return ["bun", "test", "./" + file];
 if (statSync(full).mode & 0o111) return ["./" + file];
 if (file.endsWith(".sh")) return ["sh", file];
 return null;
}
const yaml = (value: unknown) => "```json\n" + JSON.stringify(value ?? null, null, 1) + "\n```";
// Unknown, empty, or prose-only outcomes are not acceptance.
const unheld = (h: Record<string, unknown> | null) => !Array.isArray(h?.stories) || !h.stories.length || h.stories.some(s => !s || typeof s.story !== "string" || !s.story.trim() || s.outcome !== "held");
function evidencePacket(cwd: string, handoff: Record<string, unknown> | null) {
 const e = handoff?.evidence as { path?: unknown; visual?: unknown; shots?: unknown } | undefined;
 if (e && e.visual === false && e.shots === undefined) e.shots = [];
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


export async function run(job: JobContext) {
 const input = job.input as Input;
 const state: State = (job.state as State | null) ?? input.carried ?? { children: {}, integrated: [], metrics: { wakes: 0, ownerBytes: 0, launched: 0, completed: 0 } };
 // Older persisted jobs stored only a delivery address. Never use the daemon's own session as parent.
 const batch = !!input.ledger;
 const record = (entry: Record<string, unknown>) => appendFileSync(input.ledger!, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
 const parent = input.ownerSession ?? (batch ? undefined : resolveSession(input.owner, (await import("../tree/graph").then(m => m.graph())).keys()));
 if (!parent && !batch) throw new Error("Cannot resolve supervisor session: " + input.owner);
 const save = () => job.save(state);
 state.base ??= git(input.cwd, "rev-parse", "HEAD");
 const deadline = () => state.join?.deadline ?? input.deadline;
 const isJoin = (c: Child) => c.slug === state.join?.key;
 // Jobs persisted before the drive/review split: their verify or visual-review child already collects acceptance.
 for (const c of Object.values(state.children)) if (["verify", "visual-review"].includes(c.phase as string)) c.phase = "review";
 const note = (slug: string, found: string[]) => { if (!found.length) return; (state.caveats ??= {})[slug] = [...(state.caveats[slug] ?? []), ...found]; if (batch) record({ kind: "caveats", slug, caveats: found }); };
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
 const retireAll = async (c: Child) => { await retire(c.handle); if (c.implementer) await retire(c.implementer); for (const old of c.previous ?? []) await retire(old); };
 const wake = async (text: string) => {
  if (batch) { record({ kind: "note", text }); return; }
  const message = "supervise " + input.ticket + " (job " + job.id + "): " + text;
  state.metrics.wakes++; state.metrics.ownerBytes += Buffer.byteLength(message);
  deliveries = deliveries.then(() => deliver(message));
  await save();
 };
 const except = async (c: Child, reason: string, text = "") => {
  if (batch && state.children[c.slug] !== c) return; // already deferred this turn
  c.waiting = reason;
  if (batch) {
   // Deferral unwinds the child: its unmerged branch survives for the next triage (redispatch starts fresh).
   record({ kind: "deferred", slug: c.slug, phase: c.phase, reason, branch: c.handle.handle, report: text.slice(-1500) });
   delete state.children[c.slug]; (state.deferred ??= {})[c.slug] = reason;
   await save();
   await retireAll(c);
   return;
  }
  await wake(c.phase + " " + c.slug + ": " + reason + "\n\n" + text.slice(-3000) +
   "\n\nchild " + topic(c.handle) + ", worktree " + c.handle.path +
   (c.unreachable
     ? (existsSync(c.handle.path)
       ? "Restart it in its existing worktree; its next report on this topic returns to the loop"
       : "After restoring its worktree, restart it there; its next report on this topic returns to the loop")
     : "Steer it directly (its next turn end returns to the loop)") +
   ", or: ab supervise resume " + input.ticket + " " + c.slug + " verify|integrate|drop|redispatch");
 };
const checkStartup = async (live: Child[]) => {
 let changed = false;
 for (const c of live) {
  if (!c.startup) { c.startup = { launchedAt: Date.now(), mode: "pi" }; changed = true; }
  else if (!c.startup.mode) { c.startup.mode = "pi"; changed = true; }
 }
 if (changed) await save();
 for (const c of live) {
  const startup = c.startup!;
  // Deferral kills the worker, so a false "not started" costs a whole attempt; in batch mode the timebox bounds a dead worker instead.
  if (batch) continue;
  if (startup.mode === "command" || startup.sessionFound || startup.reported || Date.now() - startup.launchedAt < STARTUP_GRACE_MS) continue;
  try {
   if (await hasPiSession(c.handle)) { startup.sessionFound = true; await save(); continue; }
  } catch (error) {
   startup.checkedAt = Date.now();
   job.log("startup session check failed (" + c.slug + "): " + error);
   await save();
   continue;
  }
  let text = "";
  try { text = await paneTail(input.cwd, c.handle); }
  catch (error) { text = "Could not capture worker pane: " + error; job.log(text); }
  startup.reported = true;
  await except(c, "worker did not start within " + (STARTUP_GRACE_MS / 1000) + "s (no pi session found)", text);
 }
};
 const launch = async (slug: string, phase: Phase, prompt: string, base: string, assignee?: string | null) => {
  const prepared = await route.prepareRole(phase, prompt, { assignee: assignee ?? "agent" });
  if (prepared.kind !== "ready") throw new Error("routing needs triage for " + slug);
  const receipt = await dispatch([{ handle: phase === "implement" || phase === "supervise" ? slug : slug + "-" + phase + (state.children[slug]?.previous?.length ? "-" + state.children[slug].previous!.length : ""), prompt, agent: prepared.agent, role: phase, model: prepared.model, effort: prepared.effort, base }],
   { run: input.run ?? input.ticket, cwd: input.cwd, maxConcurrent: 1, active: [], parent });
  if (!receipt.submitted[0]) throw new Error("launch failed for " + slug + ": " + (receipt.failed?.error ?? "pending"));
  state.metrics.launched++;
  state.metrics.peak = Math.max(state.metrics.peak ?? 0, Object.keys(state.children).length + (state.children[slug] ? 0 : 1));
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
   if (evidence) body = body.trimEnd() + "\n\n## Verification evidence\n\n[Encounter and evidence](" + relative(realpathSync(dirname(issue.file)), realpathSync(resolve(cwd, evidence))) + ").\n";
   writeFileSync(issue.file, body);
   await commitRetrying(cwd, "-qm", "Close " + slug, "--", issue.file);
  }
 };
 const carried = () => { const l = listCaveats(state.caveats); return l ? "\nCaveats the children reported, integrated anyway; file each as an idea or link its owner:\n" + l : ""; };
 const integrateChild = (c: Child, handle: Handle) => serialized(input.cwd, async () => {
  let packet: ReturnType<typeof evidencePacket> | undefined;
  if (c.phase !== "supervise") {
   if (!c.acceptedHead || c.acceptedHead !== git(handle.path, "rev-parse", "HEAD") || (!isJoin(c) && unheld(c.evidence ?? null))) return except(c, "an accepted review of the current head is required before integration");
   if (!isJoin(c)) packet = evidencePacket(handle.path, c.evidence ?? null);
  }
  // Failed preparation keeps both the owner HEAD and the child's resources intact.
  const attempt = () => integrate(handle, { cwd: input.cwd, keep: true, prepare: async worker => {
   // The loop owns this clean rebase; keep retries bound to the rebased revision.
   if (c.phase !== "supervise") { c.acceptedHead = git(worker.path, "rev-parse", "HEAD"); await save(); }
   // The driver's tests are the contract the reviewer's edits answer to; they gate integration mechanically.
   // Earlier siblings' tests too, so one child can't silently break another's contract.
   if (input.test) execFileSync("bash", ["-lc", input.test], { cwd: worker.path, stdio: "pipe" });
   else for (const file of new Set([...(input.tests ?? []), ...(state.tests ?? []), ...testCommands(c.evidence)])) {
    const run = testRun(worker.path, file);
    if (run) execFileSync(run[0], run.slice(1), { cwd: worker.path, stdio: "pipe" });
   }
   if (!isJoin(c)) await close(c.slug, worker.path, packet?.path);
   if (c.phase !== "supervise") { c.acceptedHead = git(worker.path, "rev-parse", "HEAD"); await save(); }
  } });
  try { await attempt(); }
  catch (error: any) {
   return except(c, "integration failed", String(error) + "\n" + String(error.stdout ?? "") + String(error.stderr ?? ""));
  }
  delete state.children[c.slug];
  state.tests = [...new Set([...(state.tests ?? []), ...testCommands(c.evidence)])];
  if (isJoin(c)) state.join!.done = true;
  else {
   state.integrated.push(c.slug); state.metrics.completed++;
   if (c.evidence) (state.reviews ??= {})[c.slug] = { stories: c.evidence.stories, filed: c.evidence.filed, caveats: c.evidence.caveats };
  }
  if (batch) record({ kind: isJoin(c) ? "joined" : "integrated", slug: c.slug, head: git(input.cwd, "rev-parse", "--short", "HEAD"), ...(isJoin(c) ? { changes: c.evidence?.changes, filed: c.evidence?.filed } : {}) });
  await save();
  // Crash after saving may leave resources behind, but never a saved handle we already retired.
  await retire(handle);
  if (c.implementer) await retire(c.implementer);
  for (const old of c.previous ?? []) await retire(old);
 });

 // Pending owner commands (resume) are applied between turn ends.
 const file = input.commands;
 // Cursor counts completed command records, not records merely present at startup.
 const commands = (): Command[] => existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
 const apply = async () => {
  const all = commands();
  for (let index = state.commandsApplied!; index < all.length && !job.signal.aborted; index++) {
   const cmd = all[index];
   state.commandInFlight = index + 1;
   await save(); // An interrupted side effect must not be blindly replayed.
   const c = state.children[cmd.child];
   if (!c) await wake("resume: no live child " + cmd.child);
   else {
    c.waiting = undefined; c.unreachable = undefined;
    try {
     if (cmd.action === "drop" || cmd.action === "redispatch") { await retire(c.handle); if (c.implementer) await retire(c.implementer); for (const old of c.previous ?? []) await retire(old); delete state.children[c.slug]; }
     else if (cmd.action === "integrate") await integrateChild(c, c.handle);
     else if (cmd.action === "verify") await toDrive(c);
    } catch (error) { await except(c, "resume failed", String(error)); }
   }
   state.commandsApplied = index + 1;
   delete state.commandInFlight;
   await save();
  }
 };
 const ticketText = (slug: string) => { const issue = snapshot(input).find(i => i.slug === slug)!; return "Ticket " + slug + " (" + issue.file + "):\n\n" + readFileSync(issue.file, "utf8"); };
 const advance = async (c: Child, phase: "drive" | "review", prompt: string) => {
  const base = git(c.handle.path, "rev-parse", "HEAD");
  const handle = await launch(c.slug, phase, prompt, base, snapshot(input).find(i => i.slug === c.slug)?.assignee);
  (c.previous ??= []).push(c.handle);
  Object.assign(c, { handle, phase, cursor: handle.cursor, evidence: undefined, acceptedHead: undefined, startup: { launchedAt: Date.now(), mode: "pi" } });
  await save();
 };
 // The driver gets the ticket and the implementer's setup, not the implementer's claims or the code.
 const toDrive = (c: Child) => advance(c, "drive", [ticketText(c.slug), "Setup handoff from the implementer:\n" + yaml(c.setup)].join("\n\n"));
 const toReview = (c: Child, report: string) => advance(c, "review", [ticketText(c.slug),
  "The change: git diff " + git(input.cwd, "merge-base", "HEAD", git(c.handle.path, "rev-parse", "HEAD")) + "..HEAD in your worktree.",
  "Driver's handoff:\n" + yaml(c.drive), "Driver's final message:\n\n" + report.slice(-4000)].join("\n\n"));

 // The join runs once the node's children (or the batch) have landed. The driver takes the node's own crossing
 // stories (tree only: a batch has no spec of its own); consolidation needs at least two changes to relate.
 const joinScope = () => {
  const node = input.ticket && !input.items ? snapshot(input).find(i => i.slug === input.ticket) : undefined;
  const landed = [...(input.unjoined?.slugs ?? []), ...state.integrated].map(slug => "- " + slug + ": " + JSON.stringify(state.reviews?.[slug] ?? input.unjoined?.reviews[slug] ?? {})).join("\n");
  return [node ? "Node " + node.slug + " (" + node.file + "), whose children have all been integrated:\n\n" + readFileSync(node.file, "utf8") : "One cycle of a synchronous ticket loop integrated these independent tickets together (issue files under docs/issues/).",
   "Landed, with each leaf review's summary:\n" + landed,
   "Tests every change must keep passing: " + (input.test ?? JSON.stringify([...(input.tests ?? []), ...(state.tests ?? [])]))].join("\n\n");
 };
 const startJoin = async (): Promise<boolean> => {
  const key = ((input.ticket || input.run || "cycle") + "-join-" + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "");
  const node = input.ticket && !input.items ? snapshot(input).find(i => i.slug === input.ticket) : undefined;
  const leafOnly = state.integrated.length === 1 && state.integrated[0] === input.ticket;
  const drive = !!node && !leafOnly && /\bstories\//.test(readFileSync(node.file, "utf8"));
  const consolidate = (input.unjoined?.slugs.length ?? 0) + state.integrated.length >= 2;
  state.join = { key, drive, ...(batch && input.joinTimeboxMs ? { deadline: Date.now() + input.joinTimeboxMs } : {}) };
  if (!drive && !consolidate) { state.join.skipped = leafOnly ? "single leaf" : "fewer than two changes landed and no crossing stories"; await save(); if (batch) record({ kind: "join-skipped", reason: state.join.skipped }); return false; }
  const head = git(input.cwd, "rev-parse", "HEAD");
  const phase = drive ? "drive" : "consolidate";
  const prompt = drive ? [joinScope(), "Drive the node's own stories: journeys that cross its children. The children's own stories were already driven and are covered by the tests above; don't redrive them. If the node has no story beyond its children's, report `stories: []` and say so.",
   "Setup handoffs from the children's implementers:\n" + yaml(state.setups ?? {})].join("\n\n") : consolidatePrompt(null, "");
  try {
   const handle = await launch(key, phase, prompt, head);
   state.children[key] = { slug: key, phase, handle, cursor: handle.cursor, startup: { launchedAt: Date.now(), mode: "pi" } };
  } catch (error) {
   state.join.skipped = "launch failed: " + error; if (batch) record({ kind: "join-skipped", reason: state.join.skipped }); else await wake("could not launch the join: " + error);
  }
  await save();
  return !!state.children[key];
 };
 const consolidatePrompt = (driven: Record<string, unknown> | null, report: string) => [joinScope(),
  "The combined change: git diff " + (input.unjoined?.base ?? state.base) + "..HEAD in your worktree.",
  ...(driven ? ["Integration driver's handoff:\n" + yaml(driven), "Integration driver's final message:\n\n" + report.slice(-4000)] : [])].join("\n\n");
 const joinTurn = async (c: Child, r: ReturnType<typeof parse>, text: string) => {
  if (c.phase === "drive") {
   if (!Array.isArray(r.handoff?.stories)) { await except(c, "integration driver reported no story outcomes", text); return; }
   c.drive = r.handoff!;
   const failed = (r.handoff!.stories as { outcome?: string }[]).some(s => s.outcome !== "held");
   // Nothing to repair and nothing to relate: the drive's evidence is the join.
   if (!failed && (input.unjoined?.slugs.length ?? 0) + state.integrated.length < 2) { c.evidence = { ...r.handoff! }; c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD"); await save(); await integrateChild(c, c.handle); return; }
   const handle = await launch(c.slug, "consolidate", consolidatePrompt(c.drive, text), git(c.handle.path, "rev-parse", "HEAD"));
   (c.previous ??= []).push(c.handle);
   Object.assign(c, { handle, phase: "consolidate", cursor: handle.cursor, startup: { launchedAt: Date.now(), mode: "pi" } });
   await save();
  } else {
   const drove = Array.isArray(c.drive?.stories) && (c.drive!.stories as unknown[]).length > 0;
   if (drove && unheld(r.handoff)) { await except(c, "consolidation did not end with every crossing story held", text); return; }
   c.evidence = { ...r.handoff!, tests: testCommands(r.handoff) };
   c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD");
   await save();
   await integrateChild(c, c.handle);
  }
 };

 const count = commands().length;
 // Explicit reconciliation is used only on a new job, never reapplied on daemon restart.
 if (job.state == null && input.commandsApplied !== undefined) {
  if (!Number.isSafeInteger(input.commandsApplied) || input.commandsApplied < 0 || input.commandsApplied > count) throw new Error("commandsApplied must be a record count between 0 and " + count);
  state.commandsApplied = input.commandsApplied;
  delete state.commandInFlight;
 }
 const ambiguous = state.commandInFlight !== undefined ? "interrupted command " + state.commandInFlight
  : state.commandsApplied === undefined && (job.state != null || input.carried != null) && count ? "legacy log has no acknowledgement cursor"
  : state.commandsApplied !== undefined && (!Number.isSafeInteger(state.commandsApplied) || state.commandsApplied < 0 || state.commandsApplied > count) ? "invalid cursor or truncated command log" : undefined;
 if (ambiguous) {
  const message = "command reconciliation required: " + ambiguous + ". Inspect worker/Git state and " + file + " (" + count + " records). Then ab supervise start " + input.ticket + " --commands-applied N, where N is the inspected prefix to leave behind; records after N will run. Do not guess or blindly replay destructive commands.";
  await wake(message);
  await deliveries;
  throw new Error(message);
 }
 state.commandsApplied ??= 0;
 await save();
 let lostWatches = 0;
 while (!job.signal.aborted) {
  await apply();
  // Timebox: stragglers are deferred like any exception, so the barrier waits at most until the deadline.
  const due = deadline();
  if (due && Date.now() >= due) for (const c of Object.values(state.children)) await except(c, "timeboxed");
  // Fill the budget from the subtree's frontier: direct children only; non-leaves get supervise.
  const issues = snapshot(input);
  const head = git(input.cwd, "rev-parse", "HEAD");
  for (const i of workItems(issues, input).filter(i => i.frontier && !i.done && !state.children[i.slug] && !state.integrated.includes(i.slug) && !state.deferred?.[i.slug])) {
   if (state.join || (input.deadline && Date.now() >= input.deadline)) break;
   if (Object.keys(state.children).length >= input.budget) break;
   const nonleaf = issues.some(j => j.partOf === i.slug && !j.done);
   const prompt = nonleaf
    ? "Supervise the subtree of " + i.file + " with a budget of " + Math.max(1, Math.floor(input.budget / 2)) + ".\n\n" + readFileSync(i.file, "utf8")
    : "Ticket " + i.file + ":\n\n" + readFileSync(i.file, "utf8") + (input.notes?.[i.slug] ? "\n\nNote from the loop's triage: " + input.notes[i.slug] : "");
   try { const handle = await launch(i.slug, nonleaf ? "supervise" : "implement", prompt, head, i.assignee); state.children[i.slug] = { slug: i.slug, phase: nonleaf ? "supervise" : "implement", handle, cursor: handle.cursor, startup: { launchedAt: Date.now(), mode: "pi" } }; }
   catch (error) {
    if (batch) { (state.deferred ??= {})[i.slug] = "launch failed"; record({ kind: "deferred", slug: i.slug, phase: "launch", reason: "launch failed: " + error }); }
    else await wake("could not launch " + i.slug + ": " + error);
   }
   await save();
  }
  const live = Object.values(state.children);
  if (!live.length) {
   const complete = !workItems(snapshot(input), input).some(i => !i.done && !state.deferred?.[i.slug]);
   if (!state.join && (batch || complete) && await startJoin()) continue;
   break;
  }
  // A missing worktree cannot restart until restored; existing worktrees can re-enter on a fresh report.
  for (const c of live) if (!c.unreachable && !existsSync(c.handle.path)) {
   c.cursor ??= (await children.last(topic(c.handle)))?.cursor;
   c.unreachable = true;
   await except(c, "unreachable", "Worker worktree is missing: " + c.handle.path);
  }
  if (job.signal.aborted) return;
  const watched = live.filter(c => !c.unreachable);
  const recovering = live.filter(c => c.unreachable);
  await checkStartup(watched);
  if (job.signal.aborted) return;
  const ids = watched.map(c => topic(c.handle));
  const recoveryIds = recovering.map(c => topic(c.handle));
  const cursors = Object.fromEntries(watched.filter(c => c.cursor).map(c => [topic(c.handle), c.cursor!]));
  const recoveryCursors = Object.fromEntries(recovering.filter(c => c.cursor).map(c => [topic(c.handle), c.cursor!]));
  const stop = new AbortController();
  const abort = () => stop.abort();
  job.signal.addEventListener("abort", abort);
  const watcher = watch(dirname(file), (_, name) => { if (name === basename(file)) stop.abort(); });
  const pendingStartup = watched.filter(c => c.startup?.mode !== "command" && !c.startup?.sessionFound && !c.startup?.reported);
  const nextStartupCheck = pendingStartup.length ? Math.min(...pendingStartup.map(c => c.startup!.checkedAt ? c.startup!.checkedAt + STARTUP_POLL_MS : c.startup!.launchedAt + STARTUP_GRACE_MS)) : undefined;
  const startupTimer = nextStartupCheck === undefined ? undefined : setTimeout(abort, Math.max(1, Math.min(STARTUP_POLL_MS, nextStartupCheck - Date.now())));
  const until = deadline();
  const deadlineTimer = until ? setTimeout(abort, Math.max(1, until - Date.now())) : undefined;
  let end: children.TurnEnd;
  try {
   // Never pass unreachable panes to turnEnd: a dead worker returns unreachable immediately. Wait for a
   // later topic report separately so an idle dead child neither spins nor gets re-woken.
   const waits = [
    ...(ids.length ? [children.turnEnd(ids, { cwd: input.cwd, after: cursors, signal: stop.signal })] : []),
    ...(recoveryIds.length ? [children.waitForTurnEnd(recoveryIds, { after: recoveryCursors, signal: stop.signal })] : []),
   ];
   end = await Promise.race(waits);
  }
  catch (error) {
   if (stop.signal.aborted) continue;
   // A dropped host connection is not a child's failure: back off and watch again, telling the owner once.
   if (++lostWatches === 5) await wake("cannot watch children (still retrying): " + error);
   job.log("watch failed (" + lostWatches + "): " + error);
   await sleep(Math.min(60_000, 2000 * lostWatches), job.signal);
   continue;
  }
  finally { stop.abort(); if (startupTimer) clearTimeout(startupTimer); if (deadlineTimer) clearTimeout(deadlineTimer); watcher?.close(); job.signal.removeEventListener("abort", abort); }
  lostWatches = 0;
  const c = live.find(child => topic(child.handle) === end.id)!;
  // Exit cursors are not board reports; keep the previous report cursor for restart detection.
  if (!end.unreachable) c.cursor = end.cursor;
  c.waiting = undefined;
  c.unreachable = undefined;
  if (c.phase === "review") { c.evidence = undefined; c.acceptedHead = undefined; }
  await save();
  if (end.unreachable) { c.unreachable = true; await except(c, "unreachable", end.text); continue; }
  await (async () => {
  const r = parse(end.text);
  if (end.kind !== "finished") { await except(c, "turn ended: " + end.kind, end.text); return; }
  if (r.handoffError) { await except(c, "handoff block did not parse: " + r.handoffError, end.text); return; }
  if (r.status === "checkpoint") {
   c.waiting = "checkpoint";
   await wake("checkpoint from " + c.phase + " " + c.slug + ":\n\n" + end.text);
   return;
  }
  // A child supervisor ends its turn while its own loop runs; only a status sentinel reports.
  if (c.phase === "supervise" && r.status === null) return;
  if (r.status !== "done") { await except(c, r.status ?? "no status sentinel", end.text); return; }
  note(c.slug, caveats(r.handoff));
  if (c.phase !== "supervise" && git(c.handle.path, "status", "--porcelain")) { await except(c, c.phase + " done with uncommitted changes", end.text); return; }
  if (isJoin(c)) { await joinTurn(c, r, end.text); return; }
  if (c.phase === "implement") { c.setup = r.handoff?.setup ?? null; (state.setups ??= {})[c.slug] = c.setup; await toDrive(c); }
  else if (c.phase === "drive") {
   // Failed stories are the reviewer's to repair; only an unusable log stops the pipeline.
   const stories = r.handoff?.stories;
   if (!Array.isArray(stories) || !stories.length) { await except(c, "driver reported no story outcomes", end.text); return; }
   evidencePacket(c.handle.path, r.handoff);
   c.drive = r.handoff!;
   await toReview(c, end.text);
  } else if (c.phase === "review") {
   if (unheld(r.handoff)) { await except(c, "review did not end with every story held", end.text); return; }
   evidencePacket(c.handle.path, r.handoff);
   if (r.handoff!.redrive === true && !c.redriven) { c.redriven = true; await toDrive(c); return; }
   c.evidence = { ...r.handoff!, tests: [...new Set([...testCommands(c.drive), ...testCommands(r.handoff)])] };
   c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD");
   await save();
   await integrateChild(c, c.handle);
  } else await integrateChild(c, c.handle);
  })().catch(error => except(c, "loop error: " + (error instanceof Error ? error.message : String(error)), end.text));
 }
 if (job.signal.aborted) return;
 const open = workItems(snapshot(input), input).filter(i => !i.done);
 if (batch) { record({ kind: "barrier", tests: state.tests ?? [], integrated: state.integrated, deferred: state.deferred ?? {}, open: open.map(i => i.slug), metrics: state.metrics }); state.finished = true; await save(); return; }
 if (open.length) { await wake("idle: nothing live, but not done: " + open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", ") + ". Resolve, then ab supervise start " + input.ticket + " again."); await deliveries; return; }
 state.finished = true; await save();
 await wake("done: " + state.integrated.length + " children integrated at " + git(input.cwd, "rev-parse", "--short", "HEAD") + ". metrics " + JSON.stringify(state.metrics) + "" + (state.join?.done ? ", joined (" + (state.join.drive ? "crossing stories driven, " : "") + "consolidated)" : state.join?.skipped ? ", join skipped: " + state.join.skipped : "") + "." + carried() + residuals(input));
 await deliveries;
}
