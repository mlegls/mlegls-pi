// First-use scratch vault; no canonical tracker or git checkout is mutated.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = mkdtempSync(join(tmpdir(), "tracker-indented-code-"));
const cli = resolve(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
try {
  mkdirSync(join(root, "docs/issues"), { recursive: true });
  writeFileSync(join(root, "docs/examples.md"), [
    "    [[missing-space-code]]",
    "",
    "\t[[missing-tab-code]]",
    "",
    "- A list item.",
    "",
    "    [[missing-list-continuation]]",
    "",
  ].join("\n"));
  const result = Bun.spawnSync([process.execPath, cli, "check"], {
    cwd: root, env: { ...process.env, TRACKER_VAULT: root },
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} finally {
  rmSync(root, { recursive: true, force: true });
}
