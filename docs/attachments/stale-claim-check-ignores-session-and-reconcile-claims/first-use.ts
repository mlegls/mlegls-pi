import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Seed disposable tracker state, then open the same check and tree views as a maintainer.
const cli = resolve(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const scratch = mkdtempSync(join(tmpdir(), "tracker-claims-"));
const repo = join(scratch, "repo");
const linked = join(scratch, "linked");
const issues = join(repo, "docs", "issues");
const runs = join(repo, ".git", "reconcile");
const bb = join(scratch, "bb");
const sessions = join(bb, "sessions");
const env = { ...process.env, BB_DATA_DIR: bb, BB_PI_BRIDGE_SESSION_DIR: sessions, XDG_STATE_HOME: join(scratch, "state") };
const git = (...args: string[]) => {
  const p = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", ...args]);
  if (p.exitCode !== 0) throw new Error(p.stderr.toString());
};
const issue = (slug: string, claim: string) => writeFileSync(join(issues, slug + ".md"), `---\nstage: ticket\nassignee: agent\nauthor: session:fixture\nclaimed-by: ${claim}\n---\n`);
const run = (root: string, state: object) => writeFileSync(join(runs, root + ".json"), JSON.stringify({ root, ...state }));
const view = (verb: string, override = {}) => {
  console.log(`\n$ issues ${verb}`);
  const p = Bun.spawnSync([process.execPath, cli, ...verb.split(" ")], { cwd: linked, env: { ...env, ...override } });
  process.stdout.write(p.stdout);
  process.stderr.write(p.stderr);
  console.log(`exit ${p.exitCode}`);
};
try {
  mkdirSync(issues, { recursive: true });
  mkdirSync(sessions, { recursive: true });
  git("init", "--quiet");
  mkdirSync(runs);
  issue("run-ended", "reconcile:ended/refine-1");
  issue("run-gone", "reconcile:gone");
  issue("run-active", "reconcile:active");
  issue("session-by-run", "session:owner");
  issue("session-by-worktree", "session:task-owner");
  issue("session-by-bb", "session:parked-pi-session");
  issue("session-stranded", "session:stranded");
  run("ended", { pid: process.pid, finished: "done", ownerSession: "stranded" });
  run("gone", { pid: 2147483647 });
  run("active", { pid: process.pid, ownerSession: "owner" });
  git("add", "docs/issues");
  git("commit", "--quiet", "-m", "Seed tracker");
  git("worktree", "add", "--quiet", "-b", "session-by-worktree", linked);

  const db = new Database(join(bb, "bb.db"));
  db.exec(`create table threads (id text, parent_thread_id text, title text, title_fallback text, provider_id text, archived_at integer, deleted_at integer);
    create table events (thread_id text, provider_thread_id text, created_at integer, type text);
    insert into threads (id, provider_id) values ('thr_parked', 'pi');
    insert into events values ('thr_parked', 'pi_fixture', 1, 'thread/identity');`);
  db.close();
  writeFileSync(join(sessions, "pi_fixture.jsonl"), JSON.stringify({ type: "session", id: "parked-pi-session" }) + "\n");

  view("tree");
  view("check");
  view("frontier session-stranded");
  console.log("\nWithout access to the BB store:");
  view("tree session-stranded", { BB_DATA_DIR: join(scratch, "unavailable") });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
