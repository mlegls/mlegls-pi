import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Run after the opt-in live probe; this pins the observed public-surface contract.
// Without DSH_DISPATCH_PROBE_LOG there is no probe to check, so the test skips.
const log = process.env.DSH_DISPATCH_PROBE_LOG;
describe("live dispatch story evidence", () => {
  test.skipIf(!log)("dispatch admits a wave before settlement and exposes monitor failure", () => {
    if (!existsSync(log!)) throw new Error("DSH_DISPATCH_PROBE_LOG does not exist: " + log);
    const events = readFileSync(log!, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const handles = events.find((event) => event.event === "handles");
    expect(handles?.idle).toBe(true);
    expect(handles?.result?.content?.[0]?.text).toContain("dispatch-research");
    expect(events.some((event) => event.event === "error" && event.error.includes("deliberate child pre-step failure"))).toBe(true);
    expect(events.some((event) => event.event === "inbox" && event.source?.kind === "subagent-settled")).toBe(true);
  });
});
