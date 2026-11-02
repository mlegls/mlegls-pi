// First-use fixture: run the checkout's tracker against an isolated, disposable vault.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = mkdtempSync(join(tmpdir(), "tracker-tree-synthetic-"));
const issues = join(root, "docs/issues");
const cli = resolve(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const link = (slug: string) => JSON.stringify("[[projects/synthetic/issues/" + slug + "]]");
const put = (slug: string, fields: string[]) => writeFileSync(join(issues, slug + ".md"), "---\n" + fields.join("\n") + "\n---\n");
const pad = (n: number) => String(n).padStart(2, "0");

try {
  mkdirSync(join(issues, "archive"), { recursive: true });
  // 10 roots, 100 branches, 1,900 leaves (100 archived): 2,010 output lines.
  for (let r = 0; r < 10; r++) {
    const rootSlug = "root-" + pad(r);
    put(rootSlug, ["stage: spec", "assignee: agent"]);
    for (let b = 0; b < 10; b++) {
      const branch = rootSlug + "-branch-" + pad(b);
      put(branch, ["stage: ticket", "assignee: agent", "part-of: " + link(rootSlug)]);
      for (let l = 0; l < 19; l++) {
        const leaf = branch + "-leaf-" + pad(l);
        const archived = l === 18;
        const fields = [r === 0 && b === 0 && l === 0 ? "next: implement" : "stage: " + (archived || l % 4 === 0 ? "done" : "ticket"), "assignee: agent", "part-of: " + link(branch)];
        if (!archived && l % 4 === 2) fields.push("blocked-by: [" + link(branch + "-leaf-" + pad(l - 1)) + "]");
        put((archived ? "archive/" : "") + leaf, fields);
      }
    }
  }
  const args = process.argv.slice(2);
  const result = Bun.spawnSync([process.execPath, cli, ...(args.length ? args : ["tree"])], {
    cwd: root,
    env: { ...process.env, TRACKER_NO_INFLIGHT: "1" },
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = result.exitCode;
} finally {
  rmSync(root, { recursive: true, force: true });
}
