import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Execution } from "../lib/resources/host.ts";

// Replays the packet's phase, worker-service attribution and missing-worktree checks
// (docs/attachments/supervise-status-shows-each-jobs-running-services/index.md, checks 2-4)
// against a seeded, isolated daemon: the job record is a completed supervise job, so nothing runs.
test("supervise status shows job phases, each job's worker services, and services whose worktree is gone", async () => {
  const state = mkdtempSync(join(tmpdir(), "ab-status-state-"));
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ab-status-repo-")));
  const top = join(root, "repo");
  const workers = join(root, "repo__worktrees");
  const main = join(import.meta.dir, "main.ts");
  const env = { ...process.env, AB_STATE: state, AB_CHECK_SLOT: "" };
  async function cli(cwd: string, ...args: string[]) {
    const child = Bun.spawn([process.execPath, main, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { out, err, code };
  }
  const ids: string[] = [];
  try {
    mkdirSync(top);
    execFileSync("git", ["init", "-q"], { cwd: top });
    for (const name of ["building-1", "landing-1", "gone-1"]) mkdirSync(join(workers, name), { recursive: true });
    const child = (slug: string, extra: object) => ({ slug, phase: "drive", handle: { run: "r", handle: slug + "-1", path: join(workers, slug + "-1") }, ...extra });
    const job = {
      id: "supervise-t-1", type: "supervise", status: "completed", stateFile: join(state, "job.json"),
      input: { ticket: "t", cwd: top },
      state: { integrated: [], metrics: { wakes: 0 }, children: { building: child("building", {}), landing: child("landing", { phase: "review", integrating: true }) } },
    };
    writeFileSync(job.stateFile, JSON.stringify(job));
    writeFileSync(join(state, "jobs.json"), JSON.stringify([job.stateFile]));
    const start = async (dir: string, marker: string) => {
      const entry = JSON.parse((await cli(dir, "service", "start", "--ttl", "60", "--", "/bin/sh", "-c", `: ${marker}; sleep 60`)).out) as Execution;
      ids.push(entry.id);
      return entry;
    };
    const building = await start(join(workers, "building-1"), "svc-building");
    const landing = await start(join(workers, "landing-1"), "svc-landing");
    const gone = await start(join(workers, "gone-1"), "svc-gone");
    const peer = await start(root, "svc-elsewhere");
    rmSync(join(workers, "gone-1"), { recursive: true });

    const { out, code } = await cli(top, "supervise", "status", "t");
    expect(code).toBe(0);
    const [jobLine, ...rest] = out.split("\n");
    expect(jobLine).toContain("phase: drive, integrate");
    const text = rest.join("\n");
    expect(text).toMatch(/building drive r\/building-1\n/);
    expect(text).toMatch(/landing integrate \(in progress\) r\/landing-1\n/);
    // Services sit under their job; the missing-worktree section holds the one whose directory vanished.
    const [jobPart, orphanPart] = text.split("services with missing worktrees:");
    expect(jobPart).toContain(building.id); expect(jobPart).toContain(landing.id);
    expect(jobPart).not.toContain(gone.id); expect(jobPart).not.toContain(peer.id);
    expect(orphanPart).toContain(gone.id); expect(orphanPart).toContain("svc-gone");
    expect(orphanPart).not.toContain(building.id); expect(orphanPart).not.toContain(peer.id);

    // Stopped services leave the status.
    await cli(top, "service", "stop", gone.id); await cli(top, "service", "stop", building.id);
    const after = (await cli(top, "supervise", "status", "t")).out;
    expect(after).not.toContain(gone.id); expect(after).not.toContain(building.id); expect(after).toContain(landing.id);
  } finally {
    for (const id of ids) await cli(top, "service", "stop", id).catch(() => {});
    await cli(root, "daemon", "shutdown");
    await Bun.sleep(100);
    rmSync(state, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
