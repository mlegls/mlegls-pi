#!/usr/bin/env bun
// Runnable first-use fixture, not a retained test suite. Owns only its mkdtemp tree.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { getTracker } from "../../../lib/tracker.ts";
import { excludeTracker, assertNoTrackerChanges } from "../../../lib/thread/tracker-worktree.ts";
import { git } from "../../../lib/thread/git.ts";

delete process.env.TRACKER_CLI;
delete process.env.TRACKER_NO_INFLIGHT;
process.env.PI_SESSION_ID = "scratch-vault";
const checkout = resolve(import.meta.dir, "../../..");
const cli = join(checkout, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const fixture = mkdtempSync(join(tmpdir(), "vault-first-use-"));
const main = join(fixture, "main");
const worker = join(fixture, "worker");
const bad = join(fixture, "forbidden");
function observe(claim: string, value: unknown) { console.log(claim + ": " + JSON.stringify(value)); }
function run(cwd: string, args: string[], input?: string) {
  const p = spawnSync("bun", [cli, ...args], { cwd, input, encoding: "utf8", env: process.env });
  if (p.status !== 0) throw new Error(p.stderr || "CLI failed");
  return p.stdout;
}
function rejected(cwd: string, args: string[], input?: string) {
  const p = spawnSync("bun", [cli, ...args], { cwd, input, encoding: "utf8", env: process.env });
  if (p.status === 0) throw new Error("expected a rejected write");
  return p.stderr.trim();
}
try {
  mkdirSync(join(main, "docs/issues"), { recursive: true });
  mkdirSync(join(main, "docs/attachments"), { recursive: true });
  writeFileSync(join(main, "docs/attachments/seed.txt"), "Code evidence stays checked out.\n");
  writeFileSync(join(main, "docs/issues/seed.md"), "---\nstage: ticket\nassignee: agent\nauthor: session:scratch\nclaimed-by: session:scratch\nextra: retained\n---\nSeed contract.\n");
  git(main, "init", "-q", "-b", "main");
  git(main, "config", "user.name", "Vault fixture");
  git(main, "config", "user.email", "vault-fixture@example.invalid");
  git(main, "add", ".");
  git(main, "commit", "-qm", "seed canonical vault");
  mkdirSync(join(fixture, "vault/projects"), { recursive: true });
  symlinkSync(join(main, "docs"), join(fixture, "vault/projects/fixture"));
  process.env.TRACKER_VAULT = join(fixture, "vault");
  symlinkSync(join(main, "docs/issues"), join(fixture, "issue-symlink"));
  git(main, "worktree", "add", "--no-checkout", "-b", "scratch-worker", worker);
  excludeTracker(worker);
  const head = git(worker, "rev-parse", "HEAD");
  observe("sparse preparation", {
    trackerAbsent: !existsSync(join(worker, "docs/issues")),
    attachmentsPresent: existsSync(join(worker, "docs/attachments/seed.txt")),
    noTrackedDeletions: git(worker, "diff", "--name-only") === "",
  });
  // A shell fixture worker runs the bundled CLI, without models or credentials.
  const shell = spawnSync("bash", ["-c", 'cd "$1" && bun "$2" snapshot --json', "fixture-worker", worker, cli], { encoding: "utf8", env: process.env });
  if (shell.status !== 0) throw new Error(shell.stderr);
  observe("shell worker canonical read", JSON.parse(shell.stdout).issues.map((i: any) => i.slug));
  const tracker = getTracker(worker, { inflight: false });
  observe("library lifecycle read", tracker.snapshot().get("seed"));
  observe("subdirectory read", JSON.parse(run(join(worker, "docs/attachments"), ["fields", "seed"])));
  observe("issue symlink read", JSON.parse(run(join(fixture, "issue-symlink"), ["fields", "seed"])));
  writeFileSync(join(main, "sentinel.txt"), "Another session's staged work.\n");
  git(main, "add", "sentinel.txt");
  run(worker, ["create", "child", "--fields", JSON.stringify({
    stage: "ticket", assignee: "agent", "part-of": "seed", "blocked-by": ["approval: maintainer"], extra: { nested: true },
  }), "--body-file", "-"], "Child contract.\n");
  observe("created normalized fields", tracker.fields("child"));
  observe("stored vault relations", readFileSync(join(main, "docs/issues/child.md"), "utf8"));
  tracker.update("seed", { priority: 1, extra: null });
  observe("metadata merge preserved body", tracker.text("seed"));
  writeFileSync(join(worker, "body.md"), "Replacement contract from the calling worktree.\n");
  run(worker, ["update", "child", "--body-file", "body.md"]);
  tracker.update("child", {}, "");
  observe("empty body replacement", tracker.text("child").endsWith("---\n"));
  tracker.update("child", {}, "Final child contract.\n");
  observe("uncached snapshot without code HEAD change", {
    sameHead: head === git(worker, "rev-parse", "HEAD"),
    priority: tracker.snapshot().get("seed")?.priority,
  });
  const before = tracker.text("child");
  const commitBefore = git(main, "rev-parse", "HEAD");
  observe("invalid candidate refused", rejected(worker, ["update", "child", "--fields", '{"blocked-by":["child"]}']));
  observe("invalid write unchanged", { text: tracker.text("child") === before, head: git(main, "rev-parse", "HEAD") === commitBefore });
  observe("immutable provenance", rejected(worker, ["update", "child", "--fields", '{"author":"session:other"}']));
  observe("slug traversal", rejected(worker, ["create", "../escape", "--fields", '{"stage":"idea"}', "--body-file", "-"], "No.\n"));
  // Drop parent link so closing seed can complete independently of the still-open child.
  tracker.update("child", { "part-of": null, "blocked-by": ["seed", "approval: maintainer"] });
  writeFileSync(join(worker, "docs/attachments/result.md"), "Only on the owner's code branch, not canonical yet.\n");
  tracker.close("seed", { summary: "Seed delivered.", evidence: "docs/attachments/result.md" });
  const closed = tracker.text("seed");
  const closedHead = git(main, "rev-parse", "HEAD");
  tracker.close("seed", { summary: "Seed delivered.", evidence: "docs/attachments/result.md" });
  observe("close replay and resolved blockers", {
    sameText: tracker.text("seed") === closed,
    sameHead: git(main, "rev-parse", "HEAD") === closedHead,
    stage: tracker.fields("seed").stage,
    claimAbsent: !("claimed-by" in tracker.fields("seed")),
    blockers: tracker.fields("child")["blocked-by"],
    evidenceNotCopied: !existsSync(join(main, "docs/attachments/result.md")),
  });
  tracker.create({ slug: "provisional", fields: { stage: "idea", "claimed-by": "reconcile:scratch/refine-fixture" }, body: "Provisional child.\n" });
  tracker.remove("provisional");
  observe("provisional removed", !tracker.snapshot().has("provisional"));
  observe("staged sentinel isolated", {
    staged: git(main, "diff", "--cached", "--name-only"),
    neverCommitted: git(main, "log", "--format=%s", "--", "sentinel.txt") === "",
  });
  git(worker, "add", "docs/attachments/result.md");
  git(worker, "commit", "-qm", "code evidence only");
  assertNoTrackerChanges(worker, "main");
  observe("code evidence accepted", true);
  git(main, "worktree", "add", "-b", "forbidden-worker", bad);
  writeFileSync(join(bad, "docs/issues/seed.md"), readFileSync(join(bad, "docs/issues/seed.md"), "utf8") + "Forbidden edit.\n");
  writeFileSync(join(bad, "docs/issues/hidden.txt"), "Non-Markdown tracker mutation.\n");
  rmSync(join(bad, "docs/issues/child.md"));
  git(bad, "add", "docs/issues");
  git(bad, "commit", "-qm", "deliberately forbidden tracker edits");
  const destinationBefore = git(main, "status", "--porcelain") + git(main, "rev-parse", "HEAD");
  try { assertNoTrackerChanges(bad, "main"); throw new Error("forbidden branch was accepted"); }
  catch (error) {
    if (!String(error).includes("Forbidden tracker changes:")) throw error;
    observe("landing refused before integration", String(error));
  }
  observe("destination untouched", destinationBefore === git(main, "status", "--porcelain") + git(main, "rev-parse", "HEAD"));
  observe("rehearsal complete", "ready for independent replay");
} finally {
  for (const path of [worker, bad]) if (existsSync(path)) {
    try { git(main, "worktree", "remove", "--force", path); } catch {}
  }
  rmSync(fixture, { recursive: true, force: true });
  observe("cleanup", "removed only fixture " + fixture);
}
