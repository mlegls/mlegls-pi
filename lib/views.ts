// Deterministic project views: what a reader narrates over, and what a consumer reruns to see what changed.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export interface Snapshot { cwd: string; taken: string; views: Record<string, string> }

const tracker = fileURLToPath(new URL("../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts", import.meta.url));

function run(cwd: string, argv: string[]): string {
  const p = spawnSync(argv[0], argv.slice(1), { cwd, encoding: "utf8", timeout: 60_000 });
  if (p.error) return "[" + argv.join(" ") + ": " + p.error.message + "]";
  const err = p.stderr.trim().split("\n").filter(l => /error:|Error:/.test(l)).join("\n");
  return (p.stdout.trimEnd() + (err ? "\n[" + err + "]" : "")).trim() || "(none)";
}

/** Tracker frontier/mine/check/outline (see the tracker skill) and git state. Absence is reported in place. */
export function snapshot(cwd = process.cwd()): Snapshot {
  cwd = resolve(cwd);
  const issues = (cmd: string) => run(cwd, ["bun", tracker, cmd]);
  return { cwd, taken: new Date().toISOString(), views: {
    "git": run(cwd, ["git", "log", "--oneline", "-1", "--decorate"]) + "\n" + run(cwd, ["git", "status", "--short"]),
    "git worktrees": run(cwd, ["git", "worktree", "list"]),
    "tracker frontier (agent-ready, unblocked; stale-claim = claimed without a worktree)": issues("frontier"),
    "tracker mine (needs the user; priority, then unblocks)": issues("mine"),
    "tracker check": issues("check"),
    "outline (project note ↔ tracker)": issues("outline"),
  } };
}

export function format(s: Snapshot): string {
  return "Views taken " + s.taken + " in " + s.cwd + ":\n\n" +
    Object.entries(s.views).map(([name, text]) => "## " + name + "\n" + text).join("\n\n");
}

/** Lines added and removed per view since the earlier snapshot. */
export function diff(before: Snapshot, after: Snapshot): string {
  const out: string[] = [];
  for (const name of new Set([...Object.keys(before.views), ...Object.keys(after.views)])) {
    const a = new Set((before.views[name] ?? "").split("\n")), b = new Set((after.views[name] ?? "").split("\n"));
    const lines = [...[...a].filter(l => !b.has(l)).map(l => "- " + l), ...[...b].filter(l => !a.has(l)).map(l => "+ " + l)];
    if (lines.length) out.push("## " + name + "\n" + lines.join("\n"));
  }
  return out.length ? "Changed since " + before.taken + ":\n\n" + out.join("\n\n") : "Unchanged since " + before.taken + ".";
}
