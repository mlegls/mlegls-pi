// Disposable tracker backends and a dispatch preflight. No native app, network, or worker launch.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { model } from "../../../extensions/obsidian-tracker/model.ts";
import { installFakeGh, issue, newState, ROLES } from "../../../lib/fixtures/fake-github.ts";

const repo = resolve(import.meta.dir, "../../..");
const cli = join(repo, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const assignee = process.argv[2] ?? "agent:auto-routine, model:fixture/example:high";
const root = mkdtempSync(join(tmpdir(), "assignee-first-use-"));
const vault = join(root, "vault"), github = join(root, "github");
const run = (cwd: string, args: string[]) => Bun.spawnSync(args, { cwd, env: process.env });
function tracker(cwd: string, slug: string) {
  const call = (...args: string[]) => run(cwd, [process.execPath, cli, ...args]);
  const read = () => {
    const r = call("fields", slug, "--json");
    if (r.exitCode) throw new Error(r.stderr.toString().trim());
    return JSON.parse(r.stdout.toString()).assignee;
  };
  console.log(`${slug} seeded: ${read()}`);
  const update = call("update", slug, "--fields", JSON.stringify({ assignee }));
  console.log(update.exitCode ? update.stderr.toString().trim() : `${slug} saved: ${read()}`);
}

try {
  delete process.env.PI_WM_RUN;
  process.env.PI_AGENTS_DIR = join(repo, "agents");
  const { dispatch } = await import("../../../lib/dispatch.ts");
  mkdirSync(join(vault, "docs/issues"), { recursive: true });
  writeFileSync(join(vault, "docs/issues/vault-issue.md"), "---\nstage: ticket\nassignee: agent\n---\n\nFirst use.\n");
  mkdirSync(join(github, "docs/agents"), { recursive: true });
  for (const args of [["init", "-q"], ["remote", "add", "origin", "https://github.com/fixture/tracker.git"]]) {
    const result = run(github, ["git", ...args]);
    if (result.exitCode) throw new Error(result.stderr.toString());
  }
  writeFileSync(join(github, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: fixture/tracker\n");
  writeFileSync(join(github, "docs/agents/triage-labels.md"), ["| Role | Label |", "| --- | --- |", ...ROLES.map(role => `| ${role} | ${role} |`)].join("\n"));
  const bin = join(root, "bin");
  const git = Bun.which("git");
  if (!git) throw new Error("Git is required");
  installFakeGh(bin, newState([issue(1)]));
  symlinkSync(git, join(bin, "git"));
  symlinkSync(process.execPath, join(bin, "bun"));
  process.env.PATH = bin;

  console.log("selector:", JSON.stringify(assignee));
  tracker(vault, "vault-issue");
  tracker(github, "gh-1");
  const view = model([{ path: "projects/fixture/issues/example.md", frontmatter: { stage: "ticket", assignee } }]);
  console.log("Obsidian model:", { invalid: !!view.invalid.length, frontier: !!view.frontier.length, mine: !!view.mine.length });
  const runName = "assignee-first-use";
  try {
    const receipt = await dispatch([{ handle: "example", issue: "vault-issue", assignee, agent: "auto-routine", model: "fixture/example", effort: "high", prompt: "First use." }],
      { cwd: vault, run: runName, maxConcurrent: 1, active: [{ handle: "occupied", run: runName, path: root }] });
    console.log(`dispatch: accepted preflight; ${receipt.pending.length} pending (slot occupied)`);
  } catch (error) { console.log(String(error)); }
} finally { rmSync(root, { force: true, recursive: true }); }
