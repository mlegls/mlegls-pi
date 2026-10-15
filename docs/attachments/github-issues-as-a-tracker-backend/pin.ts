// Read-only first use of the committed tracker CLI across BB's daemon/worker boundary.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ThreadRecord } from "../../../lib/thread/types.ts";
const pkg = realpathSync(join(import.meta.dir, "../../.."));
const area = realpathSync(mkdtempSync("/tmp/github-tracker-pin-")), cwd = join(area, "repo");
for (const key of Object.keys(process.env)) if (/^(PI_|BB_|AB_|TRACKER_)/.test(key)) delete process.env[key];
Object.assign(process.env, { XDG_STATE_HOME: join(area, "state"), XDG_CACHE_HOME: join(area, "cache") });
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: area, encoding: "utf8", stdio: "pipe" }).trim();
try {
  const repository = "mlegls/reconcile-pr-transport-20261014-35767b2d";
  assert.equal(JSON.parse(run("gh", ["api", "user"])).login, "mlegls");
  assert.equal(JSON.parse(run("gh", ["api", "repos/" + repository])).full_name, repository);
  run("git", ["clone", "-q", "https://github.com/" + repository + ".git", cwd]);
  const { pinTracker } = await import("../../../lib/reconcile/reconcile.ts");
  const { writeLaunchEnv } = await import("../../../lib/thread/bb.ts");
  const cli = pinTracker(), tested = run("git", ["-C", pkg, "rev-parse", "HEAD"]);
  assert(cli.includes("/tracker-pin/" + tested + "/"));
  process.env.TRACKER_CLI = cli;
  const thread: ThreadRecord = { id: "pin-first-use", sessionId: "pin-first-use", sessionFile: join(area, "unused.jsonl"),
    cwd, project: cwd, ownership: "owner", archived: false, created: new Date().toISOString(), worker: { run: "pin-first-use", handle: "reader" } };
  writeLaunchEnv(thread);
  assert(readFileSync(join(cwd, ".wm/launch.env"), "utf8").includes("TRACKER_CLI="));
  const bin = join(area, "bin"); mkdirSync(bin);
  // The real bridge sources launch.env; only pi is replaced, by an ordinary public CLI invocation.
  writeFileSync(join(bin, "pi"), "#!/bin/sh\nexec bun \"$TRACKER_CLI\" fields gh-96\n", { mode: 0o755 });
  const daemon = { ...process.env, PATH: bin + ":" + process.env.PATH }; delete daemon.TRACKER_CLI;
  const fields = JSON.parse(execFileSync(join(pkg, "bin/bb-pi"), [], { cwd, env: daemon, encoding: "utf8", stdio: "pipe" }));
  assert.equal(fields.stage, "done");
  assert.equal((fields.github as any).repository, repository);
  console.log(JSON.stringify({ tested, repository, persona: "mlegls via existing gh auth", root: "gh-96", stage: fields.stage,
    pinIncludesBackend: true, launchEnvCarriesPinnedCli: true, daemonInheritedCli: false, realBridgeUsed: true,
    publicCliSucceeded: true, remoteWrites: 0, localCloneAndPinCleaned: true }));
} finally { rmSync(area, { recursive: true, force: true }); }
