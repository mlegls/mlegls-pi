/** The Obsidian plugin's vault-wide model (extensions/obsidian-tracker/model.ts) against fixtures, the live vault, and the CLI.
 * TRACKER_VAULT=/path/to/vault bun test lib/tracker-views.test.ts
 * Optional TRACKER_PROJECT=/path/to/project compares snapshot --json with the same notes.
 */
import { expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { model } from "../extensions/obsidian-tracker/model.ts";

const vault = process.env.TRACKER_VAULT ?? join(homedir(), "obsidian");
const available = existsSync(join(vault, "projects"));
const smoke = test;
const scripts = resolve(import.meta.dir, "../skills/enabled/all/mlegls/conventions/tracker/scripts");
const yaml = createRequire(join(scripts, "package.json"))("yaml");
const page = (slug: string, fm: Record<string, unknown>, project = "concept") => ({ path: "projects/" + project + "/issues/" + slug + ".md", frontmatter: fm });
const link = (slug: string) => "[[projects/concept/issues/" + slug + "]]";
const slugs = (xs: any[]) => xs.map((i) => i.slug).sort();

smoke("ready siblings survive a parent's shaping residual; own and subtree differ", () => {
  const pages = [page("parent", { stage: "goal", assignee: "human", priority: 1 }),
    page("ready", { stage: "ticket", assignee: "agent", "part-of": link("parent") }),
    page("later", { stage: "idea", assignee: "human", "part-of": link("parent") })];
  const m = model(pages);
  expect(slugs(m.frontier)).toEqual(["ready"]);
  expect(slugs(m.mine)).toEqual(["later", "parent"]);
  expect(m.issues.get("projects/concept/issues/parent").effectiveStage).toBe("idea");
  expect(m.frontier[0].priority_).toBe(2.5);
  expect(model([page("unassigned", { stage: "ticket" })]).frontier).toHaveLength(0);
});

smoke("compound constraints, omission, blockers, claims, deferred and done stay distinct", () => {
  const pages = [page("parent", {}),
    page("ready", { stage: "spec", assignee: "agent:fill, model:zai/glm-5.3-flash:high", "part-of": link("parent") }),
    page("done", { stage: "done", "part-of": link("parent") })];
  expect(slugs(model(pages).frontier)).toContain("parent");
  const constrained = (extra: Record<string, unknown>) => model([pages[0], page("ready", { stage: "spec", assignee: "model:zai/glm-5.3-flash:high, agent:fill", "part-of": link("parent"), ...extra }), pages[2]]);
  expect(constrained({ "blocked-by": [link("missing")] }).frontier).toHaveLength(0);
  expect(constrained({ "claimed-by": "session:recorded-not-guessed-live" }).frontier).toHaveLength(0);
  expect(constrained({ priority: 4 }).frontier).toHaveLength(0);
  expect(model([page("deferred", { stage: "ticket", assignee: "agent", priority: 4 })], { includeDeferred: true }).frontier).toHaveLength(1);
  expect(constrained({ stage: null }).invalid).toHaveLength(1);
  expect(constrained({ assignee: "agent:fill, agent:fill" }).frontier).toHaveLength(0);
  expect(model([page("parent", { stage: "done" }), pages[1]]).done).toHaveLength(0);
  expect(model([page("done", { stage: "done" }), page("archive/archived", { stage: "done" })]).done).toHaveLength(1);
  expect(model([page("legacy", { next: "implement" }, "other")]).frontier).toHaveLength(0);
  expect(model([page("index", { stage: "ticket", assignee: "agent" })]).issues.size).toBe(0);
});

smoke("scope scheduling ignores internal edges, rejects cycles and preserves own mine filters", () => {
  const base = [page("parent", {}), page("a", { stage: "ticket", assignee: "agent", "part-of": link("parent"), "blocked-by": [link("b")] }), page("b", { stage: "ticket", assignee: "agent", "part-of": link("parent") })];
  expect(slugs(model(base).frontier)).toEqual(["b", "parent"]);
  expect(model([base[0], page("child", { stage: "ticket", assignee: "agent", "part-of": link("parent"), "blocked-by": [link("parent")] })]).frontier).toHaveLength(0);
  expect(model([...base.slice(0, 2), page("b", { stage: "ticket", assignee: "agent", "part-of": link("parent"), "blocked-by": [link("a")] })]).frontier).toHaveLength(0);
  expect(model([page("mine", { stage: "goal", assignee: "human", "blocked-by": [link("missing")] })]).mine).toHaveLength(0);
  expect(model([page("mine", { stage: "goal", assignee: "human", "claimed-by": "historic-claim" })]).mine).toHaveLength(0);
  expect(model([page("archive/old", { stage: "done" }), page("live", { stage: "ticket", assignee: "agent", "part-of": link("archive/old") })]).invalid).toHaveLength(1);
});

function currentPages() {
  const pages: ReturnType<typeof page>[] = [];
  const projects = join(vault, "projects");
  for (const project of readdirSync(projects, { withFileTypes: true }).filter((p) => statSync(join(projects, p.name)).isDirectory())) {
    const dir = join(projects, project.name, "issues");
    if (!existsSync(dir)) continue;
    for (const prefix of ["", "archive/"]) {
      if (!existsSync(join(dir, prefix))) continue;
      for (const file of readdirSync(join(dir, prefix)).filter((f) => f.endsWith(".md"))) {
        const text = readFileSync(join(dir, prefix, file), "utf8");
        const fm = text.match(/^---\r?\n([^]*?)\r?\n---/);
        pages.push(page(prefix + file.slice(0, -3), fm ? yaml.parse(fm[1]) ?? {} : {}, project.name));
      }
    }
  }
  return pages;
}

(available ? test : test.skip)("current vault model loads", () => {
  const m = model(currentPages());
  expect(m.issues.size).toBeGreaterThan(0);
  expect(m.frontier.every((i) => !i.legacy && i.subtreeReady && !i.claims.length && !i.openBlockers.length)).toBe(true);
  console.log(JSON.stringify({ issues: m.issues.size, frontier: m.frontier.length, mine: m.mine.length, done: m.done.length, legacy: m.legacy.length, invalid: slugs(m.invalid) }));
});

(available && process.env.TRACKER_PROJECT ? test : test.skip)("CLI snapshot parity against selected project vault", () => {
  const project = basename(process.env.TRACKER_PROJECT!);
  const result = Bun.spawnSync(["bun", join(scripts, "issues.ts"), "snapshot", "--json"], { cwd: process.env.TRACKER_PROJECT });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const snapshot = JSON.parse(result.stdout.toString());
  const m = model(currentPages());
  for (const i of snapshot.issues) {
    const view = [...m.issues.values()].find((v: any) => v.project === project && v.slug === i.slug && v.archived === i.archived) as any;
    expect(view, i.slug).toBeDefined();
    expect(view.ownStage ?? null, i.slug).toBe(i.ownStage);
    expect(view.effectiveStage, i.slug).toBe(i.effectiveStage);
    expect(view.subtreeReady, i.slug).toBe(i.ready);
    expect(view.priority ?? null, i.slug).toBe(i.priority);
    expect(Boolean(view.agentEligible && !view.deferred), String(i.slug)).toBe(i.frontier);
    expect(Boolean(view.subtreeDone && !view.archived), String(i.slug)).toBe(i.done);
    const blockers: string[] = view.openBlockers.map((id: string) => id.split("/").at(-1)).sort();
    expect(blockers, String(i.slug)).toEqual([...i.blockers].sort());
  }
  for (const kind of ["frontier", "mine", "done"]) {
    const selected = Bun.spawnSync(["bun", join(scripts, "issues.ts"), kind, "--json"], { cwd: process.env.TRACKER_PROJECT });
    expect(selected.exitCode, selected.stderr.toString()).toBe(0);
    expect(slugs(m[kind as "frontier" | "mine" | "done"].filter((i) => i.project === project)), kind).toEqual(slugs(JSON.parse(selected.stdout.toString()).issues));
  }

});
