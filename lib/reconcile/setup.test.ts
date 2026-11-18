import { expect, test } from "bun:test";
import { prepare, until } from "./setup-fixture";

// Ticket-approved reconciler contract: repair unusable setup before any drive launch.
test("setup repairs keep the implementer; CLI/browser entries launch drive; drive:none bypasses", async () => {
 const saved = { ...process.env };
 try {
  for (const entry of ["bun app.ts", "https://fixture.invalid/board"]) {
   const f = await prepare();
   try {
    const first = await f.ready();
    for (const setup of [null, { kind: "local", entry: "bun test lib/mail.test.ts", cleanup: "bun cleanup.ts" }]) {
     const before = f.state()!.chains.solo.retries.setup ?? 0;
     f.report(setup);
     await until(() => f.state()?.chains.solo.retries.setup === before + 1);
     expect(f.state()!.chains.solo.phase).toBe("implement");
     expect(f.state()!.chains.solo.handle?.handle).toBe(first.handle);
     expect(f.bb.threads().some(t => t.title.includes("-drive-"))).toBe(false);
     expect(f.bb.threads().find(t => t.id === first.bb)!.tells.at(-1)).toContain("unit-test command alone is not setup");
    }
    f.report({ entry });
    await until(() => f.state()?.chains.solo.phase === "drive" && f.bb.threads().some(t => t.title.includes("-drive-")));
    expect(f.state()!.exceptions).toEqual({});
   } finally { await f.close(); }
  }
  const f = await prepare(true);
  try {
   f.report(null);
   await until(() => f.state()?.chains.solo.phase === "review");
   expect(f.state()!.chains.solo.retries.setup).toBeUndefined();
   expect(f.bb.threads().some(t => t.title.includes("-drive-"))).toBe(false);
  } finally { await f.close(); }
 } finally { process.env = saved; }
}, 120_000);

// The reconciler consumes structured statuses and returns rejected status lines to the same worker.
test("reconciler admits YAML statuses and quotes rejected first lines", async () => {
 const saved = { ...process.env };
 const handoff = (status?: string) => "```yaml\n" + (status ? `status: ${status}\n` : "") + "setup: { entry: bun app.ts }\n```";
 try {
  for (const [rejectedLine, rejectedStatus, acceptedPrefix] of [
   ["Work is ready.", undefined, "Work is ready.\n\n"],
   ["done — committed", "blocked", ""],
  ] as const) {
   const f = await prepare();
   try {
    const first = await f.ready();
    f.turn(rejectedLine + "\n\n" + handoff(rejectedStatus));
    await until(() => f.state()?.chains.solo.retries.status === 1);
    expect(f.state()!.chains.solo.phase).toBe("implement");
    expect(f.state()!.exceptions).toEqual({});
    expect(f.bb.threads().find(t => t.id === first.bb)!.tells.at(-1)).toContain(`First nonblank line: ${JSON.stringify(rejectedLine)}`);

    f.turn(acceptedPrefix + handoff("done"));
    await until(() => f.state()?.chains.solo.phase === "drive" && f.bb.threads().some(t => t.title.includes("-drive-")));
    expect(f.state()!.exceptions).toEqual({});
   } finally { await f.close(); }
  }
 } finally { process.env = saved; }
}, 120_000);
