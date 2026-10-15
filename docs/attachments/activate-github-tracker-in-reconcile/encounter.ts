// Disposable first-use controller, not a retained suite. Only the named owned repository is mutated.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getTracker } from "../../../lib/tracker.ts";
import { getGithubTracker } from "../../../lib/tracker-github.ts";
import { beginRefinement } from "../../../lib/reconcile/refinement.ts";
import { load } from "../../../lib/reconcile/reconcile.ts";
import { githubProject, invalidateGithubSnapshot, withGithubLock } from "../../../lib/tracker-github-snapshot.ts";

const repository = "mlegls/reconcile-pr-transport-20261014-35767b2d";
for (const key of Object.keys(process.env)) if (/^(PI_|BB_|AB_|TRACKER_|WORKER_)/.test(key)) delete process.env[key];
const pkg = join(import.meta.dir, "../../..");
const cliPath = join(pkg, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const api = (path: string, data?: unknown) => JSON.parse(execFileSync("gh", ["api", path,
  ...(data === undefined ? [] : ["--method", "POST", "--input", "-"])],
  { encoding: "utf8", ...(data === undefined ? {} : { input: JSON.stringify(data) }) }));
const nativeRepo = api("repos/" + repository), viewer = api("user");
assert.equal(viewer.login, "mlegls");
assert.equal(nativeRepo.full_name, repository);
assert(nativeRepo.private && nativeRepo.has_issues && nativeRepo.permissions.push);
const area = mkdtempSync("/tmp/activate-github-tracker-"), main = join(area, "main"), linked = join(area, "linked");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const put = (cwd: string, path: string, content: string) => {
  mkdirSync(join(cwd, path, ".."), { recursive: true }); writeFileSync(join(cwd, path), content);
};
const cli = (args: string[], input?: string, env = process.env) => execFileSync("bun", [cliPath, ...args],
  { cwd: linked, input, env, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20 }).trim();
const owned: string[] = [];
let root: string | undefined, runner: ReturnType<typeof Bun.spawn> | undefined;
const events: Record<string, unknown> = { repository, persona: viewer.login, checkout: main, linked, readiness: "exact private owner, issues enabled, push permission" };
try {
  execFileSync("git", ["clone", "--quiet", "https://github.com/" + repository + ".git", main], { stdio: "pipe" });
  assert(!existsSync(join(main, "docs/issues")));
  put(main, "docs/agents/issue-tracker.md", "# Issue tracker: GitHub\nRepository: " + repository + "\n");
  const roles = { "needs-triage": "encounter/triage", "needs-info": "encounter/info", "ready-for-agent": "encounter/agent", "ready-for-human": "encounter/human", wontfix: "wontfix" };
  put(main, "docs/agents/triage-labels.md", "| Role | Label |\n| --- | --- |\n" +
    Object.entries(roles).map(([role, label]) => "| " + role + " | " + label + " |").join("\n"));
  const labels = api("repos/" + repository + "/labels?per_page=100");
  for (const label of Object.values(roles)) assert(labels.some((row: any) => row.name === label), "inherited fixture label missing: " + label);
  git(main, "worktree", "add", "--detach", linked, "HEAD");
  git(linked, "sparse-checkout", "set", "--no-cone", "/README.md");
  put(linked, "docs/agents/issue-tracker.md", "# Issue tracker: Vault\n");
  // Canonical selection must ignore this physical worker vault and convention.
  put(linked, "docs/issues/wrong.md", "---\nstage: ticket\nassignee: agent\n---\nwrong physical vault");
  const direct = getGithubTracker(linked)!;
  assert(getTracker(linked).githubIssue);
  assert.equal(JSON.parse(cli(["snapshot", "--json"])).issues.length, direct.snapshot().size);
  const author = "session:activation-encounter";
  root = cli(["create", "activate-" + Date.now(), "--fields", JSON.stringify({ title: "Disposable public tracker activation", assignee: "agent:technical", stage: "ticket", author }), "--body-file", "-"], "Initial public body\n");
  owned.push(root);
  assert.match(root, /^gh-\d+$/);
  assert.deepEqual(JSON.parse(cli(["fields", root, "--json"])), direct.fields(root));
  assert.equal(cli(["text", root]), direct.text(root).trim());
  api("repos/" + repository + "/issues/" + root.slice(3) + "/comments", { body: "Activation user-owned native comment." });
  const project = githubProject(main)!;
  withGithubLock(project, () => invalidateGithubSnapshot(project));
  const fields = JSON.parse(cli(["fields", root]));
  assert(fields["github-comments"].some((comment: any) => comment.body === "Activation user-owned native comment."));
  cli(["update", root, "--body-file", "-"], "Body-only stdin replacement\n");
  assert(direct.text(root).endsWith("Body-only stdin replacement\n"));
  put(linked, "body.md", "Whole file replacement\n");
  cli(["update", root, "--fields", '{"risk":"activation"}', "--body-file", "body.md"]);
  assert.equal(getTracker(linked).fields(root).risk, "activation");
  assert(direct.text(root).endsWith("Whole file replacement\n"));
  assert.deepEqual(JSON.parse(cli(["snapshot", root, "--json"])), { schemaVersion: 1, issues: [...direct.snapshot(root).values()], legacy: [] });
  const unsupported = spawnSync("bun", [cliPath, "frontier"], { cwd: linked, encoding: "utf8" });
  assert.equal(unsupported.status, 1); assert.match(unsupported.stderr, /GitHub tracker: unsupported command frontier/);
  events.publicCli = { root, identityFieldsTextComments: true, scopedSnapshot: true, bodyOnlyStdin: true, fieldsAndFile: true, unsupported: unsupported.stderr.trim() };

  // Production reconciler reserves with budget zero: no paid or shell workers.
  process.env.XDG_STATE_HOME = join(area, "state");
  process.env.PI_BOARD_DIR = join(area, "board");
  process.env.PI_RECONCILE_TICK_MS = "100";
  const logfile = Bun.file(join(area, "run.log"));
  runner = Bun.spawn(["bun", join(pkg, "lib/reconcile/main.ts"), "run", root, "--owner", "mail/activation", "--budget", "0", "--cwd", linked],
    { cwd: linked, env: process.env, stdout: logfile, stderr: logfile });
  for (let n = 0; n < 60; n++) {
    if (getTracker(linked).fields(root)["claimed-by"] === "reconcile:" + root) break;
    if (runner.exitCode !== null) throw new Error("runner exited: " + await logfile.text());
    await Bun.sleep(1000);
  }
  assert.equal(getTracker(linked).fields(root)["claimed-by"], "reconcile:" + root);
  runner.kill("SIGTERM"); await runner.exited; runner = undefined;
  const state = load(linked, root)!;
  assert.equal(Object.keys(state.chains).length, 0);
  assert.equal(state.githubRepository, repository);
  const tracker = getTracker(linked, { run: root });
  tracker.update(root, { "claimed-by": "reconcile:" + root });
  assert.equal(tracker.fields(root)["claimed-by"], "reconcile:" + root);
  const common = git(main, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const save = () => writeFileSync(join(common, "reconcile", root + ".json"), JSON.stringify(state));
  const attempt = beginRefinement({ state, tracker, save, stopWriter: async () => {}, locked: async work => work() }, root, "activation-provisional");
  const env = { ...process.env, PI_WM_RUN: root };
  const child = cli(["create", "activation-child-" + Date.now(), "--fields", JSON.stringify({ title: "Disposable activation provisional", assignee: "agent", author, "part-of": root, "claimed-by": attempt.claim }), "--body-file", "-"], "Provisional public CLI body", env);
  owned.push(child);
  assert.equal(tracker.fields(child)["claimed-by"], attempt.claim);
  cli(["remove", child], undefined, env);
  assert(!tracker.snapshot().has(child));
  tracker.moveOut!(root, "Disposable activation probe complete; return to human readiness.");
  const moved = tracker.fields(root);
  assert.equal(moved.assignee, "human"); assert.equal(moved["claimed-by"], undefined);
  assert.equal((moved.github as any).state, "OPEN");
  events.reservation = { root, stable: "reconcile:" + root, zeroWorkers: true, replaySameClaim: true, provisional: child, attempt: attempt.claim, remove: true, nativeMoveOut: "human, open, unassigned" };
  cli(["close", root, "--summary", "Disposable activation probe complete."], undefined, env);
  assert.equal(direct.snapshot().get(root)?.done, true);

  // Canonical vault wins even with a malformed GitHub convention and sparse worker.
  put(main, "docs/issues/canonical.md", "---\nstage: ticket\nassignee: agent\n---\nCanonical vault\n");
  assert(!getTracker(linked).githubIssue);
  assert.deepEqual(JSON.parse(cli(["snapshot", "--json"])).issues.map((row: any) => row.slug), ["canonical"]);
  rmSync(join(main, "docs/issues"), { recursive: true });
  put(main, "docs/agents/triage-labels.md", "| Role | Label |\n| --- | --- |\n");
  assert.throws(() => getTracker(linked), /missing mapping/);
  const malformed = spawnSync("bun", [cliPath, "snapshot", "--json"], { cwd: linked, encoding: "utf8" });
  assert.equal(malformed.status, 1); assert.match(malformed.stderr, /missing mapping/);
  events.selection = { sparseCanonicalVault: true, workerPhysicalVaultIgnored: true, malformedConfigRefuses: true };
  console.log(JSON.stringify(events, null, 2));
} finally {
  if (runner) { runner.kill("SIGTERM"); await runner.exited; }
  // Exact created identities only. Native cleanup is independent of deliberately malformed local conventions.
  for (const slug of owned) {
    const number = slug.slice(3);
    const result = spawnSync("gh", ["api", "--method", "PATCH", "repos/" + repository + "/issues/" + number, "--input", "-"],
      { encoding: "utf8", input: JSON.stringify({ state: "closed", state_reason: "not_planned", assignees: [] }) });
    if (result.status !== 0) throw new Error("Owned cleanup failed for " + slug + ": " + result.stderr);
  }
  rmSync(area, { recursive: true, force: true });
}
