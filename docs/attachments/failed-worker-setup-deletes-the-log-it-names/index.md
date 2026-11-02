# Failed worker setup: implementation trial

Independent acceptance: [operator drive, predictions and replayable checks](drive.md).

Nonvisual library/CLI change, based on 31026c8ce8feb059b0bfbfef8af1a4f99100c4d5.

## Prepared setup and entry point

Required environment: local Git, Bun and mise; no model, server, credentials or live bb daemon required for this rehearsal. The existing fake bb adapter isolates the thread runtime. The target is a newly created, disposable repository under /tmp, owned only by this command. Dependencies in the implementation checkout were already installed; the affected existing tests and typecheck completed successfully.

From the checkout containing this change, this command reaches the failed-setup surface, prints the exception and retained output, and removes its disposable target afterward:

~~~sh
bun --eval '
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newThread } from "./lib/thread/runtime";
import { fakeBb } from "./lib/thread/fake-bb";
const root = mkdtempSync("/tmp/retained-setup-");
const repo = join(root, "repo");
const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
try {
  for (const key of Object.keys(process.env)) if (/^(BB_|PI_WM_|TMUX)/.test(key)) delete process.env[key];
  process.env.MISE_TRUSTED_CONFIG_PATHS = root;
  fakeBb(root);
  mkdirSync(repo);
  git("init", "-b", "main");
  git("config", "user.name", "diagnostic");
  git("config", "user.email", "diagnostic@example.invalid");
  writeFileSync(join(repo, "mise.toml"), "[tasks.setup]\nrun = \"echo retained-failure-marker; exit 7\"\n");
  git("add", ".");
  git("commit", "-m", "seed");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await newThread({ cwd: repo, worktree: "failed", worker: { run: "diagnostic", handle: "failed" } });
    } catch (error) {
      const message = String(error);
      console.log(message);
      const log = message.match(/Setup log retained: (.+)/)?.[1];
      if (log) console.log(readFileSync(log, "utf8"));
      console.log("Worktree remains:", existsSync(repo + "__worktrees/failed"));
      console.log("Branch remains:", git("branch", "--list", "failed"));
    }
  }
} finally { rmSync(root, { recursive: true, force: true }); }
'
~~~

## Observed implementation trial

A temporary diagnostic using this same seed and library entry failed setup with exit 7 twice, reusing worker name "failed". Each exception replaced the deleted worktree path in its "see" clause with a unique retained path, also reported as "Setup log retained". Both copied logs contained retained-failure-marker after the worktree and branch were removed. The second attempt left a distinct retained directory, avoiding overwrite of the first attempt.

Example exception excerpt (disposable target since removed):

~~~
Worker setup failed: 7 (see /tmp/retained-setup-nKo2U4/repo/.git/reconcile/setup-failures/failed-7k5K21/setup.log)
Setup log retained: /tmp/retained-setup-nKo2U4/repo/.git/reconcile/setup-failures/failed-7k5K21/setup.log
Partial resources cleaned
~~~

Existing regression checks: bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts — 11 pass, 0 fail, 55 expectations. bunx tsc --noEmit — exit 0. No permanent tests added.

This establishes the failed-setup cleanup/log journey, not the original intermittent setup cause or a live reconciler launch. A fresh driver owns independent acceptance.
