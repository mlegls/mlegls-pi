// Work in flight that the checked-out docs/issues/ cannot show. The reconciler integrates upward, so a leaf's
// close lands on its parent's collector branch and reaches the main checkout only when the root integrates;
// meanwhile the tracker would offer that leaf again. Three sources, all derived, never written back:
//   - reconciler state under the repository's git dir: every node of an unfinished run (stalled when its
//     process is gone);
//   - workers lib/dispatch.ts recorded under the git dir (ab-dispatch/), while their worktree lives;
//   - worktree branches ahead of the main checkout: a branch named for the issue, or one whose tip
//     already has the issue at stage: done.
// A slug with entries is treated as claimed. TRACKER_NO_INFLIGHT=1 disables the overlay.
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const git = (cwd: string, ...args: string[]) => {
  const p = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return p.status === 0 ? p.stdout.trim() : null;
};

// A reconciler's state (lib/reconcile, <git-common-dir>/reconcile/<root>.json) names every node it is
// carrying; unfinished state whose pid is gone is a stalled run nothing advances.
interface Run { root: string; pid?: number; finished?: string; chains?: Record<string, { phase: string; held?: boolean; handle?: { handle?: string } }> }

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
    for (const [slug, c] of Object.entries(r.chains ?? {}))
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

  const issuesRel = relative(realpathSync(top), realpathSync(issuesDir));
  for (const t of trees.slice(1)) {
    if (!t.branch || t.head === main.head) continue;
    const ahead = Number(git(issuesDir, "rev-list", "--count", main.head + ".." + t.head) ?? 0);
    if (!ahead) continue;
    const leaf = basename(t.branch);
    if (!done(leaf)) add(leaf, "branch " + t.branch + " +" + ahead);
    const changed = (git(issuesDir, "diff", "--name-only", main.head + "..." + t.head, "--", ":/" + issuesRel) ?? "").split("\n").filter(f => f.endsWith(".md") && !f.includes("/attachments/"));
    for (const f of changed) {
      const slug = basename(f, ".md");
      if (done(slug)) continue;
      const text = git(issuesDir, "show", t.head + ":" + f);
      if (text && /^stage: done$/m.test(text.split(/^---$/m)[1] ?? "")) add(slug, "closed on " + t.branch);
    }
  }
  return found;
}
