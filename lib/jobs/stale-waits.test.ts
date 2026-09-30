import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Replays the CLI and mailbox encounter in the packet's acceptance review.
// Subprocess isolation keeps fixture module mocks and the clock out of other suites.
test("waiting status and one-time stale exception wake", async () => {
 const root = mkdtempSync(join(tmpdir(), "stale-waits-"));
 try {
  const proc = Bun.spawn([process.execPath, resolve("lib/jobs/fixtures/stale-waits.ts")], { env: { ...process.env, HOME: root }, stdout: "pipe", stderr: "pipe" });
  const [out, errors, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  expect({ code, errors }).toEqual({ code: 0, errors: "" });
  const seen = JSON.parse(out);
  // Packet check 1: status keeps the exception's start time, rather than the read time.
  expect(seen.empty).toBe("no supervision jobs here");
  expect(seen.initialStatus).toContain("leaf implement fixture/leaf waiting: blocked since 2026-09-30T12:00:00.000Z");
  expect(seen.beforeMail.status).toBe(seen.initialStatus);
  // Packet checks 2–3: no reminder before delivered owner mail or before 30 minutes.
  expect(seen.beforeMail.reminders).toBe(0);
  expect(seen.mailAt).toBe("2026-09-30T12:31:00.000Z");
  expect(seen.beforeThreshold).toBe(0);
  expect(seen.atThreshold).toHaveLength(1);
  expect(seen.atThreshold[0].at).toBe("2026-09-30T13:01:00.000Z");
  expect(seen.atThreshold[0].text).toContain("stale wait: implement leaf is still waiting: blocked");
  expect(seen.atThreshold[0].text).toContain("exception notice was sent at 2026-09-30T12:31:00.000Z");
  expect(seen.atThreshold[0].text).toContain("child fixture/leaf, worktree ");
  expect(seen.afterAnother30).toBe(1);
  expect(seen.afterRestart).toBe(1);
  // Packet check 3: a child turn cancels that wait; another exception gets its own reminder.
  expect(seen.childTurnBeforeThreshold.reminders).toBe(1);
  expect(seen.childTurnBeforeThreshold.status).toContain("waiting: checkpoint since 2026-09-30T14:30:00.000Z");
  expect(seen.newExceptionStatus).toContain("waiting: blocked since 2026-09-30T14:32:00.000Z");
  expect(seen.newExceptionReminders).toHaveLength(2);
  expect(seen.newExceptionReminders[1].at).toBe("2026-09-30T15:02:00.000Z");
  expect(seen.newExceptionReminders[1].text).toContain("exception notice was sent at 2026-09-30T14:32:00.000Z");
  expect(seen.finalReminders).toBe(2);
 } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
