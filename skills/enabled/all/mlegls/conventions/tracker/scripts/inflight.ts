// Work in flight that the checked-out docs/issues/ cannot show. Supervision integrates upward, so a leaf's
// close lands on its supervisor's branch and reaches the main checkout only when the root integrates;
// meanwhile the tracker would offer that leaf again. Three sources, all derived, never written back:
//   - ab supervise job records under the repository's git dir: each running loop's children, and the
//     children of the latest failed/stopped loop per ticket (orphaned: their agents run unsupervised);
//   - workers lib/dispatch.ts recorded under the git dir (ab-dispatch/), while their worktree lives;
//   - worktree branches ahead of the main checkout: a branch named for the issue, or one whose tip
//     already has the issue at stage: done.
// A slug with entries is treated as claimed. TRACKER_NO_INFLIGHT=1 disables the overlay.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const git = (cwd: string, ...args: string[]) => {
  const p = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return p.status === 0 ? p.stdout.trim() : null;
};

interface Job { id: string; type: string; status: string; input?: { ticket?: string; cwd?: string };
  state?: { children?: Record<string, { phase: string; waiting?: string | null; unreachable?: boolean | null; handle?: { agentId?: string; handle?: string } }>; integrated?: string[] } }

// The ab daemon's index names the job records it still hosts; a record it dropped (a lost worktree, a
// daemon state reset) can still say running on disk while nothing runs it.
function hosted(): Set<string> | null {
  const index = join(process.env.AB_STATE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab"), "jobs.json");
  try { return new Set((JSON.parse(readFileSync(index, "utf8")) as string[]).map(f => { try { return realpathSync(f); } catch { return f; } })); } catch { return null; }
}

function jobs(common: string): { job: Job; mtime: number }[] {
  const live = hosted();
  const dirs = [join(common, "ab-supervise")];
  const wt = join(common, "worktrees");
  if (existsSync(wt)) for (const n of readdirSync(wt)) dirs.push(join(wt, n, "ab-supervise"));
  const out: { job: Job; mtime: number }[] = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const n of readdirSync(d)) {
      if (!n.endsWith(".json")) continue;
      const f = join(d, n);
      try {
        const job = JSON.parse(readFileSync(f, "utf8")) as Job;
        if (job.type !== "supervise") continue;
        if (job.status === "running" && live && !live.has(realpathSync(f))) job.status = "unhosted";
        out.push({ job, mtime: statSync(f).mtimeMs });
      } catch {}
    }
  }
  return out;
}

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
  const short = (id?: string) => (id ?? "?").slice(0, 8);

  const latest = new Map<string, { job: Job; mtime: number }>();
  for (const j of jobs(common)) {
    const t = j.job.input?.ticket ?? j.job.id;
    if (j.job.status === "running") {
      for (const [slug, c] of Object.entries(j.job.state?.children ?? {}))
        add(slug, "supervised " + c.phase + " by " + short(c.handle?.agentId ?? c.handle?.handle) + (c.unreachable ? " (unreachable)" : c.waiting ? " (waiting: " + c.waiting + ")" : ""));
    }
    if (!latest.has(t) || latest.get(t)!.mtime < j.mtime) latest.set(t, j);
    // Integrated into a supervisor's checkout that is not the main one: done there, not here yet.
    const cwd = j.job.input?.cwd;
    if (cwd && resolve(cwd) !== resolve(main.path!)) {
      const branch = trees.find(t => t.path && resolve(t.path) === resolve(cwd))?.branch;
      if (branch) for (const slug of j.job.state?.integrated ?? []) if (!done(slug)) add(slug, "integrated on " + branch);
    }
  }
  for (const [, { job }] of latest) if (job.status !== "running" && job.status !== "completed")
    for (const [slug, c] of Object.entries(job.state?.children ?? {}))
      add(slug, "orphaned " + c.phase + " by " + short(c.handle?.agentId ?? c.handle?.handle) + " (" + job.status + " loop " + job.id + ")");

  // Workers dispatched outside a loop (lib/dispatch.ts records them): live while their worktree exists and
  // its branch is ahead of the main checkout. A loop's own children are recorded too and read the same.
  const ledger = join(common, "ab-dispatch");
  if (existsSync(ledger)) for (const n of readdirSync(ledger)) {
    try {
      const d = JSON.parse(readFileSync(join(ledger, n), "utf8")) as { issue?: string | null; path?: string; agent?: string; run?: string };
      if (!d.issue || !d.path || !existsSync(d.path) || done(d.issue)) continue;
      const head = git(d.path, "rev-parse", "HEAD");
      const ahead = head ? Number(git(issuesDir, "rev-list", "--count", main.head + ".." + head) ?? 0) : 0;
      add(d.issue, "dispatched " + short(d.agent) + " (" + d.run + (ahead ? ", +" + ahead : ", no commits yet") + ")");
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
