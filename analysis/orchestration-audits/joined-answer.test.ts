// Document-consistency test: the joined answer in docs/issues/archive/orchestration-audits.md must not
// contradict the reviewed child reports it summarizes. Replays checks 3, 4 and 7 of
// docs/attachments/orchestration-audits/index.md (decision evidence class, cache uncertainty,
// role-acceptance wording).
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const root = `${import.meta.dir}/../..`;
const joined = readFileSync(`${root}/docs/issues/archive/orchestration-audits.md`, "utf8");
const answer = joined.slice(joined.indexOf("## answer"), joined.indexOf("## Result"));
const bullet = (start: string) => answer.split("\n").find((l) => l.startsWith(`- ${start}`)) ?? "";
const cov: { strong_peer_readers: string[]; push_peer_sessions: string[] }[] = JSON.parse(
  readFileSync(`${root}/analysis/decision-broadcasts-read/coverage.json`, "utf8"),
);

test("decision bullet: 86% is pull ∪ push; 84% is pull alone", () => {
  const pull = cov.filter((r) => r.strong_peer_readers.length).length;
  const any = cov.filter((r) => r.strong_peer_readers.length || r.push_peer_sessions.length).length;
  expect([pull, any, cov.length]).toEqual([112, 114, 133]);
  const b = bullet("`decision` broadcasts");
  expect(b).toContain("114/133");
  expect(b).not.toMatch(/86% pull-only/);
  expect(b).toContain("112 (84%) by pull alone");
});

test("cache bullet: keeps the reviewed report's uncertainty", () => {
  const b = bullet("fence on cumulative cache-read");
  expect(b).toContain("no established common steer-triggered knee");
  expect(b).toContain("26/145");
  expect(b).not.toMatch(/no interior knee|steers are cache-hits/);
  expect(b).toMatch(/policy/);
  expect(b).toContain("68.5/56.3/32.7%");
});

test("role bullet: no claimed acceptance parity", () => {
  expect(bullet("model spikiness per role")).not.toContain("acceptance symmetric");
});
