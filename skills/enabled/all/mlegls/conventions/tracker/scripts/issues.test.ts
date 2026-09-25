import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  const p = Bun.spawnSync([process.execPath, cli, ...cmd.split(" ")], { cwd, env: { ...process.env, TRACKER_VAULT: vault } });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}
mkdirSync(join(issues, "archive"), { recursive: true });
mkdirSync(join(issues, "attachments"));
put("attachments/evidence", "A note, not an issue.\n");
put("blocker", frontmatter("stage: idea"));
afterAll(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(vault, { recursive: true, force: true }); });

test("cross-project evidence links resolve through the vault, not a local namesake", () => {
  const other = join(vault, "projects/other");
  mkdirSync(other, { recursive: true });
  writeFileSync(join(other, "delivery.md"), "# Contract\n");
  const evidence = join(cwd, "docs/migration.md");
  writeFileSync(evidence, "[[projects/other/delivery#Contract]]\n[[projects/other/blocker]]\n");
  const checked = run("check");
  expect(checked.out).not.toContain("delivery");
  expect(checked.out).toContain("[[projects/other/blocker]] does not exist");
  rmSync(evidence);
  symlinkSync(join(cwd, "docs"), join(vault, "projects/fixture"));
  writeFileSync(join(cwd, "docs/issues/archive/gone.md"), "---\nstage: done\n---\n");
  writeFileSync(evidence, "[[projects/fixture/issues/gone]] [[projects/fixture/issues/gone|alias]]\n");
  const fixed = run("check");
  expect(fixed.out).toContain("fixed migration.md: [[projects/fixture/issues/gone]] -> [[projects/fixture/issues/archive/gone]]");
  expect(fixed.out).not.toContain("does not exist");
  expect(readFileSync(evidence, "utf8")).toBe("[[projects/fixture/issues/archive/gone]] [[projects/fixture/issues/archive/gone|alias]]\n");
  rmSync(evidence);
  rmSync(join(cwd, "docs/issues/archive/gone.md"));
  rmSync(join(vault, "projects/fixture"));
});

test("format-equivalent dependencies preserve all queries", () => {
  for (const next of ["implement", "grill"]) {
    put("task", frontmatter(`stage: ${next === "implement" ? "ticket" : "goal"}
assignee: ${next === "implement" ? "agent" : "human"}\nblocked-by: [${blocker}]`));
    const baseline = commands.map(run);
    expect(baseline[0].out).toContain("prerequisites:blocker");
    expect(baseline[1].out).toBe("");
    expect(baseline[2].out).toBe("");
    expect(baseline[3]).toEqual({ code: 0, out: "ok\n", err: "" });
    for (const field of [
      `blocked-by: [\n  ${blocker}, # retained edge\n]`,
      `blocked-by:\n  - ${blocker}`,
      "blocked-by: ['[[projects/fixture/issues/blocker]]'] # comment",
    ]) {
      const text = frontmatter(`stage: ${next === "implement" ? "ticket" : "goal"}
assignee: ${next === "implement" ? "agent" : "human"}\n${field}`);
      for (const formatted of [text, "\uFEFF" + text.replaceAll("\n", "\r\n")]) {
        put("task", formatted);
        expect(commands.map(run)).toEqual(baseline);
      }
    }
    for (const field of ["", "\nblocked-by: []"]) {
      put("task", frontmatter(`stage: ${next === "implement" ? "ticket" : "goal"}
assignee: ${next === "implement" ? "agent" : "human"}${field}`));
      expect(run(next === "implement" ? "frontier" : "mine").out).toContain("task");
      expect(run("check").out).toBe("ok\n");
    }
  }
}, 30_000);

test("invalid frontmatter fails every query with a filename and no partial output", () => {
  const invalid = [
    "no frontmatter", "---\nstage: ticket\nassignee: agent", "---\nstage: ticket\nassignee: agent\n---not-a-delimiter",
    ...[
      "", "[]", "stage: ticket\nassignee: agent\nstage: idea", "next: [", "next: bogus", "priority: 1",
      "next: null", "next: [implement]", "stage: ticket\nassignee: agent\npriority: '1'",
      "stage: ticket\nassignee: agent\npriority: 5", "stage: ticket\nassignee: agent\nclaimed-by: null",
      "stage: ticket\nassignee: agent\nclaimed-by: []", "stage: ticket\nassignee: agent\nclaimed-by: ''",
      "stage: ticket\nassignee: agent\npart-of: null", "stage: ticket\nassignee: agent\npart-of: blocker",
      "stage: ticket\nassignee: agent\npart-of: '[[blocker]]'", "stage: ticket\nassignee: agent\nblocked-by: null",
      `stage: ticket\nassignee: agent\nblocked-by: ${blocker}`, `stage: ticket\nassignee: agent\nblocked-by: [${blocker}, 1]`,
      "stage: ticket\nassignee: agent\nblocked-by: ['[[projects/fixture/issues/blocker#heading]]']",
      "stage: ticket\nassignee: agent\nblocked-by:\n  - after: 2026-10-01", "stage: ticket\nassignee: agent\nblocked-by: ['someday']",
      "stage: ticket\nassignee: agent\nblocked-by: [\n  '[[projects/fixture/issues/blocker]]'\n",
      "stage: ticket\nassignee: agent\nblocked-by: []\nblocked-by: []",
      "stage: ticket\nassignee: agent\nother: &a [1]\nblocked-by: *a",
      "next: &a implement\nother: *a", "next: !!str implement", "next: !unknown implement",
      "stage: ticket\nassignee: agent\n<<: {priority: 1}", "stage: ticket\nassignee: agent\n1: value",
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
  put("task", frontmatter(`stage: ticket\nassignee: agent\nblocked-by: [\n  ${blocker}\n]`));
  rmSync(join(issues, "blocker.md"));
  expect(run("check").out).toContain("blocked-by blocker does not exist");
  expect(run("check").code).toBe(1);
  expect(run("frontier").out).toBe("");
  put("archive/blocker", frontmatter("stage: done"));
  expect(run("check").out).toContain("blocked-by blocker is done; remove it");
  expect(run("check").code).toBe(1);
  expect(run("frontier").out).toContain("task");
}, 30_000);

test("unverified claims conservatively reserve execution", () => {
  put("task", frontmatter("stage: ticket\nassignee: agent\nclaimed-by: session:missing"));
  expect(run("frontier").out).toBe("");
  expect(JSON.parse(run("snapshot").out).issues.find((i: any) => i.slug === "task").claims).toEqual([{slug: "task", claimedBy: "session:missing"}]);
  put("task", frontmatter("stage: ticket\nassignee: agent"));
});

test("tagged guards are opaque: they block until removed and never resolve on their own", () => {
  put("task", frontmatter("stage: ticket\nassignee: agent\nblocked-by:\n  - \"after: 2000-01-01\""));
  put("ask", frontmatter("stage: goal\nassignee: human\nblocked-by: ['merged: https://github.com/o/r/pull/1']"));
  expect(run("frontier").out).toBe("");
  expect(run("mine").out).toBe("");
  expect(run("tree").out).toContain('guard:"after: 2000-01-01"');
  expect(JSON.parse(run("snapshot").out).issues.find((i: any) => i.slug === "task")).toMatchObject({ blockedBy: [], guards: ["after: 2000-01-01"], blockers: ["after: 2000-01-01"] });
  expect(run("check")).toEqual({ code: 0, out: "ok\n", err: "" });
  put("task", frontmatter("stage: ticket\nassignee: agent"));
  put("ask", frontmatter("stage: goal\nassignee: human"));
  expect(run("frontier").out).toContain("task");
  rmSync(join(issues, "ask.md"));
});

test("outline maps each linked bullet to its issue, flags unlinked intent among linked bullets, and lists open issues no bullet covers", () => {
  put("task", frontmatter("stage: ticket\nassignee: agent\npart-of: \"[[projects/fixture/issues/blocker]]\""));
  put("loose", frontmatter("stage: goal\nassignee: human"));
  put("blocker", frontmatter("stage: idea"));
  rmSync(join(issues, "archive/blocker.md"), { force: true });
  const out = run("outline").out;
  expect(out).toContain("5: the blocker —  blocker  [own:idea effective:idea]");
  expect(out).toContain("6: a note with no issue  [no issue]");
  expect(out).not.toContain("prose that links nothing");
  expect(out).toContain("uncovered: loose  [own:goal effective:goal assignee:human] p?");
  expect(out).not.toContain("uncovered: task");
  rmSync(join(issues, "loose.md"));
  put("task", frontmatter("stage: ticket\nassignee: agent"));
}, 30_000);

// Encounter: selecting a spec must reserve its whole contract without hiding a ready sibling.
test("subtree readiness, assignment, dependencies, scheduling and review remain separate", () => {
  const link = (slug: string) => '"[[projects/fixture/issues/' + slug + ']]"';
  const snapshot = () => JSON.parse(run("snapshot --json").out).issues;
  const row = (slug: string) => snapshot().find((i: any) => i.slug === slug);
  put("scope", frontmatter("stage: done\nassignee: human\npriority: 1"));
  put("child", frontmatter('stage: ticket\nassignee: "agent:fill, model:zai/glm-5.3-flash:high"\npart-of: ' + link("scope")));
  expect(row("scope").effectiveStage).toBe("ticket");
  expect(row("scope").frontier).toBe(true);
  expect(row("child").priority).toBe(null);
  put("early", frontmatter('stage: idea\nassignee: human\npart-of: ' + link("scope")));
  expect(row("scope").ready).toBe(false);
  expect(row("child").frontier).toBe(true);
  expect(run("mine").out).toContain("early");
  put("early", frontmatter('stage: ticket\nassignee: human\npart-of: ' + link("scope")));
  expect(row("scope").ready).toBe(true);
  expect(row("scope").eligible).toBe(false);
  put("early", frontmatter('stage: ticket\nassignee: agent\npriority: 4\npart-of: ' + link("scope")));
  expect(row("scope").frontier).toBe(false);
  expect(JSON.parse(run("frontier scope --json").out).issues.map((i: any) => i.slug)).toContain("scope");
  put("early", frontmatter('stage: ticket\nassignee: agent\nblocked-by: [' + link("blocker") + ']\npart-of: ' + link("scope")));
  expect(row("scope").blockers).toContain("blocker");
  expect(row("scope").frontier).toBe(false);
  put("early", frontmatter('stage: ticket\nassignee: agent\nblocked-by: [' + link("child") + ']\npart-of: ' + link("scope")));
  expect(row("scope").frontier).toBe(true);
  expect(row("early").frontier).toBe(false);
  put("early", frontmatter('stage: ticket\npart-of: ' + link("scope")));
  expect(row("scope").eligible).toBe(false);
  put("early", frontmatter('stage: done\npart-of: ' + link("scope")));
  put("scope", frontmatter("assignee: agent"));
  expect(row("scope").ownStage).toBe(null);
  put("archive/retired", frontmatter('stage: done\npart-of: ' + link("scope")));
  expect(row("scope").effectiveStage).toBe("ticket");
  rmSync(join(issues, "archive/retired.md"));
  put("early", frontmatter('stage: done\nclaimed-by: session:reserved\npart-of: ' + link("scope")));
  expect(row("scope").frontier).toBe(false);
  put("early", frontmatter('stage: done\npart-of: ' + link("scope")));
  expect(row("scope").effectiveStage).toBe("ticket");
  put("child", frontmatter('stage: done\npart-of: ' + link("scope")));
  expect(run("done").out).toContain("scope");
  expect(row("scope").frontier).toBe(false);
  for (const slug of ["scope", "child", "early"]) rmSync(join(issues, slug + ".md"));
});

test("legacy is readable but never translated; selectors and structural omissions fail closed", () => {
  put("legacy", frontmatter("next: implement"));
  writeFileSync(join(dir, "docs/issues/sent.md"), t(""));
  mkdirSync(join(dir, ".git/ab-dispatch"));
  writeFileSync(join(dir, ".git/ab-dispatch/r-sent.json"), JSON.stringify({ run: "root", handle: "w", issue: "sent", path: dir + "-wt2", agent: "fedcba987654" }));
  writeFileSync(join(dir, ".git/ab-dispatch/r-gone.json"), JSON.stringify({ run: "root", handle: "g", issue: "free", path: dir + "-nowhere", agent: "x" }));
  const snap = JSON.parse(run("frontier --json").out);
  expect(snap.legacy.map((i: any) => i.slug)).toContain("legacy");
  expect(snap.issues.map((i: any) => i.slug)).not.toContain("legacy");
  expect(run("tree").out).toContain("legacy next:implement");
  for (const metadata of ["stage: null", "stage: archived", "assignee: agent", "stage: ticket\nassignee: model:fill", "stage: ticket\nassignee: fill", "stage: ticket\nassignee: agent:bad/name", 'stage: ticket\nassignee: "human, model:a/b:high"', 'stage: ticket\nassignee: "agent:fill, agent:research"', "next: implement\nstage: ticket", 'stage: ticket\npart-of: "[[projects/fixture/issues/invalid]]"']) {
    put("invalid", frontmatter(metadata));
    expect(run("snapshot").code, metadata).not.toBe(0);
    expect(run("snapshot").out).toBe("");
  }
  rmSync(join(issues, "invalid.md"));
  rmSync(join(issues, "legacy.md"));
});

test("human shaping uses own residual constraints, and archive cannot parent live work", () => {
  put("shaping", frontmatter("stage: goal\nassignee: human"));
  put("subwork", frontmatter('stage: idea\nclaimed-by: session:busy\nblocked-by: ["[[projects/fixture/issues/blocker]]"]\npart-of: "[[projects/fixture/issues/shaping]]"'));
  expect(run("mine").out).toContain("shaping");
  put("shaping", frontmatter("stage: done\nassignee: human"));
  expect(run("mine").out).not.toContain("shaping");
  rmSync(join(issues, "shaping.md"));
  put("archive/shaping", frontmatter("stage: done\nassignee: human"));
  expect(run("check").out).toContain("subwork: live issue has archived parent shaping");
  rmSync(join(issues, "archive/shaping.md"));
  rmSync(join(issues, "subwork.md"));
});

test("historical provenance survives and duplicate identities fail before projection", () => {
  put("provenance", frontmatter("stage: idea\nauthor: run:run_efb5c58089d3"));
  expect(JSON.parse(run("snapshot").out).issues.find((i: any) => i.slug === "provenance").author).toBe("run:run_efb5c58089d3");
  put("archive/provenance", frontmatter("stage: done"));
  expect(run("snapshot").err).toContain("duplicate issue slug provenance");
  expect(run("snapshot").out).toBe("");
  rmSync(join(issues, "archive/provenance.md"));
  rmSync(join(issues, "provenance.md"));
});

test("a child cannot await completion of its own parent scope", () => {
  put("parent", frontmatter("assignee: agent"));
  put("child", frontmatter('stage: ticket\nassignee: agent\npart-of: "[[projects/test/issues/parent]]"\nblocked-by: ["[[projects/test/issues/parent]]"]'));
  expect(run("frontier").err).toContain("completion cycle");
});

/** A separate project, so a check reads only what the test puts there. */
function project(files: Record<string, string>, git = false) {
  const root = mkdtempSync(join(tmpdir(), "tracker-own-"));
  mkdirSync(join(root, "docs/issues"), { recursive: true });
  const sh = (...args: string[]) => Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root });
  const write = (fs: Record<string, string>) => { for (const [f, t] of Object.entries(fs)) writeFileSync(join(root, "docs", f), t); };
  write(files);
  if (git) { sh("init", "-q"); sh("add", "."); sh("commit", "-qm", "committed"); }
  const check = () => Bun.spawnSync([process.execPath, cli, "check"], { cwd: root, env: { ...process.env, TRACKER_VAULT: vault } }).stdout.toString();
  return { root, write, check, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("check names the child that lowers a spec, and a side friction log", () => {
  const p = project({
    "issues/shaped.md": frontmatter("stage: spec\nassignee: agent"),
    "issues/unshaped.md": frontmatter('stage: goal\nassignee: agent\npart-of: "[[projects/fixture/issues/shaped]]"'),
    "frictions.md": "- a one-liner\n",
  });
  const out = p.check();
  expect(out).toContain("shaped: own spec but effective goal through unshaped");
  expect(out).toContain("docs/frictions.md: frictions in a vault project are stage: idea issues");
  p.done();
}, 30_000);

test("a new uncommitted issue needs author provenance; committed history is left alone", () => {
  const p = project({ "issues/old.md": frontmatter("stage: idea") }, true);
  p.write({ "issues/new.md": frontmatter("stage: idea"), "issues/owned.md": frontmatter("stage: idea\nauthor: session:x") });
  const out = p.check();
  expect(out).toContain("new: new issue without author provenance");
  expect(out).not.toContain("old:");
  expect(out).not.toContain("owned:");
  p.done();
}, 30_000);

test("work in flight elsewhere leaves the frontier: supervise children, closes on branches, orphaned loops", () => {
  const t = (s: string) => frontmatter("stage: ticket\nassignee: agent") + s;
  const p = project({ "issues/closed.md": t(""), "issues/named.md": t(""), "issues/watched.md": t(""), "issues/orphan.md": t(""), "issues/free.md": t("") }, true);
  const dir = p.root;
  const sh = (cwd: string, ...args: string[]) => Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });
  sh(dir, "worktree", "add", "-q", "-b", "sup/closer", dir + "-wt1");
  writeFileSync(dir + "-wt1/docs/issues/closed.md", frontmatter("stage: done"));
  sh(dir + "-wt1", "commit", "-qam", "Close closed");
  sh(dir, "worktree", "add", "-q", "-b", "sup/named", dir + "-wt2");
  writeFileSync(dir + "-wt2/x", "x"); sh(dir + "-wt2", "add", "x"); sh(dir + "-wt2", "commit", "-qm", "work");
  mkdirSync(join(dir, ".git/ab-supervise"));
  const job = (id: string, status: string, slug: string, waiting?: string) => writeFileSync(join(dir, ".git/ab-supervise", id + ".json"), JSON.stringify({ id, type: "supervise", status, input: { ticket: "root-" + id, cwd: dir }, state: { children: { [slug]: { phase: "implement", waiting, handle: { agentId: "abcdef123456" } } }, integrated: [] } }));
  job("live", "running", "watched", "done with caveats");
  job("dead", "failed", "orphan");
  job("dropped", "running", "unhosted");
  writeFileSync(join(dir, "docs/issues/unhosted.md"), t(""));
  const state = mkdtempSync(join(tmpdir(), "ab-state-"));
  writeFileSync(join(state, "jobs.json"), JSON.stringify(["live", "dead"].map(id => join(dir, ".git/ab-supervise", id + ".json"))));
  const snap = JSON.parse(Bun.spawnSync([process.execPath, cli, "snapshot", "--json"], { cwd: dir, env: { ...process.env, AB_STATE: state } }).stdout.toString()).issues;
  const claim = (s: string) => snap.find((i: any) => i.slug === s).claims.map((c: any) => c.claimedBy).join();
  expect(claim("closed")).toContain("closed on sup/closer");
  expect(claim("named")).toContain("branch sup/named +1");
  expect(claim("watched")).toContain("supervised implement by abcdef12 (waiting: done with caveats)");
  expect(claim("orphan")).toContain("orphaned implement by abcdef12 (failed loop dead)");
  expect(claim("sent")).toContain("dispatched fedcba98 (root, +1)");
  expect(claim("unhosted")).toContain("orphaned implement by abcdef12 (unhosted loop dropped)");
  expect(snap.filter((i: any) => i.frontier).map((i: any) => i.slug)).toEqual(["free"]);
  rmSync(state, { recursive: true, force: true });
  const off = JSON.parse(Bun.spawnSync([process.execPath, cli, "snapshot", "--json"], { cwd: dir, env: { ...process.env, TRACKER_NO_INFLIGHT: "1" } }).stdout.toString()).issues;
  expect(off.filter((i: any) => i.frontier).length).toBe(7);
  rmSync(dir + "-wt1", { recursive: true, force: true }); rmSync(dir + "-wt2", { recursive: true, force: true });
  p.done();
}, 30_000);
