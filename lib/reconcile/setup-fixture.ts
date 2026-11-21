// Offline operator target for worker handoff gates. Real reconciler, Git and tracker;
// fake BB holds workers idle, so no model, live BB service or credentials are involved.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fakeBb } from "../thread/fake-bb";
import { getTracker } from "../tracker.ts";
import { resolveException, start, stop } from "./main";
import { load } from "./reconcile";

const packagePath = realpathSync(join(import.meta.dir, "../.."));
export async function until<T>(read: () => T | undefined | false): Promise<T> {
 for (let i = 0; i < 400; i++) { const value = read(); if (value) return value; await Bun.sleep(100); }
 throw new Error("fixture readiness timed out");
}
export function open(root: string) {
 for (const key of Object.keys(process.env))
  if (/^(?:PI_.*|BB_.*|AB_.*|FAKE_BB_.*|TMUX.*|WORKER_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
 Object.assign(process.env, {
  XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
  PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"),
  MISE_TRUSTED_CONFIG_PATHS: root, PI_RECONCILE_TICK_MS: "100",
  TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
 });
 const bb = fakeBb(root), repo = join(root, "repo");
 const state = () => load(repo, "solo");
 const status = () => ({ root, phase: state()?.chains.solo?.phase, retries: state()?.chains.solo?.retries,
  owner: state()?.owner, finished: state()?.finished, postLanding: state()?.results.solo?.postLanding,
  exceptions: state()?.exceptions,
  landed: state()?.landed.solo, log: state()?.log, threads: bb.threads().map(t => ({ title: t.title, prompt: t.prompt, tells: t.tells })) });
 const turn = (body: string, compactAfter = false) => {
  const handle = state()?.chains.solo?.handle;
  if (!handle) throw new Error("no worker ready");
  bb.completeTurn(handle.path, body, "completed", compactAfter);
 };
 const report = (setup: unknown) => turn("done\n\n```json\n" + JSON.stringify({ setup }) + "\n```");
 return { root, repo, bb, state, status, report, turn,
  ready: (phase?: string) => until(() => {
   const chain = state()?.chains.solo, h = chain?.handle;
   return h && (!phase || chain?.phase === phase) && bb.threads().some(t => t.environment === h.path) && h;
  }),
  close: async () => { if (state()) await stop(repo, "solo"); rmSync(root, { recursive: true, force: true }); } };
}
export async function prepare(skipDrive = false, postLanding = false) {
 const root = realpathSync(mkdtempSync("/tmp/rc-setup-")), f = open(root);
 const git = (...args: string[]) => execFileSync("git", ["-C", f.repo, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
 try {
  for (const dir of [f.repo, join(root, "agents/roles"), join(f.repo, "docs/issues")]) mkdirSync(dir, { recursive: true });
  for (const role of ["implement", "drive", "review"]) {
   writeFileSync(join(root, "agents", role + "r.md"), "---\nrole: " + role + "\n---\nOffline shell worker.\n");
   writeFileSync(join(root, "agents/roles", role + ".md"), "Offline shell worker.\n");
  }
  git("init", "-qb", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(f.repo, "docs/issues/solo.md"), "---\nstage: ticket\nassignee: agent:implementr\n" + (skipDrive ? "drive: none\n" : "") + "---\n\nSetup gate fixture.\n");
  git("add", "."); git("commit", "-qm", "fixture");
  if (postLanding) getTracker(f.repo).update("solo", { "post-landing": [
   { id: "deploy", story: "Main deploy serves the candidate.", trigger: "target-deploy", check: "Find the deploy triggered by the target update; GET /ready returns 200 for that deployment." },
   { id: "smoke", story: "Main deploy serves the candidate.", trigger: "target-deploy", check: "Open that deployment's /about and verify the candidate version." },
  ] }, "The run owner checks the target-triggered deployment after landing.\n");
  f.bb.addThread("thr_solo");
  start({ cwd: f.repo, root: "solo", owner: "thr_solo", budget: 1 });
  await f.ready();
  return f;
 } catch (error) { await f.close(); throw error; }
}

if (import.meta.main) {
 const [command = "help", target, payload, option] = process.argv.slice(2);
 if (command === "new") {
  const review = target === "--review" || target === "--post-landing", f = await prepare(review || target === "--no-drive", target === "--post-landing");
  if (review) {
   try {
    f.report(null);
    const { path } = await f.ready("review");
    mkdirSync(join(path, "docs/attachments"), { recursive: true });
    writeFileSync(join(path, "docs/attachments/review.md"), "# Rehearsal\n\nFixture evidence for a simulated reviewer handoff.\n");
    execFileSync("git", ["add", "docs/attachments/review.md"], { cwd: path });
    execFileSync("git", ["commit", "-qm", "review packet"], { cwd: path });
   } catch (error) { await f.close(); throw error; }
  }
  console.log(JSON.stringify(f.status(), null, 2));
  console.log("Ready. Retained target: " + f.root);
  if (!review) console.log("Use: bun lib/reconcile/setup-fixture.ts report " + f.root + " 'null'");
  console.log("Or submit a raw report: bun lib/reconcile/setup-fixture.ts turn " + f.root + " BODY [--compact-after]");
  console.log("Then: status " + f.root + " | issue " + f.root + " | stop " + f.root);
 } else if (target && ["status", "issue", "report", "turn", "verdict", "stop"].includes(command)) {
  const root = realpathSync(resolve(target));
  if (!root.startsWith("/tmp/rc-setup-")) throw new Error("expected an owned /tmp/rc-setup-* target");
  const f = open(root);
  if (command === "stop") await f.close();
  else if (command === "issue") console.log(getTracker(f.repo).text("solo"));
  else if (command === "verdict") resolveException(f.repo, "solo", "solo", { ...JSON.parse(payload!), action: "post-landing" }, "thr_solo");
  else {
   if (command === "report") f.report(JSON.parse(payload!));
   if (command === "turn") f.turn(payload!, option === "--compact-after");
   if (command !== "status") console.error("Turn submitted. This snapshot can precede processing; use status ROOT to see the resulting phase or repair.");
   console.log(JSON.stringify(f.status(), null, 2));
  }
 } else console.log("new [--no-drive|--review|--post-landing] | status ROOT | issue ROOT | report ROOT SETUP_JSON | turn ROOT BODY [--compact-after] | verdict ROOT VERDICT_JSON | stop ROOT");
}
