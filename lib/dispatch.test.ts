import { test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { integrate, MergeConflict, retire } from "./dispatch.ts";
import { Worker } from "./wm.ts";
import { randomUUID } from "node:crypto";
import { saveThread, type ThreadRecord } from "./thread";
import type { Handle } from "./dispatch";

let state: string, oldState: string | undefined;
const roots: string[] = [];
beforeEach(() => { oldState = process.env.XDG_STATE_HOME; state = mkdtempSync(join(tmpdir(), "dispatch-state-")); process.env.XDG_STATE_HOME = state; });
afterEach(() => {
  if (oldState === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldState;
  for (const root of [...roots.splice(0), state]) rmSync(root, { recursive: true, force: true });
});

async function repo() {
  const root = mkdtempSync(join(tmpdir(), "integrate-"));
  roots.push(root);
  const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" }).toString().trim();
  const main = join(root, "main");
  git(root, "init", "-q", "-b", "main", main);
  git(main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root");
  const work = join(root, "work");
  git(main, "worktree", "add", "-q", "-b", "unit-a", work);
  const commit = (dir: string, file: string, text: string) => {
    writeFileSync(join(dir, file), text);
    git(dir, "add", file);
    git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", file);
  };
  const register = async (handle = "unit-a"): Promise<Handle> => {
    const id = randomUUID();
    git(main, "config", "branch." + handle + ".ab-parent", "main");
    const thread: ThreadRecord = { id, sessionId: id, sessionFile: join(root, id + ".jsonl"), cwd: work, project: main, worktree: work, ownership: "owner", branch: handle, worker: { run: "t", handle }, archived: false, created: new Date().toISOString() };
    await saveThread(thread);
    return { handle, run: "t", path: work, threadId: id };
  };
  return { main, work, git, commit, register, worker: await register() };
}

test("rebases the worker branch onto the parent and fast-forwards", async () => {
  const r = await repo();
  r.commit(r.work, "a", "worker");
  r.commit(r.main, "b", "parent");
  const result = await integrate(r.worker, { cwd: r.main, keep: true });
  expect(result).toEqual({ branch: "unit-a", mode: "rebase" });
  expect(r.git(r.main, "log", "--format=%s")).toBe("a\nb\nroot");
});

// Ticket contract: integration destination is the branch's recorded ab-parent, never the caller's HEAD.
test("integrates into the recorded ab-parent even when called from another checkout", async () => {
  const r = await repo();
  const other = join(r.main, "..", "other");
  r.git(r.main, "worktree", "add", "-q", "-b", "other", other);
  r.commit(r.work, "a", "worker");
  await integrate(r.worker, { cwd: other, keep: true });
  expect(r.git(r.main, "log", "--format=%s")).toBe("a\nroot");
  expect(r.git(other, "log", "--format=%s")).toBe("root");
});

test("refuses uncommitted work and reports conflicts after aborting", async () => {
  const r = await repo();
  writeFileSync(join(r.work, "dirty"), "");
  await expect(integrate(r.worker, { cwd: r.main, keep: true })).rejects.toThrow("uncommitted");
  r.commit(r.work, "dirty", "w");
  r.commit(r.main, "dirty", "p");
  const failure = await integrate(r.worker, { cwd: r.main, keep: true }).catch(e => e);
  expect(failure).toBeInstanceOf(MergeConflict);
  expect(failure.files).toEqual(["dirty"]);
  expect(r.git(r.work, "status", "--porcelain")).toBe("");
  expect(r.git(r.main, "log", "--format=%s")).toBe("dirty\nroot");
});

test("closes the worker only after Git integration; keep retains it", async () => {
  const r = await repo();
  r.commit(r.work, "a", "worker");
  const close = spyOn(Worker.prototype, "close").mockImplementation(async function (this: Worker) {
    r.git(r.main, "merge-base", "--is-ancestor", "unit-a", "HEAD");
    return { closed: [], killed: [], branchesDeleted: [], branchesKept: [] };
  });
  try {
    const worker = r.worker;
    await integrate(worker, { cwd: r.main, keep: true });
    expect(close).not.toHaveBeenCalled();
    await integrate(worker, { cwd: r.main });
    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
  } finally { close.mockRestore(); }
});

test("retiring deletes a merged worker branch once its worktree is gone; an unmerged one is kept", async () => {
  const r = await repo();
  r.commit(r.work, "a", "worker");
  r.commit(r.main, "m", "parent moved, so integration rebases");
  const close = spyOn(Worker.prototype, "close").mockImplementation(async () => { r.git(r.main, "worktree", "remove", "--force", r.work); return { closed: [], killed: [], branchesDeleted: [], branchesKept: [] }; });
  try {
    const result = await integrate(r.worker, { cwd: r.main });
    expect(result.branchDeleted).toBe("unit-a");
    expect(r.git(r.main, "branch", "--list", "unit-a")).toBe("");
    r.git(r.main, "worktree", "add", "-q", "-b", "unit-b", r.work);
    r.commit(r.work, "b", "unmerged");
    const dropped = await retire(await r.register("unit-b"), { cwd: r.main });
    expect(dropped.branchKept).toStartWith("unit-b");
    expect(r.git(r.main, "branch", "--list", "unit-b")).toContain("unit-b");
  } finally { close.mockRestore(); }
});
