// Replays the driver's checks (docs/attachments/role-model-spikiness/index.md, "Replayable checks")
// against the published ledgers and the research document. Corpus-dependent replays skip when
// ~/.pi/agent/sessions or the board log is absent.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dir;
const att = join(here, "../attachments/role-model-spikiness");
const doc = readFileSync(join(here, "role-model-spikiness-2026-09-30.md"), "utf8");
type Row = {
  session: string; handle: string; shape: string; model: string; cost: number; turns: number;
  tool_calls: number; tokens: { cacheRead: number }; excluded: string | null; start: string;
};
const ledger: Row[] = JSON.parse(readFileSync(join(att, "ledger.json"), "utf8"));
const acceptance = JSON.parse(readFileSync(join(att, "acceptance.json"), "utf8"));
const sessions = join(homedir(), ".pi/agent/sessions");
const boardLog = join(homedir(), ".local/share/pi-board/log.jsonl");

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const completed = (shape: string, model: string) =>
  ledger.filter((r) => r.shape === shape && r.model === model && !r.excluded);

describe("check 1: inventory and sparse exit", () => {
  test("ledger identifies every session by full id, with an exclusion reason where excluded", () => {
    expect(ledger.filter((r) => r.shape === "review")).toHaveLength(50);
    expect(ledger.filter((r) => r.shape === "verify-story")).toHaveLength(32);
    expect(new Set(ledger.map((r) => r.session)).size).toBe(ledger.length);
    expect(ledger.filter((r) => r.excluded).map((r) => `${r.handle}/${r.model}/${r.excluded}`).sort()).toEqual([
      "guard-review-2/glm/provider error",
      "lifecycle-drive-2/sonnet/provider error",
      "u2-selfgrade-rereview/glm/provider error",
      "vf/terra/smoke",
    ]);
  });

  test("the report says the corpus cannot answer at fixed target and verify-story has no triad pair", () => {
    const byHandle = new Map<string, Set<string>>();
    for (const r of ledger) byHandle.set(`${r.shape}/${r.handle}`, (byHandle.get(`${r.shape}/${r.handle}`) ?? new Set()).add(r.model));
    const cross = [...byHandle].filter(([, m]) => m.size > 1).map(([h]) => h);
    expect(cross).toEqual(["review/u2-selfgrade-rereview"]);
    const verifyModels = new Set(ledger.filter((r) => r.shape === "verify-story").map((r) => r.model));
    expect(verifyModels).toEqual(new Set(["sonnet", "terra"]));
    expect(doc).toContain("cannot answer the cross-model question at fixed target");
  });

  test.skipIf(!existsSync(sessions))("regenerating the ledger from the session corpus reproduces the committed file", () => {
    const out = join(mkdtempSync(join(tmpdir(), "rms-")), "ledger.json");
    const p = Bun.spawnSync(["python3", join(here, "role-model-spikiness.py"), "--out", out]);
    expect(p.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(ledger);
  }, 120_000);
});

describe("check 2: wrong-model re-review", () => {
  test("u2-selfgrade-rereview is a dead glm attempt plus a completed deepseek review", () => {
    const rows = ledger.filter((r) => r.handle === "u2-selfgrade-rereview");
    const glm = rows.find((r) => r.model === "glm")!;
    const ds = rows.find((r) => r.model === "deepseek")!;
    expect([glm.cost, glm.turns, glm.tool_calls, glm.excluded]).toEqual([0.003214145, 4, 5, "provider error"]);
    expect([ds.cost, ds.turns, ds.tool_calls, ds.excluded]).toEqual([0.01837244, 25, 40, null]);
    expect(completed("review", "glm").some((r) => r.handle === "u2-selfgrade-rereview")).toBe(false);
    expect(doc).toContain("glm attempt died at turn 4");
  });
});

describe("check 3: pair-ratio statistic", () => {
  const cost = (h: string, m: string) => ledger.find((r) => r.handle === h && r.model === m)!.cost;
  const astra = ["u3-review", "u4-review", "u5-review", "u6-review"].map((h) => cost(h, "astra"));
  const glm = ["u1-security-review", "u2-review"].map((h) => cost(h, "glm"));
  test("median of the eight cross ratios is 16x; ratio of group medians is 10x", () => {
    const ratios = astra.flatMap((a) => glm.map((g) => a / g)).sort((a, b) => a - b);
    expect(ratios.map((x) => +x.toFixed(2))).toEqual([3.83, 5.64, 6.08, 7.62, 24.31, 35.81, 38.62, 48.4]);
    expect(median(ratios)).toBeCloseTo(15.9668, 3);
    expect(median(astra) / median(glm)).toBeCloseTo(10.1262, 3);
    expect(doc).toContain("**median 16×**");
    expect(doc).toContain("10×");
  });
});

describe("check 4: role tables replay from the ledger", () => {
  // Table rows look like `| review, glm flash | 17 (2) | 0.043 [0.020..0.127] | 34 [15..90] | ...`.
  const cell = (label: string) => {
    const line = doc.split("\n").find((l) => l.startsWith(`| ${label} |`));
    if (!line) throw new Error(`no table row ${label}`);
    const m = line.match(/\| ([\d.]+) (?:\((\d+)\) )?\| ([\d.]+) \[([\d.]+)\.\.([\d.]+)\]/)!;
    return { n: +line.split("|")[2].trim().split(" ")[0], med: +m[3], lo: +m[4], hi: +m[5], dec: m[3].split(".")[1].length };
  };
  const near = (printed: number, actual: number, dec: number) => Math.abs(printed - actual) <= 0.5 * 10 ** -dec + 1e-9;
  test.each([
    ["review, glm flash", "review", "glm"], ["review, astra", "review", "astra"], ["review, opus", "review", "opus"],
    ["verify-story, sonnet", "verify-story", "sonnet"], ["verify-story, terra", "verify-story", "terra"],
  ] as const)("%s row: n, median, min and max of completed attempts", (label, shape, model) => {
    const c = completed(shape, model).map((r) => r.cost);
    const row = cell(label);
    expect(row.n).toBe(ledger.filter((r) => r.shape === shape && r.model === model).length);
    expect(near(row.med, median(c), row.dec)).toBe(true);
    expect(near(row.lo, Math.min(...c), row.dec)).toBe(true);
    expect(near(row.hi, Math.max(...c), row.dec)).toBe(true);
  });
  test("published medians are true medians of completed attempts", () => {
    expect(median(completed("verify-story", "terra").map((r) => r.cost))).toBeCloseTo(1.581, 3);
    expect(median(completed("verify-story", "sonnet").map((r) => r.cost))).toBeCloseTo(7.432, 3);
    expect(completed("review", "glm")).toHaveLength(15);
    expect(completed("verify-story", "sonnet")).toHaveLength(18);
  });
});

describe("check 5: parent disposition ledger", () => {
  const rows = acceptance.review as Array<Record<string, any>>;
  test("every review worker has a disposition; silent rounds carry no report", () => {
    expect(rows).toHaveLength(18);
    for (const r of rows) {
      expect(r.disposition).toBeTruthy();
      if (String(r.disposition).startsWith("silent")) expect(r.report_id).toBeNull();
      else { expect(r.report_id).toBeTruthy(); expect(r.parent_id).toBeTruthy(); }
    }
  });
  test("U2 glm chain and U4 astra chain match the drive's excerpts; U3 clear was not accepted", () => {
    const g = (h: string, m: string) => rows.find((r) => r.handle === h && r.model === m)!;
    expect([g("u2-review", "glm").report_id, g("u2-review", "glm").parent_id]).toEqual(["mu2mpq98-el9ybh", "mu2mpwym-op17ke"]);
    expect(g("u2-review", "glm").parent_session_line).toBe(601);
    expect([g("u2-replay-rereview", "glm").report_id, g("u2-replay-rereview", "glm").parent_id]).toEqual(["mu2nm46u-wpiiol", "mu2nmaik-khb11g"]);
    expect([g("u2-selfgrade-rereview", "deepseek").report_id, g("u2-selfgrade-rereview", "deepseek").parent_id]).toEqual(["mu2vq8lf-p0wol8", "mu2vqg7i-lstqm4"]);
    expect([g("u4-review", "astra").report_id, g("u4-review", "astra").parent_id]).toEqual(["mu2woxlv-m9l22w", "mu2wp7xw-um2mc4"]);
    expect(g("u3-review", "astra").disposition).toBe("clear-not-accepted");
    expect(doc).not.toContain("no verdict was ever overturned");
  });
  test("silent glm death was detected hours later at u2-selfgrade-rereview", () => {
    const dead = rows.find((r) => r.handle === "u2-selfgrade-rereview" && r.model === "glm")!;
    expect(dead.parent_session_line).toBe(1000);
    expect(doc).toContain("detection latency 3.5 h");
  });
  test.skipIf(!existsSync(boardLog))("cited board ids exist and carry the recorded timestamps", () => {
    const byId = new Map<string, any>();
    for (const l of readFileSync(boardLog, "utf8").split("\n")) if (l) { const o = JSON.parse(l); byId.set(o.id, o); }
    for (const r of rows) {
      if (r.report_id) expect(byId.get(r.report_id)?.ts).toBe(r.report_ts);
      if (r.parent_id) expect(byId.get(r.parent_id)?.ts).toBe(r.parent_ts);
    }
  });
});

describe("check 6: routing calibration", () => {
  test("recommendations name the missing plan-consumption and wall-time evidence and the confound", () => {
    for (const s of ["accepted-completion", "plan consumption", "wall time", "confounded", "same story, two drivers", "is not established"])
      expect(doc.includes(s), s).toBe(true);
  });
});
