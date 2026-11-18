// Offline operator target for the setup-handoff gate. Real reconciler, Git and tracker;
// fake BB holds workers idle, so no model, live BB service or credentials are involved.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fakeBb } from "../thread/fake-bb";
import { start, stop } from "./main";
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
  exceptions: state()?.exceptions, threads: bb.threads().map(t => ({ title: t.title, prompt: t.prompt, tells: t.tells })) });
 const turn = (body: string) => {
  const handle = state()?.chains.solo?.handle;
  if (!handle) throw new Error("no worker ready");
  bb.completeTurn(handle.path, body);
 };
 const report = (setup: unknown) => turn("done\n\n```json\n" + JSON.stringify({ setup }) + "\n```");
 return { root, repo, bb, state, status, report, turn,
  ready: () => until(() => { const h = state()?.chains.solo?.handle; return h && bb.threads().some(t => t.environment === h.path) && h; }),
  close: async () => { if (state()) await stop(repo, "solo"); rmSync(root, { recursive: true, force: true }); } };
}
export async function prepare(skipDrive = false) {
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
  f.bb.addThread("thr_solo");
  start({ cwd: f.repo, root: "solo", owner: "thr_solo", budget: 1 });
  await f.ready();
  return f;
 } catch (error) { await f.close(); throw error; }
}

if (import.meta.main) {
 const [command = "help", target, payload] = process.argv.slice(2);
 if (command === "new") {
  const f = await prepare(target === "--no-drive");
  console.log(JSON.stringify(f.status(), null, 2));
  console.log("Ready. Retained target: " + f.root);
  console.log("Use: bun lib/reconcile/setup-fixture.ts report " + f.root + " 'null'");
  console.log("Or submit a raw report: bun lib/reconcile/setup-fixture.ts turn " + f.root + " BODY");
  console.log("Then: status " + f.root + " | report " + f.root + " '\"bun app.ts\"' | stop " + f.root);
 } else if (target && ["status", "report", "turn", "stop"].includes(command)) {
  const root = realpathSync(resolve(target));
  if (!root.startsWith("/tmp/rc-setup-")) throw new Error("expected an owned /tmp/rc-setup-* target");
  const f = open(root);
  if (command === "stop") await f.close();
  else {
   if (command === "report") f.report(JSON.parse(payload!));
   if (command === "turn") f.turn(payload!);
   if (command !== "status") console.error("Turn submitted. This snapshot can precede processing; use status ROOT to see the resulting phase or repair.");
   console.log(JSON.stringify(f.status(), null, 2));
  }
 } else console.log("new [--no-drive] | status ROOT | report ROOT SETUP_JSON | turn ROOT BODY | stop ROOT");
}
