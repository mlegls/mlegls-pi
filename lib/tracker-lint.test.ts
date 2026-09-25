import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cached, refresh, context } from "./tracker-lint.ts";
import encounter from "./fixtures/tracker-lint-browser-drive.json";

// Replay the maintainer's old open-but-delivered browser-drive encounter, then
// edit its evidence as a tracker user would. Queries must not release or hide work.
test("delivery signal is advisory, cached, and stale when its evidence changes", async () => {
  const root = mkdtempSync(join(tmpdir(), "tracker-lint-"));
  const dir = join(root, "docs/issues");
  mkdirSync(dir, { recursive: true });
  const issue = { slug: "computer-browser-drive", file: join(dir, "computer-browser-drive.md"), blockedBy: [] };
  writeFileSync(issue.file, encounter.source);
  const all = new Map([[issue.slug, issue]]);
  try {
    expect(cached(issue, all, dir).status).toBe("missing");
    const report = await refresh(issue, all, dir, async (input, questions) => {
      expect(questions.parent).toBeUndefined();
      expect(JSON.stringify(input)).toContain("done 2026-09-21");
      return encounter.judgments;
    });
    expect(report.status).toBe("fresh");
    const finding = report.entry!.findings.find(f => f.kind === "completed")!;
    expect(finding.probability).toBeGreaterThan(0.5);
    expect(encounter.source).toContain(finding.evidence!.quote);
    const offline = async (): Promise<never> => { throw Error("offline"); };
    expect((await refresh(issue, all, dir, offline)).status).toBe("fresh");
    const cli = resolve(import.meta.dir, "../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
    const query = () => Bun.spawnSync([process.execPath, cli, "frontier", "--json"], { cwd: root });
    const first = JSON.parse(query().stdout.toString()).issues[0];
    expect(first.slug).toBe(issue.slug);
    expect(first.lint.status).toBe("fresh");
    expect(first.frontier).toBe(true);
    writeFileSync(join(root, "docs/evidence.md"), "The product-story replay remains unmeasured.");
    writeFileSync(issue.file, encounter.source + "\n[Evidence](../evidence.md)\n");
    expect(context(issue, all, dir).excerpts.some(s => s.file.endsWith("evidence.md"))).toBe(true);
    expect(cached(issue, all, dir).status).toBe("stale");
    const failed = await refresh(issue, all, dir, offline);
    expect(failed.status).toBe("error");
    expect(failed.entry?.at).toBe(report.entry?.at);
    const second = JSON.parse(query().stdout.toString()).issues[0];
    expect(second.frontier).toBe(true);
    expect(second.lint.status).toBe("stale");
    const before = context(issue, all, dir).hash;
    writeFileSync(join(root, "docs/evidence.md"), "The product-story replay is now recorded.");
    expect(context(issue, all, dir).hash).not.toBe(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// A closed issue is not asked whether it is fulfilled or superseded; its own text's residuals still are.
test("a done issue's lint asks only about its text", async () => {
  const root = mkdtempSync(join(tmpdir(), "tracker-lint-done-"));
  const dir = join(root, "docs/issues");
  mkdirSync(dir, { recursive: true });
  const issue = { slug: "closed", file: join(dir, "closed.md"), blockedBy: [] };
  writeFileSync(issue.file, "---\nstage: done\n---\nDelivered 2026-09-21.\n");
  try {
    const asked: string[] = [];
    await refresh(issue, new Map([[issue.slug, issue]]), dir, async (_input, questions) => { asked.push(...Object.keys(questions)); return {}; }, { done: true });
    expect(asked.filter(k => !k.endsWith("Evidence")).sort()).toEqual(["journal", "theory", "unowned"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
