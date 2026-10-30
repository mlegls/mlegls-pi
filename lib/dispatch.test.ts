import { test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { integrate, MergeConflict, retire, stop } from "./dispatch.ts";
import { Worker } from "./wm.ts";
import { fakeBb } from "./thread/fake-bb";
import type { Handle } from "./dispatch";

let state: string, oldState: string | undefined, saved: NodeJS.ProcessEnv;
const roots: string[] = [];
beforeEach(() => { saved = { ...process.env }; oldState = process.env.XDG_STATE_HOME; state = mkdtempSync(join(tmpdir(), "dispatch-state-")); process.env.XDG_STATE_HOME = state; });
afterEach(() => {
  process.env = saved;
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
  const bb = fakeBb(root);
  const work = join(root, "work");
  git(main, "worktree", "add", "-q", "-b", "unit-a", work);
  const commit = (dir: string, file: string, text: string) => {
    writeFileSync(join(dir, file), text);
    git(dir, "add", file);
    git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", file);
  };
  const register = async (handle = "unit-a"): Promise<Handle> => {
    const id = "bbt-" + handle;
    git(main, "config", "branch." + handle + ".ab-parent", "main");
    bb.addThread(id, work, "t/" + handle);
    return { handle, run: "t", path: work, bb: id };
  };
  return { main, work, git, commit, register, worker: await register() };
}

test("rebases the worker branch onto the parent and fast-forwards", async () => {
  const r = await repo();
  r.commit(r.work, "a", "worker");
  r.commit(r.main, "b", "parent");
  const result = await integrate(r.worker, { cwd: r.main, keep: true });
  expect(result).toMatchObject({ branch: "unit-a", mode: "rebase" });
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

test("refuses authored tracker changes before mutation and after preparation", async () => {
  const r = await repo();
  const issue = "docs/issues/x.md";
  mkdirSync(join(r.main, "docs/issues"), { recursive: true });
  r.commit(r.main, issue, "---\nstage: idea\n---\n\nBody.\n");
  r.git(r.work, "reset", "-q", "--hard", "main");
  r.commit(r.work, issue, "---\nstage: idea\n---\n\nBody.\n\nWorker saw it.\n");
  r.commit(r.main, issue, "---\nstage: idea\n---\n\nBody.\n\nGlobal ruling.\n");
  const target = r.git(r.main, "rev-parse", "HEAD"), worker = r.git(r.work, "rev-parse", "HEAD");
  const close = spyOn(Worker.prototype, "close");
  try {
    await expect(integrate(r.worker, { cwd: r.main })).rejects.toThrow("Forbidden tracker changes: " + issue);
    expect(r.git(r.main, "rev-parse", "HEAD")).toBe(target);
    expect(r.git(r.work, "rev-parse", "HEAD")).toBe(worker);
    expect(close).not.toHaveBeenCalled();
    r.git(r.work, "reset", "-q", "--hard", "main");
    r.commit(r.work, "code", "permitted");
    await expect(integrate(r.worker, { cwd: r.main, prepare: async h => {
      r.commit(h.path, issue, "---\nstage: idea\n---\n\nForbidden preparation.\n");
    } })).rejects.toThrow("Forbidden tracker changes: " + issue);
    expect(r.git(r.main, "rev-parse", "HEAD")).toBe(target);
    expect(r.git(r.work, "status", "--porcelain")).toBe("");
    expect(close).not.toHaveBeenCalled();
  } finally { close.mockRestore(); }
});

// 2026-10-18 (concept): a join's implementer merged main into its collector-based branch; main's own tracker commits
// came along and are canonical persistence, not the branch's changes.
test("tracker paths carried in by merging main are not the branch's changes", async () => {
  const r = await repo();
  const issue = "docs/issues/x.md";
  r.commit(r.work, "a", "worker");
  mkdirSync(join(r.main, "docs/issues"), { recursive: true });
  r.commit(r.main, issue, "---\nstage: idea\n---\n\nBody.\n");
  const other = join(r.main, "..", "parent");
  r.git(r.main, "worktree", "add", "-q", "-b", "parent", other, "main~1");
  r.git(r.main, "config", "branch.unit-a.ab-parent", "parent");
  r.git(r.work, "-c", "user.name=t", "-c", "user.email=t@t", "merge", "-q", "--no-edit", "main");
  await integrate(r.worker, { cwd: r.main, keep: true });
  expect(r.git(other, "rev-parse", "HEAD")).toBe(r.git(r.work, "rev-parse", "HEAD"));
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

// 2026-10-30 (concept, link-charted-missions-to-the-copy-they-chart): a review worker's bb thread disappeared, and every
// relaunch and reconcile_stop failed on "No live worker".
test("stopping or retiring a worker whose bb thread is gone is a no-op that leaves its worktree and ignored state", async () => {
  const r = await repo();
  r.commit(r.work, "a", "reviewed");
  writeFileSync(join(r.work, ".local-deployment"), "local state");
  const gone = { ...r.worker, bb: "bbt-archived" };
  expect(await stop(gone, { cwd: r.main })).toEqual({ closed: [], killed: [], branchesDeleted: [], branchesKept: [] });
  expect(await retire(gone, { cwd: r.main })).toEqual({ killed: [], gone: { worktree: r.work } });
  expect(readFileSync(join(r.work, ".local-deployment"), "utf8")).toBe("local state");
  expect(r.git(r.work, "log", "-1", "--format=%s")).toBe("a");
  await expect(integrate(gone, { cwd: r.main })).rejects.toThrow("No live worker");
});

test("a tracker-only commit landing on the parent during preparation is merged in, and the fast-forward lands", async () => {
  const r = await repo();
  r.commit(r.work, "a", "worker");
  mkdirSync(join(r.main, "docs/issues"), { recursive: true });
  const result = await integrate(r.worker, { cwd: r.main, keep: true, prepare: async () => { r.commit(r.main, "docs/issues/x.md", "tracker"); } });
  expect(result.output).toContain("merged tracker-only commits");
  expect(r.git(r.main, "show", "HEAD:a")).toBe("worker");
  expect(r.git(r.main, "show", "HEAD:docs/issues/x.md")).toBe("tracker");
});

test("a code commit landing on the parent during preparation still refuses the fast-forward", async () => {
  const r = await repo();
  r.commit(r.work, "a", "worker");
  const before = r.git(r.work, "rev-parse", "HEAD");
  await expect(integrate(r.worker, { cwd: r.main, keep: true, prepare: async () => { r.commit(r.main, "b", "code"); } }))
    .rejects.toThrow("beyond docs/issues/");
  expect(r.git(r.work, "rev-parse", "HEAD")).toBe(before);
});
