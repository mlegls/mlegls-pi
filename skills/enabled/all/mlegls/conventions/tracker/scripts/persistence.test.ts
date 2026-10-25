import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Tracker writes reach a canonical checkout whose commit hooks take seconds, from callers whose
// tool timeouts SIGKILL their whole process group. A killed caller must not strand .git/index.lock,
// a stale lock nobody holds must not block every later write, and a live one must never be taken.
// The script beside this file, never a pinned TRACKER_CLI: workers inherit a pin of their base, which would test the old CLI.
const cli = join(import.meta.dir, "issues.ts");

function repo(hookSeconds = 0) {
  const root = mkdtempSync(join(tmpdir(), "tracker-persist-"));
  const vault = mkdtempSync(join(tmpdir(), "vault-"));
  mkdirSync(join(root, "docs/issues"), { recursive: true });
  for (const slug of ["a", "b"]) writeFileSync(join(root, "docs/issues", slug + ".md"), "---\nstage: idea\n---\n");
  const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root }).stdout.toString().trim();
  git("init", "-q"); git("config", "user.name", "t"); git("config", "user.email", "t@t");
  git("add", "."); git("commit", "-qm", "init");
  if (hookSeconds) {
    writeFileSync(join(root, ".git/hooks/pre-commit"), "#!/bin/sh\ntouch \"$(git rev-parse --git-common-dir)/hook-started\"\nsleep " + hookSeconds + "\n");
    chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
  }
  const env = { ...process.env, TRACKER_VAULT: vault };
  const update = (slug: string, fields: object) => Bun.spawnSync([process.execPath, cli, "update", slug, "--fields", JSON.stringify(fields)], { cwd: root, env });
  const updateAsync = (slug: string, fields: object) => {
    const p = Bun.spawn([process.execPath, cli, "update", slug, "--fields", JSON.stringify(fields)], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
    return p.exited.then(async code => ({ code, err: await new Response(p.stderr).text() }));
  };
  const committed = (slug: string) => git("show", "HEAD:docs/issues/" + slug + ".md");
  const lock = join(root, ".git/index.lock");
  return { root, env, git, update, updateAsync, committed, lock, done: () => { rmSync(root, { recursive: true, force: true }); rmSync(vault, { recursive: true, force: true }); } };
}

const until = async (ok: () => boolean, ms: number) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (ok()) return true;
  return ok();
};

test("a caller killed with its process group mid-commit still persists and releases the index lock", async () => {
  const r = repo(2);
  try {
    // As pi's bash tool does on timeout: a detached shell, then SIGKILL to its whole group.
    const shell = spawn("bash", ["-c", "exec " + JSON.stringify(process.execPath) + " " + JSON.stringify(cli) + " update a --fields '{\"priority\":2}'"], { cwd: r.root, env: r.env, detached: true, stdio: "ignore" });
    expect(await until(() => existsSync(join(r.root, ".git/hook-started")), 10_000)).toBe(true);
    expect(existsSync(r.lock)).toBe(true);
    process.kill(-shell.pid!, "SIGKILL");
    expect(await until(() => r.committed("a").includes("priority: 2") && !existsSync(r.lock), 15_000)).toBe(true);
    expect(r.git("status", "--porcelain")).toBe("");
  } finally { r.done(); }
}, 30_000);

test("an old index lock with no live holder is recovered; the write persists", () => {
  const r = repo();
  try {
    writeFileSync(r.lock, "stranded by a killed commit");
    const old = new Date(Date.now() - 120_000);
    utimesSync(r.lock, old, old);
    const p = r.update("a", { priority: 3 });
    expect(p.stderr.toString()).toContain("removed stale");
    expect(p.exitCode).toBe(0);
    expect(r.committed("a")).toContain("priority: 3");
    expect(existsSync(r.lock)).toBe(false);
  } finally { r.done(); }
}, 30_000);

test("an index lock a live process holds is waited out, never removed", async () => {
  const r = repo();
  try {
    writeFileSync(r.lock, "held");
    const old = new Date(Date.now() - 120_000);
    utimesSync(r.lock, old, old);
    const marker = join(r.root, "still-there");
    const holder = Bun.spawn(["sh", "-c", "exec 3<.git/index.lock; sleep 3; [ -e .git/index.lock ] && touch still-there; rm -f .git/index.lock"], { cwd: r.root });
    await Bun.sleep(300);
    const p = await r.updateAsync("a", { priority: 4 });
    await holder.exited;
    expect(p.err).not.toContain("removed stale");
    expect(p.code).toBe(0);
    expect(existsSync(marker)).toBe(true);
    expect(r.committed("a")).toContain("priority: 4");
  } finally { r.done(); }
}, 30_000);

test("concurrent writers behind a slow commit hook all write and persist without lock timeouts", async () => {
  // Three 3s hooks exceed the former 5s vault lock wait when Git persistence ran inside it.
  const r = repo(3);
  try {
    const results = await Promise.all([r.updateAsync("a", { priority: 1 }), r.updateAsync("a", { assignee: "agent" }), r.updateAsync("b", { priority: 2 })]);
    for (const p of results) expect(p).toEqual({ code: 0, err: "" });
    expect(r.committed("a")).toContain("priority: 1");
    expect(r.committed("a")).toContain('assignee: "agent"');
    expect(r.committed("b")).toContain("priority: 2");
    expect(r.git("status", "--porcelain")).toBe("");
    expect(existsSync(r.lock)).toBe(false);
  } finally { r.done(); }
}, 60_000);
