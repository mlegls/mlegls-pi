import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scopes } from "./scopes";

// Replays absent/uncertain/live/exited CLI sends and the review worker's ticket steer.
test("mail CLI distinguishes definitely undeliverable sends and accepts the waiting review worker's ticket", async () => {
 const root = mkdtempSync(join(tmpdir(), "mail-drive-"));
 const priorState = process.env.XDG_STATE_HOME;
 const repo = join(root, "sample");
 const state = join(root, "state");
 const data = join(root, "data");
 const env: NodeJS.ProcessEnv = { ...process.env, XDG_STATE_HOME: state, XDG_DATA_HOME: data, AB_STATE: join(root, "ab"), AB_SESSION_STATE: join(root, "session"), PI_SESSION_ID: "", PI_WM_HANDLE: "" };
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
  expect(absent.status).toBe(1);
  expect(absent.out).toContain("ticket/sample/absent-review-1");
  expect(String(absent.err)).toContain("warning: no live subscribers");
  mkdirSync(join(state, "pi-live"), { recursive: true });
  const sessionId = "00000000-0000-7000-8000-0000abcd1234";
  const record = join(state, "pi-live", process.pid + ".json");
  // Earlier sessions cannot expose subscriptions: the CLI must not imply delivery.
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", since: new Date().toISOString() }));
  const uncertain = mail("ticket/sample/absent-review-1");
  expect(uncertain.status).toBe(0);
  expect(uncertain.err).toContain("could not confirm a live subscriber");
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", boardDir: join(data, "pi-board"), since: new Date().toISOString(), subscriptions: [{ topic: ticket, wake: false }] }));
  expect(mail(ticket).status).toBe(1);
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", boardDir: join(data, "pi-board"), since: new Date().toISOString(), subscriptions: [
   { topic: "mail/abcd1234", wake: true }, ...scopes(review, {}).map(topic => ({ topic, wake: true }))
  ] }));
  for (const destination of ["mail/abcd1234", "wt/sample/feature-review-1", ticket]) {
   const result = mail(destination);
   expect(result.status).toBe(0);
   expect(result.out).toContain(destination);
   expect(result.err).toBe("");
  }
  // Replay the driver's isolation preflight: a worker in a different board store
  // must not be reported as a reader of this store even with a matching topic.
  writeFileSync(record, JSON.stringify({ pid: process.pid, sessionId, cwd: review, state: "idle", boardDir: join(root, "other-board"), since: new Date().toISOString(), subscriptions: [
   { topic: "mail/abcd1234", wake: true }, { topic: ticket, wake: true }
  ] }));
  expect(mail(ticket).status).toBe(1);
  const wrongBoard = mail("mail/abcd1234");
  expect(wrongBoard.status).toBe(1);
  expect(wrongBoard.err).toContain("warning: no live subscribers");
  expect(readFileSync(join(data, "pi-board/log.jsonl"), "utf8")).toContain('"topic":"' + ticket + '"');
  rmSync(record);
  const exited = mail("mail/abcd1234");
  expect(exited.status).toBe(1);
  expect(String(exited.err)).toContain("warning: no live subscribers");
  // Driver check 3: the review worktree really starts a turn with the ticket steer,
  // not merely a successful post or a matching live-record fixture.
  const pi = Bun.spawn(["pi", "--mode", "rpc", "--no-context-files", "--no-skills", "--no-extensions",
   "-e", resolve("lib/board/host.ts"), "-e", resolve("lib/session-meta/host.ts"),
   "--session-dir", join(root, "sessions")], {
   cwd: review, env: { ...env, PI_OFFLINE: "1", PI_BOARD_TOPIC: "", PI_WM_PARENT_SESSION: "", PI_WM_RUN: "", PI_SESSION_ID: "" },
   stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  let rpcText = "";
  const output = (async () => { for await (const chunk of pi.stdout) rpcText += Buffer.from(chunk).toString(); })();
  try {
   const live = join(state, "pi-live", pi.pid + ".json");
   let ready = false;
   for (let i = 0; i < 160; i++) {
    if (existsSync(live)) {
     const record = JSON.parse(readFileSync(live, "utf8"));
     if (record.subscriptions?.some((s: { topic: string; wake: boolean }) => s.topic === ticket && s.wake)) { ready = true; break; }
    }
    await Bun.sleep(50);
   }
   expect(ready).toBe(true);
   const result = mail(ticket);
   expect(result.err).toBe("");
   const id = result.out.trim().split(" ").at(-1)!;
   let received = false;
   for (let i = 0; i < 160; i++) {
    const reads = join(data, "pi-board/reads.jsonl");
    if (existsSync(reads) && readFileSync(reads, "utf8").split("\n").some(line => line.includes('"action":"ack"') && line.includes(id) && line.includes(review))) { received = true; break; }
    await Bun.sleep(50);
   }
   expect(received).toBe(true);
   for (let i = 0; i < 80 && !(rpcText.includes('"display":true') && rpcText.includes('owner steer') && rpcText.includes('"type":"turn_start"')); i++) await Bun.sleep(50);
   expect(rpcText).toContain('owner steer');
   expect(rpcText).toContain('"display":true');
   expect(rpcText).toContain('"type":"turn_start"');
  } finally {
   pi.kill();
   await pi.exited;
   await output;
  }
 } finally {
  if (priorState === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = priorState;
  rmSync(root, { recursive: true, force: true });
 }
}, 20_000);
