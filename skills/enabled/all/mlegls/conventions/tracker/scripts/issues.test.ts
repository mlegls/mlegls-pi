import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A maintainer must be able to format issues without releasing blocked work,
// and must see invalid metadata rather than a plausible partial frontier.
const cwd = mkdtempSync(join(tmpdir(), "tracker-"));
const issues = join(cwd, "docs/issues");
const cli = process.env.TRACKER_CLI ?? join(import.meta.dir, "issues.ts");
const commands = ["tree", "frontier", "mine", "check"];
const blocker = '"[[projects/fixture/issues/blocker]]"';
const frontmatter = (body: string) => `---\n${body}\n---\n`;
function put(file: string, text: string) {
  writeFileSync(join(issues, file + ".md"), text);
}
function run(cmd: string) {
  const p = Bun.spawnSync([process.execPath, cli, cmd], { cwd });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}
mkdirSync(join(issues, "archive"), { recursive: true });
mkdirSync(join(issues, "attachments"));
put("attachments/evidence", "A note, not an issue.\n");
put("blocker", frontmatter("next: wait"));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

test("format-equivalent dependencies preserve all queries", () => {
  for (const next of ["implement", "grill"]) {
    put("task", frontmatter(`next: ${next}\nblocked-by: [${blocker}]`));
    const baseline = commands.map(run);
    expect(baseline[0].out).toContain("blocked:blocker");
    expect(baseline[1].out).toBe("");
    expect(baseline[2].out).toBe("");
    expect(baseline[3]).toEqual({ code: 0, out: "ok\n", err: "" });
    for (const field of [
      `blocked-by: [\n  ${blocker}, # retained edge\n]`,
      `blocked-by:\n  - ${blocker}`,
      "blocked-by: ['[[projects/fixture/issues/blocker]]'] # comment",
    ]) {
      const text = frontmatter(`next: ${next}\n${field}`);
      for (const formatted of [text, "\uFEFF" + text.replaceAll("\n", "\r\n")]) {
        put("task", formatted);
        expect(commands.map(run)).toEqual(baseline);
      }
    }
    for (const field of ["", "\nblocked-by: []"]) {
      put("task", frontmatter(`next: ${next}${field}`));
      expect(run(next === "implement" ? "frontier" : "mine").out).toContain("task");
      expect(run("check").out).toBe("ok\n");
    }
  }
}, 30_000);

test("invalid frontmatter fails every query with a filename and no partial output", () => {
  const invalid = [
    "no frontmatter", "---\nnext: implement", "---\nnext: implement\n---not-a-delimiter",
    ...[
      "", "[]", "next: implement\nnext: wait", "next: [", "next: bogus", "priority: 1",
      "next: null", "next: [implement]", "next: implement\npriority: '1'",
      "next: implement\npriority: 4", "next: implement\nclaimed-by: null",
      "next: implement\nclaimed-by: []", "next: implement\nclaimed-by: ''",
      "next: implement\npart-of: null", "next: implement\npart-of: blocker",
      "next: implement\npart-of: '[[blocker]]'", "next: implement\nblocked-by: null",
      `next: implement\nblocked-by: ${blocker}`, `next: implement\nblocked-by: [${blocker}, 1]`,
      "next: implement\nblocked-by: ['[[projects/fixture/issues/blocker#heading]]']",
      "next: implement\nblocked-by: [\n  '[[projects/fixture/issues/blocker]]'\n",
      "next: implement\nblocked-by: []\nblocked-by: []",
      "next: implement\nother: &a [1]\nblocked-by: *a",
      "next: &a implement\nother: *a", "next: !!str implement", "next: !unknown implement",
      "next: implement\n<<: {priority: 1}", "next: implement\n1: value",
    ].map(frontmatter),
  ];
  for (const text of invalid) {
    put("task", text);
    for (const cmd of commands) {
      const result = run(cmd);
      expect(result.code, `${cmd}: ${text}`).not.toBe(0);
      expect(result.out).toBe("");
      expect(result.err).toContain("task.md:");
    }
  }
}, 30_000);

test("wrapped edges still receive graph checks and done blockers retain scheduling semantics", () => {
  put("task", frontmatter(`next: implement\nblocked-by: [\n  ${blocker}\n]`));
  rmSync(join(issues, "blocker.md"));
  expect(run("check").out).toContain("blocked-by blocker does not exist");
  expect(run("check").code).toBe(1);
  expect(run("frontier").out).toBe("");
  put("archive/blocker", frontmatter("next: done"));
  expect(run("check").out).toContain("blocked-by blocker is done; remove it");
  expect(run("check").code).toBe(1);
  expect(run("frontier").out).toContain("task");
}, 30_000);
