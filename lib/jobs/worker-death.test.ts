import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Replays the dead-worker first-use checks in docs/attachments/parent-waits-on-worker-that-died-without-a-report/index.md.
// Subprocess isolation keeps the fixture's module mocks out of other suites.
test("provider-error worker is reported and shown dead; healthy long turns are not", async () => {
 const root = mkdtempSync(join(tmpdir(), "worker-death-"));
 try {
  const proc = Bun.spawn([process.execPath, resolve("lib/jobs/fixtures/worker-death.ts")], { env: { ...process.env, HOME: root }, stdout: "pipe", stderr: "pipe" });
  const [out, errors, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  expect({ code, errors }).toEqual({ code: 0, errors: "" });
  const seen = JSON.parse(out);
  // Check 1 (and 3: the fixture appends board-cursor entries after the error, as a live idle worker does): mail names error, session path and size.
  const mail = seen.providerFailure.mail;
  expect(mail.owner).toBe("parent-mailbox");
  expect(mail.text).toContain("worker session ended after provider error: Provider finish_reason: error");
  expect(mail.text).toContain("Session file: " + seen.providerFailure.state.startup.sessionFile);
  expect(mail.text).toContain("Session size: " + seen.providerFailure.sessionSize + " bytes");
  // Status reads dead, not the phase.
  expect(seen.status).toContain("dead-worker dead (Provider finish_reason: error;");
  expect(seen.status).not.toContain("dead-worker implement");
  // Check 2: a session that kept going after its old error sends nothing, including after a redispatch reusing run/handle.
  expect(seen.healthyLongTurn.mail).toEqual([]);
  expect(seen.healthyLongTurn.state.dead).toBeUndefined();
  expect(seen.redispatchedHealthyTurn.mail).toEqual([]);
  expect(seen.redispatchedHealthyTurn.state.startup.sessionFile).toBe(seen.redispatchedHealthyTurn.currentSession);
 } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
