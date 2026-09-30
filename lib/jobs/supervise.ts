// Supervision loop as an ab daemon job: the script owns scheduling; the owning LLM agent is
// woken (by message) only on exceptions. Design: docs/issues/scripted-supervision-loop.md.
//   ab supervise start <ticket> [--budget N] [--test CMD]   (from the owning agent)
//   ab supervise status | resume <job> <child> verify|integrate|drop|redispatch
// Children are wm workers spawned with the owner as parent session; the owner is woken on
// its mailbox (mail/xxxxxxxx, lib/board/mailbox).
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync, existsSync, readFileSync, writeFileSync, realpathSync, statSync, watch } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { basename, dirname, join, resolve, relative } from "node:path";
import { homedir } from "node:os";
import { dispatch, integrate, retire as retireWorker, topic, type Handle } from "../dispatch.ts";
import * as route from "../route.ts";
import { byRole } from "../agents.ts";
import { DecisionApiUnavailableError } from "../decide.ts";
import * as children from "../children.ts";
import { parse } from "../report.ts";
import type { JobContext } from "../daemon.ts";
import { resolveSession } from "../session-meta/identity";
import { SPAWN_META } from "../session-meta/host";
import { workmuxStatus } from "../wm.ts";
import { scopes } from "../board/scopes";
import { tracer } from "./events.ts";
export interface Input { ticket: string; cwd: string; owner: string; ownerSession?: string; budget: number; test?: string; commands: string; commandsApplied?: number; carried?: State | null;
 // Owner-chosen agent per role (e.g. { review: "reviewer" }): launches skip the Decision API for these roles.
 picks?: Record<string, string>;
 // Batch mode (lib/jobs/loop.ts): run exactly these items, and on any exception defer the child (retire it,
 // keep its branch, append to the ledger) instead of waking an owner. The run returns when the batch drains.
 items?: string[]; ledger?: string; deadline?: number; run?: string;
 // Per-ticket notes from the loop's triage, passed to the implementer.
 notes?: Record<string, string>;
 // Test commands from earlier batches; every integration gate runs all of them. The join's own timebox (batch mode).
 tests?: string[]; joinTimeboxMs?: number;
 // Landed in earlier batches whose join was skipped: the next join covers them too, from their base.
 unjoined?: { slugs: string[]; base: string; reviews: Record<string, unknown> };
 // A subtree loop's final join: no items, and the ticket is the node whose crossing stories the join drives.
 nodeJoin?: boolean }
// Each leaf runs implement → drive → review → integrate; a non-leaf is one supervise child. Phases are agent roles (agents/roles/).
type Phase = "implement" | "drive" | "review" | "supervise" | "consolidate";
interface Child { slug: string; phase: Phase; handle: Handle; cursor?: string; implementer?: Handle; previous?: Handle[]; waiting?: string; waitingSince?: string; exceptionMailAt?: string; staleWakeSentFor?: string; unreachable?: boolean; evidence?: Record<string, unknown>; acceptedHead?: string; setup?: unknown; drive?: Record<string, unknown>; redriven?: boolean; startup?: { launchedAt: number; mode?: "pi" | "command"; sessionFound?: boolean; reported?: boolean; checkedAt?: number } }
interface Child { reportRepairs?: number }
export interface Metrics { wakes: number; ownerBytes: number; launched: number; completed: number; /** most children live at once: whether the budget ever binds */ peak?: number }
// Caveats are residuals, not stops: carried to the verifier and to the done message, where the owner files them.
export interface State { children: Record<string, Child>; integrated: string[]; metrics: Metrics; finished?: boolean; crossing?: Child; caveats?: Record<string, string[]>; commandsApplied?: number; commandInFlight?: number; deferred?: Record<string, string>; decisionUnavailable?: Record<string, string>;
 // Spec leaves whose implementer committed children instead of a change: they are nodes now, and in batch mode
 // they return to the loop, whose next triage runs them as subtrees.
 decomposed?: string[];
 // Join: once this node's (or batch's) children have landed, drive its crossing stories and consolidate the combined change.
 base?: string; tests?: string[]; reviews?: Record<string, unknown>; setups?: Record<string, unknown>;
 join?: { key: string; drive: boolean; deadline?: number; skipped?: string; done?: boolean } }
export type Command = { child: string; action: "verify" | "integrate" | "drop" | "redispatch" }
 // Adopt a worker this loop didn't launch (an orphan of a dead loop, a hand dispatch) at its phase. The last
 // handle is current; earlier ones (e.g. the implementer behind a driver) are retired with it after integration.
 | { child: string; action: "adopt"; phase: "implement" | "drive" | "review"; handles: { run: string; handle: string }[] };

const TRACKER = join(homedir(), ".pi/agent/skills/tracker/scripts/issues.ts");
const STARTUP_GRACE_MS = 30_000;
const STARTUP_POLL_MS = 5_000;
const STALE_WAIT_MS = 30 * 60_000;
interface Issue { slug: string; file: string; partOf: string | null; assignee?: string | null; frontier: boolean; done: boolean; archived?: boolean; effectiveStage: string }
// The tracker reports archived issues as not done; they contribute neutral done to their parent.
const finished = (i: Issue) => i.done || !!i.archived;
function snapshot(input: Input): Issue[] {
 // The loop's own state is authoritative for its children; the tracker's derived in-flight claims would
 // hide them (and a redispatched child's surviving branch) from it.
 return JSON.parse(execFileSync("bun", [TRACKER, "snapshot", ...(input.ticket ? [input.ticket] : []), "--json"], { cwd: input.cwd, encoding: "utf8", env: { ...process.env, TRACKER_NO_INFLIGHT: "1" } })).issues;
}
// When a ticket has no unfinished direct children, it is the loop's single leaf: a node's own stage is residual
// work that nothing else runs, so once its children are finished the node itself goes through implement.
function workItems(issues: Issue[], input: Input): Issue[] {
 if (input.items) return issues.filter(i => input.items!.includes(i.slug));
 const direct = issues.filter(i => i.partOf === input.ticket);
 return direct.some(i => !finished(i)) ? direct : issues.filter(i => i.slug === input.ticket);
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
function workerAddress(handle: Handle, cwd: string): string | undefined {
 const existing = scopes(handle.path).find(value => value.startsWith("wt/"));
 if (existing) return existing;
 const current = scopes(cwd).find(value => value.startsWith("wt/"));
 const repo = current?.slice("wt/".length).split("/")[0];
 return repo ? `wt/${repo}/${handle.handle}` : undefined;
}
async function paneTail(cwd: string, handle: Handle) {
 const worker = (await workmuxStatus(cwd).catch(() => [])).find(entry => entry.worktree === handle.handle || resolve(entry.workdir) === resolve(handle.path));
 const session = handle.session ?? handle.run.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
 const target = worker?.pane_id || (session ? session + ":" + handle.handle : "");
 if (!target) return "";
 return execFileSync("tmux", ["capture-pane", "-p", "-J", "-S", "-100", "-t", target], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
}
// Long subprocesses (test gates, Jev lint) must not block the daemon's event loop: an unresponsive daemon
// gets killed and replaced by the next client's ensure(), interrupting every job it hosts.
const exec = promisify(execFile);
const RUN = { maxBuffer: 64 * 1024 * 1024 };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
// Every loop runs in the one ab daemon, and loops over the same repository commit to the same checkout;
// preparation and integration run one loop at a time per repository (including symlink aliases).
const repoTurns = new Map<string, Promise<unknown>>();
export function serialized<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
 const key = realpathSync(resolve(cwd, git(cwd, "rev-parse", "--git-common-dir")));
 const run = (repoTurns.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
 repoTurns.set(key, run);
 return run;
}
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>(done => {
 const t = setTimeout(done, ms); signal?.addEventListener("abort", () => { clearTimeout(t); done(); }, { once: true });
});
// Sessions outside the daemon (the owner, a human) also commit there; a lost ref or index lock is retried.
export async function commitRetrying(cwd: string, ...args: string[]) {
 for (let attempt = 1; ; attempt++) {
  try { return git(cwd, "commit", ...args); }
  catch (error) { if (attempt >= 5 || !/cannot lock ref|index\.lock/.test(String(error))) throw error; await sleep(1000 * attempt); }
 }
}
const caveats = (h: Record<string, unknown> | null): string[] => { const c = h?.caveats; return Array.isArray(c) ? c.map(x => typeof x === "string" ? x : JSON.stringify(x)) : c && !/^(none|no|\[\])$/i.test(String(c).trim()) ? [String(c)] : []; };
// Tests encoding the driver's checks (written by the reviewer; older drivers wrote their own): the integration gate runs them on the reviewer's final head.
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
const storyShapeError = (h: Record<string, unknown> | null, allowEmpty = false): string | null => {
 const stories = h?.stories;
 if (!Array.isArray(stories)) return "stories is missing or is not a list; expected stories: [{story: ..., outcome: held|failed|unobservable}]";
 if (!stories.length && !allowEmpty) return "stories is empty; expected one {story, outcome} entry per required story";
 for (let i = 0; i < stories.length; i++) {
  const story = stories[i];
  if (!story || typeof story !== "object" || Array.isArray(story)) return `stories[${i}] is a ${story === null ? "null" : typeof story}; expected {story, outcome}`;
  if (typeof story.story !== "string" || !story.story.trim()) return `stories[${i}].story is missing or not a string; expected {story, outcome}`;
  if (!( ["held", "failed", "unobservable"] as unknown[]).includes(story.outcome)) return `stories[${i}].outcome is ${JSON.stringify(story.outcome)}; expected held, failed, or unobservable`;
 }
 return null;
};
const evidenceShapeError = (h: Record<string, unknown> | null): string | null => {
 const evidence = h?.evidence;
 if (evidence === undefined) return "evidence is missing; expected {path, visual, shots}";
 if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) return `evidence is ${evidence === null ? "null" : "a " + typeof evidence}; expected {path, visual, shots}`;
 const item = evidence as Record<string, unknown>;
 if (typeof item.path !== "string" || !item.path.trim()) return "evidence.path is missing or not a string; expected a committed Markdown index path";
 if (typeof item.visual !== "boolean") return "evidence.visual is missing or not a boolean";
 if (!Array.isArray(item.shots) || item.shots.some((shot: unknown) => typeof shot !== "string")) return "evidence.shots is missing or is not a list of image paths";
 if (item.visual && !item.shots.length) return "evidence.shots is empty but evidence.visual is true; expected committed image paths";
 if (!item.visual && item.shots.length) return "evidence.shots must be [] when evidence.visual is false";
 return null;
};
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
async function residuals(input: Input): Promise<string> {
 try {
  const { reports } = JSON.parse((await exec("bun", [TRACKER, "lint", input.ticket, "--json"], { ...RUN, cwd: input.cwd, encoding: "utf8", timeout: 300_000 })).stdout);
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
 if (!job.state && state.decisionUnavailable) {
  if (state.join && state.decisionUnavailable[state.join.key]) state.join = undefined;
  delete state.decisionUnavailable;
 }
 // A continuation of a finished run whose node still has work (its own residual, new children) runs it and
 // joins again; a finished run with nothing open just finishes again.
 if (!job.state && state.finished && !input.items && workItems(snapshot(input), input).some(i => !finished(i) && !state.integrated.includes(i.slug))) { state.finished = undefined; state.join = undefined; }
 // Older persisted jobs stored only a delivery address. Never use the daemon's own session as parent.
 const batch = !!input.ledger;
 const record = (entry: Record<string, unknown>) => appendFileSync(input.ledger!, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
 const trace = tracer(input.commands, { job: job.id, run: input.run ?? input.ticket, mode: batch ? "batch" : "dataflow" });
 trace("start", { budget: input.budget, resumed: job.state != null, ...(input.items ? { items: input.items } : {}) });
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
 let wakeDeliveryChanged: (() => void) | undefined;
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
 const wake = async (text: string, onDelivered?: () => void) => {
  if (batch) { record({ kind: "note", text }); return; }
  trace("wake", { about: text.split("\n")[0].slice(0, 120) });
  const message = "supervise " + input.ticket + " (job " + job.id + "): " + text;
  state.metrics.wakes++; state.metrics.ownerBytes += Buffer.byteLength(message);
  deliveries = deliveries.then(async () => {
   await deliver(message);
   if (onDelivered && !job.signal.aborted) { onDelivered(); await save(); wakeDeliveryChanged?.(); }
  });
  await save();
 };
 const except = async (c: Child, reason: string, text = "") => {
  if (batch && state.children[c.slug] !== c) return; // already deferred this turn
  const waitingSince = new Date().toISOString();
  c.waiting = reason; c.waitingSince = waitingSince; c.exceptionMailAt = undefined; c.staleWakeSentFor = undefined;
  trace("exception", { slug: c.slug, phase: c.phase, reason: reason.slice(0, 200) });
  if (batch) {
   // Deferral unwinds the child: its unmerged branch survives for the next triage (redispatch starts fresh).
   record({ kind: "deferred", slug: c.slug, phase: c.phase, reason, branch: c.handle.handle, report: text.slice(-1500) });
   delete state.children[c.slug]; (state.deferred ??= {})[c.slug] = reason;
   await save();
   trace("child-end", { slug: c.slug, outcome: "deferred" });
   await retireAll(c);
   return;
  }
  const address = workerAddress(c.handle, input.cwd) ?? topic(c.handle);
  const command = "ab mail " + address + " TEXT";
  await wake(c.phase + " " + c.slug + ": " + reason + "\n\n" + text.slice(-3000) +
   "\n\nWaiting worker: " + command + "; worktree " + c.handle.path +
   (c.unreachable
     ? (existsSync(c.handle.path)
       ? ". Restart it in its existing worktree before steering it; its next report on this topic returns to the loop"
       : ". After restoring its worktree, restart it there before steering it; its next report on this topic returns to the loop")
     : ". Steer it directly; its next turn end returns to the loop") +
   ", or: ab supervise resume " + input.ticket + " " + c.slug + " verify|integrate|drop|redispatch", () => {
    if (c.waitingSince === waitingSince) c.exceptionMailAt = new Date().toISOString();
   });
 };
 const reWakeStaleWaits = async () => {
  const now = Date.now();
  for (const c of Object.values(state.children)) {
   if (!c.waiting || !c.waitingSince || !c.exceptionMailAt || c.staleWakeSentFor === c.waitingSince) continue;
   const mailAt = Date.parse(c.exceptionMailAt);
   if (!Number.isFinite(mailAt) || now < mailAt + STALE_WAIT_MS) continue;
   const latest = await children.last(topic(c.handle));
   if (latest && latest.cursor !== c.cursor) continue;
   const waitingSince = c.waitingSince;
   // Persist before queueing so a daemon restart can't repeatedly remind for one exception.
   c.staleWakeSentFor = waitingSince;
   await save();
   await wake("stale wait: " + c.phase + " " + c.slug + " is still waiting: " + c.waiting + ". The exception notice was sent at " + c.exceptionMailAt + " and no child turn has arrived since; child " + topic(c.handle) + ", worktree " + c.handle.path + ". Check whether your steer reached it or queue a resume. This is the one reminder for this exception.");
  }
 };
 // Mirrors the supervised handoff schema in docs/verification-evidence.md.
 const reportSchema = "Required handoff form (docs/verification-evidence.md):\n\n`done` must be the first nonblank line. For drive reports, outcomes may be held, failed, or unobservable; for review reports every outcome must be held on the final head. Choose one outcome, not a pipe-separated list.\n\n```yaml\nstories:\n  - story: ...\n    outcome: held\nevidence:\n  path: docs/attachments/<ticket>/index.md\n  visual: false\n  shots: []\ntests:\n  - lib/example.test.ts\ncaveats: []\n```\n\nDrivers omit tests; reviewers list the test files encoding the checks. For a nonvisual journey use `visual: false` and `shots: []`; for a visual journey use `visual: true` and list committed image files. Preserve completed work; fix only this report and send the complete report again in this same checkout. Do not invent evidence or claim held unless established.";
 const repairReport = async (c: Child, reason: string, text: string, escalationReason = reason) => {
  // One correction turn: the second malformed report wakes the owner.
  if ((c.reportRepairs ?? 0) >= 1) { await except(c, escalationReason + " (still invalid after two reports)", text); return false; }
  c.reportRepairs = (c.reportRepairs ?? 0) + 1;
  await save();
  // The stories/evidence form is the drive, review and consolidate contract; other phases keep their role's handoff keys.
  const schema = c.phase === "drive" || c.phase === "review" || c.phase === "consolidate" ? reportSchema
   : "`done` must be the first nonblank line, followed by the fenced yaml handoff your role asks for (agents/roles/" + c.phase + ".md); quote any scalar containing `: ` or `;`. Preserve completed work; fix only this report and send the complete report again in this same checkout.";
  await children.send(topic(c.handle), reason + "\n\n" + schema);
  return false;
 };
 const repairEvidence = async (c: Child, handoff: Record<string, unknown> | null, text: string) => {
  const shape = evidenceShapeError(handoff);
  if (shape) return repairReport(c, "invalid evidence handoff: " + shape, text);
  try { evidencePacket(c.handle.path, handoff); return true; }
  catch (error) {
   const reason = "invalid evidence handoff: " + (error instanceof Error ? error.message : String(error));
   return repairReport(c, reason, text);
  }
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
  const prepared = await route.prepareRole(phase, prompt, { assignee: assignee ?? "agent", ...(input.picks?.[phase] ? { pick: input.picks[phase] } : {}) });
  if (prepared.kind !== "ready") throw new Error("routing needs triage for " + slug);
  const receipt = await dispatch([{ handle: phase === "implement" || phase === "supervise" ? slug : slug + "-" + phase + (state.children[slug]?.previous?.length ? "-" + state.children[slug].previous!.length : ""), prompt, agent: prepared.agent, role: phase, model: prepared.model, effort: prepared.effort, base }],
   { run: input.run ?? input.ticket, cwd: input.cwd, maxConcurrent: 1, active: [], parent });
  if (!receipt.submitted[0]) throw new Error("launch failed for " + slug + ": " + (receipt.failed?.error ?? "pending"));
  state.metrics.launched++;
  trace("launch", { slug, phase, handle: receipt.submitted[0].handle, model: prepared.model });
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
 const integrateChild = (c: Child, handle: Handle) => { trace("integrate-queued", { slug: c.slug }); return serialized(input.cwd, async () => {
  trace("integrate-start", { slug: c.slug });
  let packet: ReturnType<typeof evidencePacket> | undefined;
  if (c.phase !== "supervise") {
   if (!c.acceptedHead || c.acceptedHead !== git(handle.path, "rev-parse", "HEAD") || (!isJoin(c) && unheld(c.evidence ?? null))) { trace("integrate-end", { slug: c.slug, ok: false }); return except(c, "an accepted review of the current head is required before integration"); }
   if (!isJoin(c)) packet = evidencePacket(handle.path, c.evidence ?? null);
  }
  // Failed preparation keeps both the owner HEAD and the child's resources intact.
  const attempt = () => integrate(handle, { cwd: input.cwd, keep: true, prepare: async worker => {
   // The loop owns this clean rebase; keep retries bound to the rebased revision.
   if (c.phase !== "supervise") { c.acceptedHead = git(worker.path, "rev-parse", "HEAD"); await save(); }
   // The tests encoding the driver's checks are the contract; they gate integration mechanically.
   // Earlier siblings' tests too, so one child can't silently break another's contract.
   if (input.test) await exec("bash", ["-lc", input.test], { ...RUN, cwd: worker.path });
   else for (const file of new Set([...(input.tests ?? []), ...(state.tests ?? []), ...testCommands(c.evidence)])) {
    const command = testRun(worker.path, file);
    if (command) await exec(command[0], command.slice(1), { ...RUN, cwd: worker.path });
   }
   if (!isJoin(c)) await close(c.slug, worker.path, packet?.path);
   if (c.phase !== "supervise") { c.acceptedHead = git(worker.path, "rev-parse", "HEAD"); await save(); }
  } });
  try { await attempt(); }
  catch (error: any) {
   trace("integrate-end", { slug: c.slug, ok: false });
   return except(c, "integration failed", String(error) + "\n" + String(error.stdout ?? "") + String(error.stderr ?? ""));
  }
  delete state.children[c.slug];
  state.tests = [...new Set([...(state.tests ?? []), ...testCommands(c.evidence)])];
  if (isJoin(c)) state.join!.done = true;
  else {
   state.integrated.push(c.slug); state.metrics.completed++;
   if (c.evidence) (state.reviews ??= {})[c.slug] = { stories: c.evidence.stories, filed: c.evidence.filed, caveats: c.evidence.caveats };
  }
  // Save before recording: a restart between them must not resume a child that already landed.
  await save();
  trace("integrate-end", { slug: c.slug, ok: true }); trace("child-end", { slug: c.slug, outcome: isJoin(c) ? "joined" : "integrated" });
  if (batch) record({ kind: isJoin(c) ? "joined" : "integrated", slug: c.slug, head: git(input.cwd, "rev-parse", "--short", "HEAD"), ...(isJoin(c) ? { changes: c.evidence?.changes, filed: c.evidence?.filed } : {}) });
  // Crash after saving may leave resources behind, but never a saved handle we already retired.
  await retire(handle);
  if (c.implementer) await retire(c.implementer);
  for (const old of c.previous ?? []) await retire(old);
 }); };
 // An implementer that decomposed its spec leaf lands only tracker changes, without drive or review: the
 // children get their own. Any other change on the branch goes through the normal pipeline instead.
 const decompose = (c: Child, kids: Issue[], after: Issue[]) => serialized(input.cwd, async () => {
  const dirs = [...new Set(after.map(i => dirname(relative(realpathSync(c.handle.path), realpathSync(i.file)))))];
  const base = git(c.handle.path, "merge-base", "HEAD", git(input.cwd, "rev-parse", "HEAD"));
  const outside = git(c.handle.path, "diff", "--name-only", base, "HEAD").split("\n").filter(f => f && !dirs.some(d => f === d || f.startsWith(d + "/")));
  if (outside.length) return except(c, "decomposed with changes outside the tracker (" + outside.slice(0, 5).join(", ") + "); land children only, or implement the leaf whole");
  trace("integrate-start", { slug: c.slug, decomposed: kids.map(k => k.slug) });
  try { await integrate(c.handle, { cwd: input.cwd, keep: true, prepare: async worker => { if (input.test) await exec("bash", ["-lc", input.test], { ...RUN, cwd: worker.path }); } }); }
  catch (error: any) { trace("integrate-end", { slug: c.slug, ok: false }); return except(c, "integration of the decomposition failed", String(error) + "\n" + String(error.stdout ?? "") + String(error.stderr ?? "")); }
  delete state.children[c.slug];
  (state.decomposed ??= []).push(c.slug);
  await save();
  trace("integrate-end", { slug: c.slug, ok: true }); trace("child-end", { slug: c.slug, outcome: "decomposed" });
  if (batch) record({ kind: "decomposed", slug: c.slug, children: kids.map(k => k.slug), head: git(input.cwd, "rev-parse", "--short", "HEAD") });
  await retire(c.handle);
 });

 // No cursor: the first watch consumes the worker's latest report, so a worker that already finished its
 // phase advances at once and a running one is awaited.
 const adopt = async (cmd: Extract<Command, { action: "adopt" }>, live?: Child) => {
  if (live) return wake("adopt: " + cmd.child + " is already live here (" + live.phase + " " + topic(live.handle) + ")");
  const handles = cmd.handles.map(h => ({ ...h, path: resolve(input.cwd, "..", basename(input.cwd) + "__worktrees", h.handle) }));
  const missing = handles.find(h => !existsSync(h.path));
  if (missing) return wake("adopt: no worktree for " + missing.run + "/" + missing.handle + " at " + missing.path);
  state.children[cmd.child] = { slug: cmd.child, phase: cmd.phase, handle: handles.at(-1)!, previous: handles.slice(0, -1), startup: { launchedAt: Date.now(), mode: "pi", sessionFound: true } };
  trace("adopt", { slug: cmd.child, phase: cmd.phase, handles: handles.map(h => h.run + "/" + h.handle) });
 };

 // Pending owner commands (resume, adopt) are applied between turn ends.
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
   trace("command", { slug: cmd.child, action: cmd.action, live: !!c });
   if (cmd.action === "adopt") await adopt(cmd, c);
   else if (!c) await wake("resume: no live child " + cmd.child);
   else {
    c.waiting = undefined; c.waitingSince = undefined; c.exceptionMailAt = undefined; c.staleWakeSentFor = undefined; c.unreachable = undefined;
    try {
     if (cmd.action === "drop" || cmd.action === "redispatch") { await retire(c.handle); if (c.implementer) await retire(c.implementer); for (const old of c.previous ?? []) await retire(old); delete state.children[c.slug]; trace("child-end", { slug: c.slug, outcome: cmd.action }); }
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
  c.reportRepairs = 0;
  await save();
 };
 // The driver gets the ticket and the implementer's setup, not the implementer's claims or the code.
 const toDrive = (c: Child) => advance(c, "drive", [ticketText(c.slug), "Setup handoff from the implementer:\n" + yaml(c.setup)].join("\n\n"));
 const toReview = (c: Child, report: string) => advance(c, "review", [ticketText(c.slug),
  "The change: git diff " + git(input.cwd, "merge-base", "HEAD", git(c.handle.path, "rev-parse", "HEAD")) + "..HEAD in your worktree.",
  "Driver's handoff:\n" + yaml(c.drive), "Driver's final message:\n\n" + report.slice(-4000)].join("\n\n"));

 // The join runs once the node's children (or the batch) have landed. The driver takes the node's own crossing
 // stories (tree only: a batch has no spec of its own); consolidation needs at least two changes to relate.
 // Workers run in their own worktrees: an absolute path would point them at the owner's checkout.
 const rel = (file: string) => relative(realpathSync(input.cwd), realpathSync(file));
 const joinScope = () => {
  const node = input.ticket && (!input.items || input.nodeJoin) ? snapshot(input).find(i => i.slug === input.ticket) : undefined;
  const landed = [...(input.unjoined?.slugs ?? []), ...state.integrated].map(slug => "- " + slug + ": " + JSON.stringify(state.reviews?.[slug] ?? input.unjoined?.reviews[slug] ?? {})).join("\n");
  return [node ? "Node " + node.slug + " (" + rel(node.file) + "), whose children have all been integrated:\n\n" + readFileSync(node.file, "utf8") : "One cycle of a synchronous ticket loop integrated these independent tickets together (issue files under docs/issues/).",
   "Landed, with each leaf review's summary:\n" + landed,
   "Tests every change must keep passing: " + (input.test ?? JSON.stringify([...(input.tests ?? []), ...(state.tests ?? [])]))].join("\n\n");
 };
 const startJoin = async (): Promise<boolean> => {
  const key = ((input.ticket || input.run || "cycle") + "-join-" + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "");
  const node = input.ticket && (!input.items || input.nodeJoin) ? snapshot(input).find(i => i.slug === input.ticket) : undefined;
  const leafOnly = state.integrated.length === 1 && state.integrated[0] === input.ticket;
  // A node whose own leaf ran (after its children) already drove its stories through drive and review.
  const drive = !!node && !leafOnly && !state.integrated.includes(input.ticket) && /\bstories\//.test(readFileSync(node.file, "utf8"));
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
   if (error instanceof DecisionApiUnavailableError && !batch) (state.decisionUnavailable ??= {})[key] = error.message;
   else { state.join.skipped = "launch failed: " + error; if (batch) record({ kind: "join-skipped", reason: state.join.skipped }); else await wake("could not launch the join: " + error); }
  }
  await save();
  return !!state.children[key];
 };
 const consolidatePrompt = (driven: Record<string, unknown> | null, report: string) => [joinScope(),
  "The combined change: git diff " + (input.unjoined?.base ?? state.base) + "..HEAD in your worktree." + (batch ? " Other loops may integrate into the same branch concurrently, so that diff can include their work: consolidate what the tickets above changed, and leave the rest." : ""),
  ...(driven ? ["Integration driver's handoff:\n" + yaml(driven), "Integration driver's final message:\n\n" + report.slice(-4000)] : [])].join("\n\n");
 const joinTurn = async (c: Child, r: ReturnType<typeof parse>, text: string) => {
 if (c.phase === "drive") {
  const shape = storyShapeError(r.handoff, true);
  if (shape) { await repairReport(c, shape, text); return; }
  if (r.handoff?.evidence !== undefined) {
   const evidenceShape = evidenceShapeError(r.handoff);
   if (evidenceShape) { await repairReport(c, "invalid evidence handoff: " + evidenceShape, text); return; }
  }
  c.drive = r.handoff!;
  const failed = (r.handoff!.stories as { outcome?: string }[]).some(s => s.outcome !== "held");
  // Nothing to repair and nothing to relate: the drive's evidence is the join.
  if (!failed && (input.unjoined?.slugs.length ?? 0) + state.integrated.length < 2) { c.evidence = { ...r.handoff! }; c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD"); await save(); await integrateChild(c, c.handle); return; }
  const handle = await launch(c.slug, "consolidate", consolidatePrompt(c.drive, text), git(c.handle.path, "rev-parse", "HEAD"));
  (c.previous ??= []).push(c.handle);
  Object.assign(c, { handle, phase: "consolidate", cursor: handle.cursor, reportRepairs: 0, startup: { launchedAt: Date.now(), mode: "pi" } });
  await save();
 } else {
  const drove = Array.isArray(c.drive?.stories) && (c.drive!.stories as unknown[]).length > 0;
  if (drove || r.handoff?.stories !== undefined) {
   const shape = storyShapeError(r.handoff, false);
   if (shape) { await repairReport(c, shape, text); return; }
  }
  if (drove) {
   const stories = r.handoff!.stories as { story: string; outcome: string }[];
   const notHeld = stories.findIndex(s => s.outcome !== "held");
   if (notHeld >= 0) { await except(c, `consolidation story stories[${notHeld}] outcome is ${JSON.stringify(stories[notHeld].outcome)}; expected held`, text); return; }
  }
  if (r.handoff?.evidence !== undefined) {
   const evidenceShape = evidenceShapeError(r.handoff);
   if (evidenceShape) { await repairReport(c, "invalid evidence handoff: " + evidenceShape, text); return; }
  }
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
 // An accepted head with no exception means the review (or join) was accepted and integration had not
 // finished: the daemon restarted mid-gate. Its turn end is already consumed, so re-enter integration.
 for (const c of Object.values(state.children)) if (c.acceptedHead && !c.waiting && c.phase !== "supervise" && !job.signal.aborted) {
  trace("integrate-resumed", { slug: c.slug });
  await integrateChild(c, c.handle);
 }
 let lostWatches = 0;
 while (!job.signal.aborted) {
  await apply();
  await reWakeStaleWaits();
  // Timebox: stragglers are deferred like any exception, so the barrier waits at most until the deadline.
  const due = deadline();
  if (due && Date.now() >= due) for (const c of Object.values(state.children)) await except(c, "timeboxed");
  // Fill the budget from the subtree's frontier: direct children only; non-leaves get supervise.
  const issues = snapshot(input);
  const head = git(input.cwd, "rev-parse", "HEAD");
  for (const i of workItems(issues, input).filter(i => i.frontier && !i.done && !state.children[i.slug] && !state.integrated.includes(i.slug) && !state.deferred?.[i.slug] && !state.decisionUnavailable?.[i.slug] && !(batch && state.decomposed?.includes(i.slug)))) {
   if (state.join || (input.deadline && Date.now() >= input.deadline)) break;
   if (Object.keys(state.children).length >= input.budget) break;
   const nonleaf = issues.some(j => j.partOf === i.slug && !finished(j));
   const node = issues.some(j => j.partOf === i.slug);
   const prompt = nonleaf
    ? "Supervise the subtree of " + rel(i.file) + " with a budget of " + Math.max(1, Math.floor(input.budget / 2)) + ".\n\n" + readFileSync(i.file, "utf8")
    : (i.effectiveStage === "spec" ? "Spec leaf " : "Ticket ") + rel(i.file) + ":\n\n" + readFileSync(i.file, "utf8") + (node ? "\n\nIts children are all done; what remains is its own stage (residual work, including its joined acceptance). Realize it, or commit spec/ticket children that partition it (the loop then runs them and returns here), or, when only acceptance remains, change nothing but drive that acceptance. Don't redo the children." : "") + (input.notes?.[i.slug] ? "\n\nNote from the loop's triage: " + input.notes[i.slug] : "");
   try { const handle = await launch(i.slug, nonleaf ? "supervise" : "implement", prompt, head, i.assignee); state.children[i.slug] = { slug: i.slug, phase: nonleaf ? "supervise" : "implement", handle, cursor: handle.cursor, startup: { launchedAt: Date.now(), mode: "pi" } }; }
   catch (error) {
    if (batch) { (state.deferred ??= {})[i.slug] = "launch failed"; record({ kind: "deferred", slug: i.slug, phase: "launch", reason: "launch failed: " + error }); }
    else if (error instanceof DecisionApiUnavailableError) (state.decisionUnavailable ??= {})[i.slug] = error.message;
    else await wake("could not launch " + i.slug + ": " + error);
   }
   await save();
  }
  const live = Object.values(state.children);
  if (!live.length) {
   const complete = !workItems(snapshot(input), input).some(i => !finished(i) && !state.deferred?.[i.slug]);
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
  wakeDeliveryChanged = abort;
  job.signal.addEventListener("abort", abort);
  const watcher = watch(dirname(file), (_, name) => { if (name === basename(file)) stop.abort(); });
  const pendingStartup = watched.filter(c => c.startup?.mode !== "command" && !c.startup?.sessionFound && !c.startup?.reported);
  const nextStartupCheck = pendingStartup.length ? Math.min(...pendingStartup.map(c => c.startup!.checkedAt ? c.startup!.checkedAt + STARTUP_POLL_MS : c.startup!.launchedAt + STARTUP_GRACE_MS)) : undefined;
  const startupTimer = nextStartupCheck === undefined ? undefined : setTimeout(abort, Math.max(1, Math.min(STARTUP_POLL_MS, nextStartupCheck - Date.now())));
  const until = deadline();
  const staleAt = Object.values(state.children).map(c => {
   if (!c.waiting || !c.waitingSince || !c.exceptionMailAt || c.staleWakeSentFor === c.waitingSince) return undefined;
   const mailAt = Date.parse(c.exceptionMailAt);
   return Number.isFinite(mailAt) ? mailAt + STALE_WAIT_MS : undefined;
  }).filter((at): at is number => at !== undefined).sort((a, b) => a - b)[0];
  const staleTimer = staleAt === undefined ? undefined : setTimeout(abort, Math.max(1, staleAt - Date.now()));
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
  finally { if (wakeDeliveryChanged === abort) wakeDeliveryChanged = undefined; stop.abort(); if (startupTimer) clearTimeout(startupTimer); if (staleTimer) clearTimeout(staleTimer); if (deadlineTimer) clearTimeout(deadlineTimer); watcher?.close(); job.signal.removeEventListener("abort", abort); }
  lostWatches = 0;
  const c = live.find(child => topic(child.handle) === end.id)!;
  // Exit cursors are not board reports; keep the previous report cursor for restart detection.
  if (!end.unreachable) c.cursor = end.cursor;
  c.waiting = undefined; c.waitingSince = undefined; c.exceptionMailAt = undefined; c.staleWakeSentFor = undefined;
  c.unreachable = undefined;
  trace("turn", { slug: c.slug, phase: c.phase, end: end.unreachable ? "unreachable" : end.kind, ...(end.unreachable ? {} : { status: parse(end.text).status }) });
  if (c.phase === "review") { c.evidence = undefined; c.acceptedHead = undefined; }
  await save();
  if (end.unreachable) { c.unreachable = true; await except(c, "unreachable", end.text); continue; }
  await (async () => {
  const r = parse(end.text);
  if (end.kind !== "finished") { await except(c, "turn ended: " + end.kind, end.text); return; }
  if (r.handoffError) { await repairReport(c, "handoff YAML parse error: " + r.handoffError, end.text, "handoff block did not parse: " + r.handoffError); return; }
  if (r.status === "checkpoint") {
   c.waiting = "checkpoint"; c.waitingSince = new Date().toISOString(); c.exceptionMailAt = undefined; c.staleWakeSentFor = undefined;
   await wake("checkpoint from " + c.phase + " " + c.slug + ":\n\n" + end.text);
   return;
  }
  // A child supervisor ends its turn while its own loop runs; only a status sentinel reports.
  if (c.phase === "supervise" && r.status === null) return;
  if (r.status !== "done") {
   if (r.status === null) {
    await repairReport(c, "missing or misplaced status sentinel: put `done` as the first nonblank line (not after the report)", end.text, "no status sentinel: expected `done` as the first nonblank line");
    return;
   }
   await except(c, r.status, end.text);
   return;
  }
  note(c.slug, caveats(r.handoff));
  if (c.phase !== "supervise" && git(c.handle.path, "status", "--porcelain")) { await except(c, c.phase + " done with uncommitted changes", end.text); return; }
  if (isJoin(c)) { await joinTurn(c, r, end.text); return; }
  if (c.phase === "implement") {
   const after = snapshot({ ...input, cwd: c.handle.path });
   const kids = after.filter(i => i.partOf === c.slug && !finished(i));
   if (kids.length) { await decompose(c, kids, after); return; }
   c.setup = r.handoff?.setup ?? null; (state.setups ??= {})[c.slug] = c.setup; await toDrive(c);
  }
  else if (c.phase === "drive") {
   // Failed stories are the reviewer's to repair; only an unusable log stops the pipeline.
   const storiesError = storyShapeError(r.handoff);
   if (storiesError) { await repairReport(c, storiesError, end.text); return; }
   if (!await repairEvidence(c, r.handoff, end.text)) return;
   c.drive = r.handoff!;
   await toReview(c, end.text);
  } else if (c.phase === "review") {
   const storiesError = storyShapeError(r.handoff);
   if (storiesError) { await repairReport(c, storiesError, end.text); return; }
   const stories = r.handoff!.stories as { story: string; outcome: string }[];
   const notHeld = stories.findIndex(story => story.outcome !== "held");
   if (notHeld >= 0) { await except(c, `review story stories[${notHeld}] outcome is ${JSON.stringify(stories[notHeld].outcome)}; expected held`, end.text); return; }
   if (!await repairEvidence(c, r.handoff, end.text)) return;
   if (r.handoff!.redrive === true && !c.redriven) { c.redriven = true; await toDrive(c); return; }
   c.evidence = { ...r.handoff!, tests: [...new Set([...testCommands(c.drive), ...testCommands(r.handoff)])] };
   c.acceptedHead = git(c.handle.path, "rev-parse", "HEAD");
   await save();
   await integrateChild(c, c.handle);
  } else await integrateChild(c, c.handle);
  })().catch(error => except(c, error instanceof DecisionApiUnavailableError ? error.message : "loop error: " + (error instanceof Error ? error.message : String(error)), end.text));
 }
 if (job.signal.aborted) return;
 const open = workItems(snapshot(input), input).filter(i => !finished(i));
 trace("finish", { integrated: state.integrated.length, deferred: Object.keys(state.deferred ?? {}).length, open: open.length, metrics: state.metrics });
 if (batch) { record({ kind: "barrier", tests: state.tests ?? [], integrated: state.integrated, deferred: state.deferred ?? {}, open: open.map(i => i.slug), metrics: state.metrics }); state.finished = true; await save(); return; }
 if (state.decisionUnavailable && Object.keys(state.decisionUnavailable).length) {
  const unavailable = Object.entries(state.decisionUnavailable).map(([slug, reason]) => "- " + slug + ": " + reason).join("\n");
  // The owner picks instead of waiting out the outage: only roles with several agents consult the Decision API.
  let choices = "(roster unreadable: see the role: lines in ~/.pi/agent/agents)";
  try { choices = ["implement", "review", "drive", "consolidate", "supervise"].map(r => [r, byRole(r).map(a => a.name)] as const).filter(([, names]) => names.length > 1)
   .map(([r, names]) => "- " + r + ": " + names.join(", ")).join("\n"); } catch {}
  await wake("Decision API unavailable; no worker was launched for:\n" + unavailable + "\n\nPick the agents yourself and restart: `ab supervise start " + input.ticket + " --pick <role>=<agent>` (repeatable; picks persist across restarts until replaced). Choices:\n" + choices + "\n\nOr resume the same way without --pick once the service recovers.");
  await deliveries;
  return;
 }
 if (open.length) { await wake("idle: nothing live, but not done: " + open.map(i => i.slug + " (" + i.effectiveStage + (i.frontier ? "" : ", not ready") + ")").join(", ") + ". Resolve, then ab supervise start " + input.ticket + " again."); await deliveries; return; }
 state.finished = true; await save();
 await wake("done: " + state.integrated.length + " children integrated at " + git(input.cwd, "rev-parse", "--short", "HEAD") + ". metrics " + JSON.stringify(state.metrics) + "" + (state.join?.done ? ", joined (" + (state.join.drive ? "crossing stories driven, " : "") + "consolidated)" : state.join?.skipped ? ", join skipped: " + state.join.skipped : "") + "." + carried() + await residuals(input));
 await deliveries;
}
