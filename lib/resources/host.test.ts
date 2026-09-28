import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resources, type Submission } from "./host.ts";
const roots: string[] = [];
const pools: Resources[] = [];
function pool(slots = 2) {
  const root = mkdtempSync(join(tmpdir(), "ab-resources-")); roots.push(root);
  const resources = new Resources(root, slots); pools.push(resources);
  return resources;
}
const input = (script: string, extra: Partial<Submission> = {}): Submission => ({
  kind: "check", command: ["/bin/sh", "-c", script], cwd: tmpdir(), env: {}, ttl: 10, ...extra,
});
async function done(p: Resources, id: string) {
  const end = Date.now() + 5000;
  while (p.get(id).status !== "done") {
    if (Date.now() > end) throw new Error("execution timeout");
    await Bun.sleep(20);
  }
  return p.get(id);
}
afterEach(() => { for (const p of pools.splice(0)) p.close(); for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
test("two slots queue a third command and preserve output/exit status", async () => {
  const p = pool();
  const a = p.submit(input("sleep .15; echo first; exit 7"));
  const b = p.submit(input("sleep .15"));
  const c = p.submit(input("echo third"));
  expect(c.execution.status).toBe("queued");
  expect((await done(p, a.execution.id)).code).toBe(7);
  expect((await done(p, b.execution.id)).code).toBe(0);
  expect((await done(p, c.execution.id)).code).toBe(0);
  expect(readFileSync(a.execution.log, "utf8")).toBe("first\n");
});
test("singleflight shares only explicit matching identities, not completed results", async () => {
  const p = pool();
  const job = input("sleep .1; echo shared", { share: "snapshot" });
  const a = p.submit(job), b = p.submit({ ...job });
  expect(b.execution.id).toBe(a.execution.id);
  p.release(a.execution.id, a.client);
  expect((await done(p, b.execution.id)).code).toBe(0);
  expect(p.submit({ ...job }).execution.id).not.toBe(a.execution.id);
  expect(p.submit({ ...job, share: "different" }).execution.id).not.toBe(a.execution.id);
});
test("unkeyed checks never coalesce; abandoning a queued call never starts it", async () => {
  const p = pool(1);
  const a = p.submit(input("sleep .2"));
  const b = p.submit(input("echo must-not-run"));
  expect(a.execution.id).not.toBe(b.execution.id);
  p.release(b.execution.id, b.client);
  expect(p.get(b.execution.id).status).toBe("done");
  expect(p.get(b.execution.id).started).toBeUndefined();
  await done(p, a.execution.id);
});
test("services don't consume check slots and stop/expiry terminate them", async () => {
  const p = pool(1);
  const a = p.submit(input("sleep 10", { kind: "service", ttl: 1 }));
  const b = p.submit(input("echo check"));
  expect(b.execution.status).toBe("running");
  expect((await done(p, b.execution.id)).code).toBe(0);
  expect((await done(p, a.execution.id)).reason).toBe("time limit");
  const c = p.submit(input("sleep 10", { kind: "service" }));
  p.stop(c.execution.id);
  expect((await done(p, c.execution.id)).reason).toBe("stopped");
});
test("spawn failure frees the slot", async () => {
  const p = pool(1);
  const a = p.submit(input("", { command: ["/no-such-ab-executable"] }));
  const b = p.submit(input("echo recovered"));
  expect((await done(p, a.execution.id)).code).toBe(127);
  expect((await done(p, b.execution.id)).code).toBe(0);
});

test("shared checks reject a revision changed while queued", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ab-check-revision-")); roots.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q");
  git("-c", "user.name=Test", "-c", "user.email=test@example.org", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "initial");
  const p = pool(1);
  const blocker = p.submit(input("sleep .15"));
  const queued = p.submit(input("echo must-not-run", { cwd: dir, share: "frozen", revision: git("rev-parse", "HEAD") }));
  writeFileSync(join(dir, "new-input"), "changed");
  await done(p, blocker.execution.id);
  const result = await done(p, queued.execution.id);
  expect(result.code).not.toBe(0);
  expect(result.reason).toContain("inputs changed");
});

test("stopping a service kills its background child too", async () => {
  const p = pool();
  const a = p.submit(input("sleep 60 & echo $!; wait", { kind: "service" }));
  let pid = 0;
  for (let i = 0; i < 100 && !pid; i++) {
    try { pid = Number(readFileSync(a.execution.log, "utf8").trim()); } catch {}
    if (!pid) await Bun.sleep(10);
  }
  expect(pid).toBeGreaterThan(0);
  p.stop(a.execution.id);
  await done(p, a.execution.id);
  let live = true;
  for (let i = 0; i < 100 && live; i++) {
    try { process.kill(pid, 0); } catch { live = false; }
    if (live) await Bun.sleep(10);
  }
  expect(live).toBe(false);
});
