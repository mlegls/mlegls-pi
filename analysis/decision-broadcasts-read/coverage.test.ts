// Data test (not a unit test of code): the committed coverage.json / pushes.json must agree with the
// figures stated in report.md. Replays checks 2, 4 and 7 (report inventory) of
// docs/attachments/decision-broadcasts-read/index.md.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dir = import.meta.dir;
type Row = { id: string; strong_peer_readers: string[]; push_peer_sessions: string[]; sender_session: string };
const cov: Row[] = JSON.parse(readFileSync(`${dir}/coverage.json`, "utf8"));
const report = readFileSync(`${dir}/report.md`, "utf8");
const reach = (r: Row) => new Set([...r.strong_peer_readers, ...r.push_peer_sessions]).size;

test("133 unique decisions; 114 reached; distribution matches report", () => {
  expect(new Set(cov.map((r) => r.id)).size).toBe(133);
  expect(cov.filter((r) => reach(r) > 0).length).toBe(114);
  const dist: Record<number, number> = {};
  for (const r of cov) dist[reach(r)] = (dist[reach(r)] ?? 0) + 1;
  expect(dist).toEqual({ 0: 19, 1: 33, 2: 19, 3: 5, 4: 3, 5: 12, 6: 11, 7: 7, 8: 6, 9: 4, 10: 6, 11: 3, 12: 3, 13: 2 });
  expect(report).toContain("114/133 (86%)");
});

test("pull 112 / push 42 / both 40; push-only are the two named decisions; no sender self-read", () => {
  const pull = cov.filter((r) => r.strong_peer_readers.length);
  const push = cov.filter((r) => r.push_peer_sessions.length);
  expect([pull.length, push.length]).toEqual([112, 42]);
  expect(pull.filter((r) => r.push_peer_sessions.length).length).toBe(40);
  expect(push.filter((r) => !r.strong_peer_readers.length).map((r) => r.id).sort()).toEqual(["mu2ino30-r0gn4n", "mu2ivr1j-nyco2g"]);
  for (const r of cov) {
    expect(r.strong_peer_readers).not.toContain(r.sender_session);
    expect(r.push_peer_sessions).not.toContain(r.sender_session);
  }
});

test("report's committed-file inventory matches git", () => {
  const tracked = execFileSync("git", ["ls-files", "."], { cwd: dir, encoding: "utf8" });
  for (const f of ["coverage.json", "pushes.json", "frags.txt"]) expect(tracked).toContain(f);
  for (const f of ["events.json", "text_occ.json"]) expect(tracked).not.toContain(f);
});
