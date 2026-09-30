import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scopes } from "./scopes";

// Replays the driver's absent/live/exited CLI sends and its reviewer-ticket steer.
test("mail CLI warns on undeliverable topics and accepts the waiting review worker's ticket", () => {
 const root = mkdtempSync(join(tmpdir(), "mail-drive-"));
 const priorState = process.env.XDG_STATE_HOME;
 const repo = join(root, "sample");
 const state = join(root, "state");
 const data = join(root, "data");
 const env = { ...process.env, XDG_STATE_HOME: state, XDG_DATA_HOME: data, AB_STATE: join(root, "ab"), AB_SESSION_STATE: join(root, "session"), PI_SESSION_ID: "", PI_WM_HANDLE: "" };
 delete env.PI_BOARD_DIR;
 const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
 const mail = (destination: string) => {
  const p = Bun.spawnSync([process.execPath, resolve("ab/main.ts"), "mail", destination, "owner steer"], { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
  return { status: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
 };
 try {
  mkdirSync(join(repo, "docs/issues"), { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.invalid");
  git(repo, "config", "user.name", "test");
  writeFileSync(join(repo, "docs/issues/feature.md"), "---\nstage: ticket\n---\n");
  git(repo, "add", "."); git(repo, "commit", "-qm", "seed");
  const review = join(root, "sample__worktrees", "feature-review-1");
  git(repo, "worktree", "add", "-qb", "feature-review-1", review);
  process.env.XDG_STATE_HOME = state;
  const ticket = "ticket/sample/feature";
  expect(scopes(review, {}).includes(ticket)).toBe(true);
  // Check the same tracker topic survives every phase's distinct branch name.
  for (const phase of ["drive", "consolidate"]) {
   const branch = `feature-${phase}-1`;
   const worktree = join(root, "sample__worktrees", branch);
   git(repo, "worktree", "add", "-qb", branch, worktree);
   expect(scopes(worktree, {}).includes(ticket)).toBe(true);
  }
  const absent = mail("ticket/sample/absent-review-1");
  expect(absent.status).toBe(0);
  expect(absent.out).toContain("ticket/sample/absent-review-1");
  expect(String(absent.err)).toContain("warning: no live subscribers");
  mkdirSync(join(state, "pi-live"), { recursive: true });
  const sessionId = "00000000-0000-7000-8000-0000abcd1234";
  const record = join(state, "pi-live", process.pid + ".json");
  // Earlier sessions cannot expose subscriptions: the CLI must not imply delivery.
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", since: new Date().toISOString() }));
  expect(mail("ticket/sample/absent-review-1").err).toContain("could not confirm a live subscriber");
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", since: new Date().toISOString(), subscriptions: [{ topic: ticket, wake: false }] }));
  expect(String(mail(ticket).err)).toContain("warning: no live subscribers");
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", since: new Date().toISOString(), subscriptions: [
   { topic: "mail/abcd1234", wake: true }, ...scopes(review, {}).map(topic => ({ topic, wake: true }))
  ] }));
  for (const destination of ["mail/abcd1234", "wt/sample/feature-review-1", ticket]) {
   const result = mail(destination);
   expect(result.status).toBe(0);
   expect(result.out).toContain(destination);
   expect(result.err).toBe("");
  }
  expect(readFileSync(join(data, "pi-board/log.jsonl"), "utf8")).toContain('"topic":"' + ticket + '"');
  rmSync(record);
  expect(String(mail("mail/abcd1234").err)).toContain("warning: no live subscribers");
 } finally {
  if (priorState === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = priorState;
  rmSync(root, { recursive: true, force: true });
 }
});
