import { test, expect, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { integrate, MergeConflict, retire } from "./dispatch.ts";
import { Worker } from "./wm.ts";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "integrate-"));
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
  return { main, work, git, commit };
}

test("rebases the worker branch onto the parent and fast-forwards", async () => {
  const r = repo();
  r.commit(r.work, "a", "worker");
  r.commit(r.main, "b", "parent");
  const result = await integrate({ handle: "unit-a", run: "t", path: r.work }, { cwd: r.main, keep: true });
  expect(result).toEqual({ branch: "unit-a", mode: "rebase" });
  expect(r.git(r.main, "log", "--format=%s")).toBe("a\nb\nroot");
});

test("refuses uncommitted work and reports conflicts after aborting", async () => {
  const r = repo();
  writeFileSync(join(r.work, "dirty"), "");
  await expect(integrate({ handle: "unit-a", run: "t", path: r.work }, { cwd: r.main, keep: true })).rejects.toThrow("uncommitted");
  r.commit(r.work, "dirty", "w");
  r.commit(r.main, "dirty", "p");
  const failure = await integrate({ handle: "unit-a", run: "t", path: r.work }, { cwd: r.main, keep: true }).catch(e => e);
  expect(failure).toBeInstanceOf(MergeConflict);
  expect(failure.files).toEqual(["dirty"]);
  expect(r.git(r.work, "status", "--porcelain")).toBe("");
  expect(r.git(r.main, "log", "--format=%s")).toBe("dirty\nroot");
});

test("closes the worker only after Git integration; keep retains it", async () => {
  const r = repo();
  r.commit(r.work, "a", "worker");
  const close = spyOn(Worker.prototype, "close").mockImplementation(async function (this: Worker) {
    r.git(r.main, "merge-base", "--is-ancestor", "unit-a", "HEAD");
  });
  try {
    const worker = { handle: "unit-a", run: "t", path: r.work };
    await integrate(worker, { cwd: r.main, keep: true });
    expect(close).not.toHaveBeenCalled();
    await integrate(worker, { cwd: r.main });
    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
  } finally { close.mockRestore(); }
});

test("retiring deletes a merged worker branch once its worktree is gone; an unmerged one is kept", async () => {
  const r = repo();
  r.commit(r.work, "a", "worker");
  r.commit(r.main, "m", "parent moved, so integration rebases");
  const close = spyOn(Worker.prototype, "close").mockImplementation(async () => { r.git(r.main, "worktree", "remove", "--force", r.work); });
  try {
    const result = await integrate({ handle: "unit-a", run: "t", path: r.work }, { cwd: r.main });
    expect(result.branchDeleted).toBe("unit-a");
    expect(r.git(r.main, "branch", "--list", "unit-a")).toBe("");
    r.git(r.main, "worktree", "add", "-q", "-b", "unit-b", r.work);
    r.commit(r.work, "b", "unmerged");
    const dropped = await retire({ handle: "unit-b", run: "t", path: r.work }, { cwd: r.main });
    expect(dropped.branchKept).toStartWith("unit-b");
    expect(r.git(r.main, "branch", "--list", "unit-b")).toContain("unit-b");
  } finally { close.mockRestore(); }
});
