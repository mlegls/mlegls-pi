import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Execution } from "../lib/resources/host.ts";

test("CLI shares one execution, forwards failures, rejects dirty sharing and runs nested checks", async () => {
  const state = mkdtempSync(join(tmpdir(), "ab-resource-cli-"));
  const cwd = mkdtempSync(join(tmpdir(), "ab-resource-repo-"));
  const main = join(import.meta.dir, "main.ts");
  const env = { ...process.env, AB_STATE: state, AB_CHECK_SLOT: "" };
  async function cli(...args: string[]) {
    const child = Bun.spawn([process.execPath, main, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { out, err, code };
  }
  try {
    execFileSync("git", ["init", "-q"], { cwd });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.org", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "initial"], { cwd });
    const args = ["check", "--share", "fixture", "--", "/bin/sh", "-c", "sleep 1; echo shared; exit 7"];
    const [a, b] = await Promise.all([cli(...args), cli(...args)]);
    expect(a.code).toBe(7); expect(b.code).toBe(7);
    expect(a.out).toBe("shared\n"); expect(b.out).toBe(a.out);
    expect(a.err.match(/check ([a-f0-9-]+)/)?.[1]).toBe(b.err.match(/check ([a-f0-9-]+)/)?.[1]);
    const entries = JSON.parse((await cli("check", "list")).out) as Execution[];
    expect(entries.length).toBe(1);
    expect(entries[0]!.revision).toMatch(/^[a-f0-9]{40,64}$/);
    const nested = await cli("check", "--", process.execPath, main, "check", "--", "/bin/echo", "nested");
    expect(nested.code).toBe(0); expect(nested.out).toBe("nested\n");
    expect((await cli("check", "--", "/bin/echo", "--help")).out).toBe("--help\n");
    writeFileSync(join(cwd, "dirty"), "changed");
    const dirty = await cli(...args);
    expect(dirty.code).toBe(2); expect(dirty.err).toContain("clean worktree");
    const service = JSON.parse((await cli("service", "start", "--ttl", "30", "--", "/bin/sleep", "30")).out) as Execution;
    expect(service.status).toBe("running");
    expect((await cli("service", "stop", service.id)).code).toBe(0);
  } finally {
    await cli("daemon", "shutdown");
    // Shutdown is acknowledged before the daemon exits; let its exit hooks finish.
    await Bun.sleep(100);
    rmSync(state, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
}, 30_000);

// Replays readiness, recovery and departure checks 1–3 in
// docs/attachments/ab-check-loses-waiter-after-daemon-timeout/index.md.
test("CLI retains running and queued waiters across daemon timeouts, but releases on SIGINT", async () => {
  const state = mkdtempSync(join(tmpdir(), "ab-waiter-cli-"));
  const main = join(import.meta.dir, "main.ts");
  const env = { ...process.env, AB_STATE: state, AB_CHECK_SLOT: "" };
  const callers: ReturnType<typeof start>[] = [];
  function start(...args: string[]) {
    const child = Bun.spawn([process.execPath, main, ...args], { env, stdout: "pipe", stderr: "pipe" });
    const result = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      .then(([out, err, code]) => ({ out, err, code }));
    return { child, result };
  }
  const cli = (...args: string[]) => start(...args).result;
  const check = (script: string) => {
    const caller = start("check", "--", "/bin/sh", "-c", script);
    callers.push(caller);
    return caller;
  };
  async function list() {
    const result = await cli("check", "list");
    expect(result.code).toBe(0);
    return JSON.parse(result.out) as Execution[];
  }
  async function until(predicate: (entries: Execution[]) => boolean) {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const entries = await list();
      if (predicate(entries)) return entries;
      if (Date.now() > deadline) throw new Error("receipt state did not settle: " + JSON.stringify(entries));
      await Bun.sleep(100);
    }
  }
  let pid: number | undefined;
  try {
    const ready = await cli("check", "--", "/bin/echo", "ready");
    expect(ready.code).toBe(0);
    expect(ready.out).toBe("ready\n");
    const initial = await list();
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ status: "done", code: 0 });
    pid = Number(await Bun.file(join(state, "daemon.pid")).text());
    expect(pid).toBeGreaterThan(0);

    const a = check("sleep 14; echo running-A");
    const b = check("sleep 14; echo running-B");
    await until(entries => entries.filter(e => e.status === "running").length === 2);
    const q = check("echo once-queued; exit 7");
    const before = await until(entries => entries.some(e => e.status === "queued"));
    expect(before).toHaveLength(4);
    process.kill(pid, "SIGSTOP");
    await Bun.sleep(7000);
    process.kill(pid, "SIGCONT");
    const results = await Promise.all([a.result, b.result, q.result]);
    expect(results.map(r => r.code)).toEqual([0, 0, 7]);
    expect(results.map(r => r.out)).toEqual(["running-A\n", "running-B\n", "once-queued\n"]);
    for (const result of results) {
      const id = result.err.match(/check ([a-f0-9-]+)/)?.[1];
      expect(before.some(e => e.id === id)).toBe(true);
      expect(result.err).toContain(`check ${id}: daemon request timed out; retrying receipt`);
      expect(result.err).toContain("until response or interruption (30s caller lease may expire)");
    }
    const after = await list();
    expect(after.map(e => e.id).sort()).toEqual(before.map(e => e.id).sort());
    for (const entry of after) {
      expect(entry.status).toBe("done");
      expect(entry.reason).toBeUndefined();
      expect(entry.code).toBe(entry.command.at(-1) === "echo once-queued; exit 7" ? 7 : 0);
    }

    const departing = check("sleep 40; echo should-not-print");
    const active = (await until(entries => entries.some(e => e.status === "running")))
      .find(e => e.status === "running")!;
    process.kill(pid, "SIGSTOP");
    await Bun.sleep(6000);
    departing.child.kill("SIGINT");
    process.kill(pid, "SIGCONT");
    const result = await departing.result;
    expect(result.code).toBe(130);
    expect(result.out).not.toContain("should-not-print");
    expect(result.err).toContain("daemon request timed out; retrying receipt");
    const final = await until(entries => entries.find(e => e.id === active.id)?.status === "done");
    expect(final.find(e => e.id === active.id)?.reason).toBe("no waiting callers");
  } finally {
    if (pid) { try { process.kill(pid, "SIGCONT"); } catch {} }
    for (const { child } of callers) if (child.exitCode === null) child.kill("SIGINT");
    await cli("daemon", "shutdown");
    await Promise.all(callers.map(c => c.result));
    await Bun.sleep(100);
    rmSync(state, { recursive: true, force: true });
  }
}, 60_000);
