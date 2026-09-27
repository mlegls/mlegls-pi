import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Run after the opt-in live probe; this pins the observed public-surface contract.
const log = process.env.DSH_DISPATCH_PROBE_LOG;
describe("live dispatch story evidence", () => {
  test("dispatch admits a wave before settlement and exposes monitor failure", () => {
    if (!log || !existsSync(log)) throw new Error("Set DSH_DISPATCH_PROBE_LOG to a completed live probe log");
    const events = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const handles = events.find((event) => event.event === "handles");
    expect(handles?.idle).toBe(true);
    expect(handles?.result?.content?.[0]?.text).toContain("dispatch-research");
    expect(events.some((event) => event.event === "error" && event.error.includes("deliberate child pre-step failure"))).toBe(true);
    expect(events.some((event) => event.event === "inbox" && event.source?.kind === "subagent-settled")).toBe(true);
  });
});
