import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A maintainer must be able to format issues without releasing blocked work,
// and must see invalid metadata rather than a plausible partial frontier.
const cwd = mkdtempSync(join(tmpdir(), "tracker-"));
const issues = join(cwd, "docs/issues");
const cli = process.env.TRACKER_CLI ?? join(import.meta.dir, "issues.ts");
const commands = ["tree", "frontier", "mine", "check", "outline"];
const blocker = '"[[projects/fixture/issues/blocker]]"';
const frontmatter = (body: string) => `---\n${body}\n---\n`;
function put(file: string, text: string) {
  writeFileSync(join(issues, file + ".md"), text);
}
const vault = mkdtempSync(join(tmpdir(), "vault-"));
writeFileSync(join(vault, "fixture.md"), `---\ndirectory: ${cwd}\n---\n## efforts\n- the blocker — [[projects/fixture/issues/blocker]]\n- a note with no issue\n## snippets\n- prose that links nothing\n`);
function run(cmd: string) {
  const p = Bun.spawnSync([process.execPath, cli, cmd], { cwd, env: { ...process.env, TRACKER_VAULT: vault } });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}
mkdirSync(join(issues, "archive"), { recursive: true });
mkdirSync(join(issues, "attachments"));
put("attachments/evidence", "A note, not an issue.\n");
put("blocker", frontmatter("next: wait"));
afterAll(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(vault, { recursive: true, force: true }); });

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

test("a claim without a worktree is stale: reported by check, offered by frontier, kept by a worktree naming the slug or run", () => {
  Bun.spawnSync(["git", "init", "-q"], { cwd });
  put("task", frontmatter("next: implement\nclaimed-by: task-worker (run_0badcafe)"));
  expect(run("check").out).toContain("task: claimed by task-worker (run_0badcafe) without a worktree");
  expect(run("frontier").out).toContain("task  [implement stale-claim:task-worker (run_0badcafe)]");
  put("task", frontmatter("next: grill\nclaimed-by: me"));
  expect(run("check").out).toBe("ok\n");
  expect(run("mine").out).toContain("[grill claimed:me]");
  Bun.spawnSync(["git", "commit", "-q", "--allow-empty", "-m", "root"], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  const wt = join(cwd, "..", "tracker-wt-run_0badcafe-task");
  Bun.spawnSync(["git", "worktree", "add", "-q", wt], { cwd });
  put("task", frontmatter("next: implement\nclaimed-by: task-worker (run_0badcafe)"));
  expect(run("check").out).toBe("ok\n");
  expect(run("frontier").out).toBe("");
  Bun.spawnSync(["git", "worktree", "remove", "--force", wt], { cwd });
  rmSync(join(cwd, ".git"), { recursive: true, force: true });
  put("task", frontmatter("next: implement"));
}, 30_000);

test("outline maps each linked bullet to its issue, flags unlinked intent among linked bullets, and lists open issues no bullet covers", () => {
  put("task", frontmatter("next: implement\npart-of: \"[[projects/fixture/issues/blocker]]\""));
  put("loose", frontmatter("next: grill"));
  put("blocker", frontmatter("next: wait"));
  rmSync(join(issues, "archive/blocker.md"), { force: true });
  const out = run("outline").out;
  expect(out).toContain("5: the blocker —  blocker  [wait]");
  expect(out).toContain("6: a note with no issue  [no issue]");
  expect(out).not.toContain("prose that links nothing");
  expect(out).toContain("uncovered: loose  [grill] p3");
  expect(out).not.toContain("uncovered: task");
  rmSync(join(issues, "loose.md"));
  put("task", frontmatter("next: implement"));
}, 30_000);
