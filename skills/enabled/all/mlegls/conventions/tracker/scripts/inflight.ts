// Derived reservations from unfinished reconciler runs (including pending landings),
// dispatch receipts and issue-named worktree branches. Never written back.
// A slug with entries is treated as claimed. TRACKER_NO_INFLIGHT=1 disables the overlay.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const git = (cwd: string, ...args: string[]) => {
  const p = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return p.status === 0 ? p.stdout.trim() : null;
};

// A reconciler's state (lib/reconcile, <git-common-dir>/reconcile/<root>.json) names every node it is
// carrying; unfinished state whose pid is gone is a stalled run nothing advances.
interface Run { root: string; cwd?: string; land?: string; target?: string; pr?: { path: string; repository: string; baseBranch: string; phase: string; url?: string }; landed?: Record<string, { into: string; head: string; at: string }>; pid?: number; finished?: string; chains?: Record<string, { phase: string; held?: boolean; handle?: { handle?: string } }> }

function runs(common: string): Run[] {
  const d = join(common, "reconcile");
  if (!existsSync(d)) return [];
  const out: Run[] = [];
  for (const n of readdirSync(d)) {
    if (!n.endsWith(".json")) continue;
    try { out.push(JSON.parse(readFileSync(join(d, n), "utf8")) as Run); } catch {}
  }
  return out;
}
const alive = (pid?: number) => { try { if (pid) { process.kill(pid, 0); return true; } } catch {} return false; };

export function inflight(issuesDir: string, done: (slug: string) => boolean): Map<string, string[]> {
  const found = new Map<string, string[]>();
  if (process.env.TRACKER_NO_INFLIGHT) return found;
  const add = (slug: string, what: string) => { const l = found.get(slug) ?? []; if (!l.includes(what)) l.push(what); found.set(slug, l); };
  const top = git(issuesDir, "rev-parse", "--show-toplevel");
  const commonRel = git(issuesDir, "rev-parse", "--git-common-dir");
  if (!top || !commonRel) return found;
  const common = resolve(issuesDir, commonRel);
  const list = git(issuesDir, "worktree", "list", "--porcelain") ?? "";
  const trees = list.split("\n\n").map(b => ({ path: b.match(/^worktree (.+)$/m)?.[1], head: b.match(/^HEAD (\w+)$/m)?.[1], branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1] })).filter(t => t.path && t.head);
  const main = trees[0];
  if (!main?.head) return found;

  for (const r of runs(common)) {
    if (r.finished) continue;
    const how = alive(r.pid) ? "" : " (stalled: reconciler for " + r.root + " not running)";
    const pr = (r.land ?? "local") !== "local" ? r.pr : undefined;
    const target = r.target ?? (pr ? "github:" + pr.repository + ":" + pr.baseBranch : r.cwd);
    const prStatus = pr ? " (" + r.land + ", " + pr.phase + (pr.url ? ", " + pr.url : "") + ", target " + target + ")" : "";
    if (!done(r.root)) add(r.root, "reconciling subtree" + prStatus + how);
    for (const [slug, entry] of Object.entries(r.landed ?? {})) if (!done(slug))
      add(slug, (pr && entry.into === pr.path ? "landed in PR staging (awaiting " + target + ")" + prStatus : entry.into === target ? "landed in " + (pr ? target : "owner checkout") + " (awaiting close)" : "landed in " + entry.into + " (awaiting target)") + how);
    for (const [slug, c] of Object.entries(r.chains ?? {})) if (!done(slug))
      add(slug, "reconciling " + c.phase + (c.handle?.handle ? " by " + c.handle.handle : "") + (c.held ? " (held)" : "") + how);
  }

  // Workers lib/dispatch.ts recorded: live while their worktree exists. A reconciler's workers are recorded
  // too and read the same.
  const ledger = join(common, "ab-dispatch");
  if (existsSync(ledger)) for (const n of readdirSync(ledger)) {
    try {
      const d = JSON.parse(readFileSync(join(ledger, n), "utf8")) as { issue?: string | null; path?: string; agent?: string; run?: string };
      if (!d.issue || !d.path || !existsSync(d.path) || done(d.issue)) continue;
      const head = git(d.path, "rev-parse", "HEAD");
      const ahead = head ? Number(git(issuesDir, "rev-list", "--count", main.head + ".." + head) ?? 0) : 0;
      add(d.issue, "dispatched " + (d.agent ?? "?") + " (" + d.run + (ahead ? ", +" + ahead : ", no commits yet") + ")");
    } catch {}
  }

  for (const t of trees.slice(1)) {
    if (!t.branch || t.head === main.head) continue;
    const ahead = Number(git(issuesDir, "rev-list", "--count", main.head + ".." + t.head) ?? 0);
    if (!ahead) continue;
    const leaf = basename(t.branch);
    if (!done(leaf)) add(leaf, "branch " + t.branch + " +" + ahead);
  }
  return found;
}
