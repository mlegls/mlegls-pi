import { test, expect, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { integrate, MergeConflict, retire } from "./dispatch.ts";
import * as paseo from "./paseo.ts";

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
  const result = await integrate({ backend: "wm" as const, path: r.work }, { cwd: r.main, keep: true });
  expect(result).toEqual({ branch: "unit-a", mode: "rebase" });
  expect(r.git(r.main, "log", "--format=%s")).toBe("a\nb\nroot");
});

test("refuses uncommitted work and reports conflicts after aborting", async () => {
  const r = repo();
  writeFileSync(join(r.work, "dirty"), "");
  await expect(integrate({ backend: "wm" as const, path: r.work }, { cwd: r.main, keep: true })).rejects.toThrow("uncommitted");
  r.commit(r.work, "dirty", "w");
  r.commit(r.main, "dirty", "p");
  const failure = await integrate({ backend: "wm" as const, path: r.work }, { cwd: r.main, keep: true }).catch(e => e);
  expect(failure).toBeInstanceOf(MergeConflict);
  expect(failure.files).toEqual(["dirty"]);
  expect(r.git(r.work, "status", "--porcelain")).toBe("");
  expect(r.git(r.main, "log", "--format=%s")).toBe("dirty\nroot");
});

test("Paseo archives only after Git integration; keep retains workspace", async () => {
  const r = repo();
  r.commit(r.work, "a", "worker");
  const archived = {workspaceId: "ws-exact", requestId: "archive-1", archivedAt: "2026-09-22", error: null};
  const archive = spyOn(paseo, "archive").mockImplementation(async () => {
    r.git(r.main, "merge-base", "--is-ancestor", "unit-a", "HEAD");
    return archived;
  });
  try {
    const worker = { backend: "paseo" as const, workspaceId: "ws-exact", path: r.work };
    await integrate(worker, { cwd: r.main, keep: true });
    expect(archive).not.toHaveBeenCalled();
    const result = await integrate(worker, { cwd: r.main });
    expect(result.removed).toEqual(archived);
    expect(archive).toHaveBeenCalledTimes(1);
    expect(archive).toHaveBeenCalledWith("ws-exact");
    archive.mockRejectedValueOnce(new Error("workspace busy"));
    await expect(integrate(worker, { cwd: r.main })).rejects.toThrow("workspace busy");
    r.git(r.main, "merge-base", "--is-ancestor", "unit-a", "HEAD");
  } finally { archive.mockRestore(); }
});

test("retiring deletes a merged worker branch once its worktree is gone; an unmerged one is kept", async () => {
  const r = repo();
  r.commit(r.work, "a", "worker");
  r.commit(r.main, "m", "parent moved, so integration rebases");
  const archive = spyOn(paseo, "archive").mockImplementation(async id => {
    r.git(r.main, "worktree", "remove", r.work);
    return {workspaceId: id, requestId: "x", archivedAt: "now", error: null};
  });
  try {
    const result = await integrate({ backend: "paseo", workspaceId: "ws", path: r.work }, { cwd: r.main });
    expect(result.branchDeleted).toBe("unit-a");
    expect(r.git(r.main, "branch", "--list", "unit-a")).toBe("");
    r.git(r.main, "worktree", "add", "-q", "-b", "unit-b", r.work);
    r.commit(r.work, "b", "unmerged");
    const dropped = await retire({ backend: "paseo", workspaceId: "ws", path: r.work }, { cwd: r.main });
    expect(dropped.branchKept).toStartWith("unit-b");
    expect(r.git(r.main, "branch", "--list", "unit-b")).toContain("unit-b");
  } finally { archive.mockRestore(); }
});
