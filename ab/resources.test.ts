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
