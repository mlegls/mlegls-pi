import { expect, test } from "bun:test";
import { parse } from "./report.ts";

test("surfaces malformed fenced handoff parse errors", () => {
  const yaml = parse([
    "done",
    "```yaml",
    "plain scalar containing {rows: [2, 3, 5], total: 10}",
    "```",
  ].join("\n"));
  expect(yaml.handoff).toBeNull();
  expect(yaml.handoffError).toContain("Unexpected scalar");
  expect(yaml.body).toContain("plain scalar containing");

  const json = parse("done\n```json\n{\"stories\": ]\n```");
  expect(json.handoffError).toContain("JSON");
});

test("recognizes waiting as a report status", () => {
  expect(parse("waiting on proc_2: the kept browser batch").status).toBe("waiting");
});

test("recognizes checkpoint as a report status", () => {
  expect(parse("checkpoint").status).toBe("checkpoint");
});

// Public-library replays of the drive log and checks 1–4 in
// docs/attachments/turn-end-sentinel-parser-rejects-preambles/index.md.
const drivenReports = [
  ["first word", "done\n\nCommitted.\n\n```yaml\ncommit: abc123\n```", "done", { commit: "abc123" }, null],
  ["fenced first", "```yaml\nstatus: done\ncommit: abc123\n```", "done", { status: "done", commit: "abc123" }, null],
  ["prose first", "Committed as abc123.\n\ndone", "done", null, null],
  ["ordinary prose", "Committed and done with this.", null, null, null],
  ["empty YAML key", "Committed.\n\ndone\n\n```yaml\n: \"patch:title\"\n```", "done", null, null],
  ["middle sentinel", "Finished the work.\n\nEverything is committed.\n\ndone\n\n```yaml\nstatus: done\ncommit: abc123\n```", "done", { status: "done", commit: "abc123" }, null],
  ["trailing sentinel", "Finished.\n\n```yaml\ncommit: abc123\n```\n\ndone", "done", { commit: "abc123" }, null],
  ["handoff only after prose", "Summary.\n\n```yaml\nstatus: done\ncommit: abc123\n```", "done", { status: "done", commit: "abc123" }, null],
  ["conflict", "done\n\n```yaml\nstatus: blocked\nquestion: What next?\n```", null, { status: "blocked", question: "What next?" }, "conflicting report statuses: done, blocked"],
  ["missing status", "Committed as abc123.\n\n```yaml\ncommit: abc123\n```", null, { commit: "abc123" }, null],
] as const;

for (const [name, text, status, handoff, handoffError] of drivenReports) {
  test(`drive replay: ${name}`, () => {
    const report = parse(text);
    expect(report.status).toBe(status);
    expect(report.handoff).toEqual(handoff);
    expect(report.handoffError).toBe(handoffError);
  });
}

// Additional public-surface encounters are recorded in the packet's review append.
test("review replay: status-only handoff needs no unrelated key", () => {
  for (const status of ["done", "blocked", "needs-input", "checkpoint"] as const) {
    const report = parse(`\x60\x60\x60yaml\nstatus: ${status}\n\x60\x60\x60`);
    expect(report.status).toBe(status);
    expect(report.handoff).toEqual({ status });
    expect(report.handoffError).toBeNull();
  }
});

test("review replay: short heading still permits a sentinel with prose", () => {
  expect(parse("Report:\ndone — committed").status).toBe("done");
});

test("review replay: a handoff caveat is data, not a conflicting sentinel", () => {
  const report = parse("done\n```yaml\ncaveats: |\n  blocked\n```");
  expect(report.status).toBe("done");
  expect(report.handoff).toEqual({ caveats: "blocked\n" });
  expect(report.handoffError).toBeNull();
});

test("review replay: removing a handoff does not promote later prose to first-word status", () => {
  const report = parse("```yaml\ncommit: abc123\n```\ndone with the first part, still working");
  expect(report.status).toBeNull();
  expect(report.handoff).toEqual({ commit: "abc123" });
});
