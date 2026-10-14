# GitHub PR transport — first use

Independent verifier: [drive log, predictions and live PR #2 evidence](drive.md), tested `75b267a96b8965eec4763ba93117943c6a6bc710`.

Final tested implementation: `1c0c859d3ba3203161a9ce98794a558fb0dde230` (base `945972002389360132946febab22f83208c2e9ab`), 2026-10-14. Creation/recovery ran at `1e80390df393509b9c46f79c03ba9313763cd9b2`; after preserving independent check suites, typecheck, seeded check fixtures and the read-only live entry point were re-driven on the final source. Nonvisual library/API journey; no screenshots. The shared `PullRequestHost` contract is unchanged. No retained tests were added.

## Required environment and prepared target

- Required: an owned disposable GitHub repository, existing harness `gh` authentication, local remote/default branch, repository access and successful default-branch fetch.
- Prepared: private [`mlegls/reconcile-pr-transport-20261014-35767b2d`](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d), owned by this transport drive, not any production run or sibling rehearsal. Local checkout: this worker's `.wm/pr-transport-scratch`; remote `origin`; default branch `main`.
- Persona/auth: existing `mlegls` GitHub CLI keyring login, SSH Git operations. No credentials were created or changed; no secret is needed beyond the existing `gh` login.
- Seed: GitHub README on `main` (`3ed5a61a91a2062dd19561fd65d4f3c87db2a11a`); `transport-first-use` adds an empty probe commit then `probe.txt` (`4a07d7bfaec672c8f292cd2a1710f3b17918f8eb`). PR #1 is now **closed, unmerged**. Two manually reported legacy statuses remain on that head. No Actions/deployment/server was started.
- Readiness actually observed: `gh auth status` succeeded; `gh repo view` returned repository/default branch; clone and `git fetch origin main` succeeded.

Exact preparation commands, run from the worker checkout:

```sh
gh auth status
gh api user --jq .login
gh repo create mlegls/reconcile-pr-transport-20261014-35767b2d --private --description 'Disposable reconcile GitHub transport evidence; owned by reconcile-github-pr-transport-implement-2' --add-readme
gh repo clone mlegls/reconcile-pr-transport-20261014-35767b2d .wm/pr-transport-scratch
git -C .wm/pr-transport-scratch fetch origin main
gh repo view mlegls/reconcile-pr-transport-20261014-35767b2d --json nameWithOwner,defaultBranchRef,url
git -C .wm/pr-transport-scratch switch -c transport-first-use
git -C .wm/pr-transport-scratch -c user.name='Transport probe' -c user.email='transport-probe@example.invalid' commit --allow-empty -m 'Scratch transport probe head'
git -C .wm/pr-transport-scratch push -u origin transport-first-use
# Wrote probe.txt with: Disposable transport first-use probe.\n
git -C .wm/pr-transport-scratch add probe.txt
git -C .wm/pr-transport-scratch -c user.name='Transport probe' -c user.email='transport-probe@example.invalid' commit -m 'Add scratch transport content'
git -C .wm/pr-transport-scratch push origin transport-first-use
```

### Fresh verifier entry point (read-only, already opened through this library)

In a fresh checkout, clone the owned target once and check readiness before inspecting it:

```sh
gh auth status && gh repo clone mlegls/reconcile-pr-transport-20261014-35767b2d .wm/pr-transport-scratch && git -C .wm/pr-transport-scratch fetch origin main
bun -e 'import { resolve } from "node:path"; import { createPullRequestHost } from "./lib/reconcile/pr-host.ts"; const cwd=resolve(".wm/pr-transport-scratch"), h=createPullRequestHost(), p=h.project(cwd); console.log(JSON.stringify({project:p,pr:h.find(cwd,p.repository,"transport-first-use"),empty:h.checks(cwd,p.repository,"3ed5a61a91a2062dd19561fd65d4f3c87db2a11a")},null,2));'
```

That command lands directly on the typed observation surface: project + closed PR #1 + genuinely empty base checks. Do not rerun create against this branch: all-state lookup intentionally retains its closed PR. A new destructive first-use round needs a fresh owned repository/branch, not a production target.

## Live GitHub observations

| Claim / action | Observed result |
| --- | --- |
| `project(cwd)` | `{repository:"mlegls/reconcile-pr-transport-20261014-35767b2d",remote:"origin",baseBranch:"main"}` |
| `create` with exact title/body/base/head; ordinary REST readback | PR #1 returned; title, body including newline/backticks/dollar sign, `main` base and `transport-first-use` head matched input byte-for-byte in the parsed strings. |
| Interrupted-create recovery through `find` | The first probe created PR #1, then a TLS timeout interrupted the later success-status POST. The recovery probe did **not** create: `find` recovered the same OPEN PR #1. |
| Full `observe` | Exact head/base OIDs and branch names below, `OPEN`, `MERGEABLE`, empty submitted reviews/threads on this live unreviewed PR, and the status on the exact head. Unmerged PR has no `mergedAt`/`mergeCommit`. |
| Genuine empty checks | Initial created head had no checks/statuses. The final recovery probe independently measured `checks(baseOid) === []`. |
| Invalid OID vs empty | `checks("0".repeat(40))` threw `GitHub transport: gh: No commit found for SHA: 0000000000000000000000000000000000000000 (HTTP 422)`; it did not return `[]`. |
| Legacy status and latest rerun | Failure status `56320258534` normalized to `fail`; subsequent success `56320380569` for the same context normalized to exactly one `pass`, both in `checks` and the snapshot. |
| Ordinary close, then all-state find | `gh pr close 1 --repo mlegls/reconcile-pr-transport-20261014-35767b2d`; subsequent `find` returned the same #1 with `CLOSED`, not absence/a replacement. |

Selected final structured observations (live, not fixtures):

```json
{
  "number": 1,
  "url": "https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/1",
  "state": "OPEN",
  "headBranch": "transport-first-use",
  "head": "4a07d7bfaec672c8f292cd2a1710f3b17918f8eb",
  "baseBranch": "main",
  "base": "3ed5a61a91a2062dd19561fd65d4f3c87db2a11a",
  "mergeable": "MERGEABLE",
  "reviews": [],
  "threads": [],
  "checks": [{
    "id": "56320380569",
    "name": "transport/probe",
    "state": "pass",
    "url": "https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/1",
    "details": "success: Latest successful rerun"
  }]
}
```

The final closed observation had the same identity, OIDs, reviews, threads and checks, with `state:"CLOSED"`. The TLS handshake timeout happened once while POSTing the success status; the same operation succeeded on recovery using the existing login. No transport retry concealed the failed write.

### Exact one-off Bun probes

These were temporary `.wm` probes, not retained tests. Save the following blocks as the indicated paths if inspecting their original commands; the initial probe deliberately refuses to create if a matching PR exists.

`bun .wm/transport-probe.ts` — original creation round (stopped at the success-status POST TLS timeout):

```ts
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createPullRequestHost } from "../lib/reconcile/pr-host.ts";
const cwd = resolve(".wm/pr-transport-scratch");
const host = createPullRequestHost();
const command = (...args: string[]) => execFileSync("gh", args, { cwd, encoding: "utf8" }).trim();
const project = host.project(cwd);
const headBranch = "transport-first-use";
const input = { headBranch, baseBranch: project.baseBranch, title: "Transport first use — exact title", body: "Exact caller body.\n\nLiteral $value and " + String.fromCharCode(96) + "code" + String.fromCharCode(96) + ".\n\n<!-- transport-body -->" };
const before = host.find(cwd, project.repository, headBranch);
if (before) throw Error("Owned branch already has a PR; do not blindly rerun create");
const created = host.create(cwd, project.repository, input);
const found = host.find(cwd, project.repository, headBranch);
const observed = host.observe(cwd, project.repository, created.number);
const raw = JSON.parse(command("api", "repos/" + project.repository + "/pulls/" + created.number));
if (found?.number !== created.number || raw.body !== input.body || raw.title !== input.title || raw.base.ref !== input.baseBranch || raw.head.ref !== headBranch) throw Error("create/find mismatch");
const empty = host.checks(cwd, project.repository, created.head);
if (empty.length || observed.checks.length) throw Error("Expected genuinely empty check/status set");
let failure = "";
try { host.checks(cwd, project.repository, "0".repeat(40)); } catch (e) { failure = (e as Error).message; }
if (!failure) throw Error("Unknown OID was incorrectly treated as no checks");
const endpoint = "repos/" + project.repository + "/statuses/" + created.head;
command("api", endpoint, "--method", "POST", "-f", "state=failure", "-f", "context=transport/probe", "-f", "description=Superseded failure", "-f", "target_url=" + created.url);
const failed = host.checks(cwd, project.repository, created.head);
command("api", endpoint, "--method", "POST", "-f", "state=success", "-f", "context=transport/probe", "-f", "description=Latest successful rerun", "-f", "target_url=" + created.url);
const reported = host.checks(cwd, project.repository, created.head);
const snapshot = host.observe(cwd, project.repository, created.number);
if (failed.length !== 1 || failed[0]!.state !== "fail" || reported.length !== 1 || reported[0]!.state !== "pass" || snapshot.checks[0]?.state !== "pass") throw Error("Latest status normalization mismatch");
command("pr", "close", String(created.number), "--repo", project.repository);
const closed = host.find(cwd, project.repository, headBranch);
if (closed?.number !== created.number || closed.state !== "CLOSED") throw Error("Closed PR lookup mismatch");
const output = { project, input, created, foundNumber: found?.number, observed, empty, invalidOidFailure: failure, failed, reported, snapshot, closed };
await Bun.write(".wm/transport-live.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify(output, null, 2));
```

`bun .wm/transport-recover.ts` — successful recovery/measurement/ordinary-close round:

```ts
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createPullRequestHost } from "../lib/reconcile/pr-host.ts";
const cwd = resolve(".wm/pr-transport-scratch");
const host = createPullRequestHost();
const command = (...args: string[]) => execFileSync("gh", args, { cwd, encoding: "utf8" }).trim();
const project = host.project(cwd);
const found = host.find(cwd, project.repository, "transport-first-use");
if (!found || found.number !== 1 || found.state !== "OPEN") throw Error("Interrupted-create recovery failed");
const input = { headBranch: "transport-first-use", baseBranch: project.baseBranch, title: "Transport first use — exact title", body: "Exact caller body.\n\nLiteral $value and " + String.fromCharCode(96) + "code" + String.fromCharCode(96) + ".\n\n<!-- transport-body -->" };
const raw = JSON.parse(command("api", "repos/" + project.repository + "/pulls/" + found.number));
if (raw.body !== input.body || raw.title !== input.title || raw.base.ref !== input.baseBranch || raw.head.ref !== input.headBranch) throw Error("Exact create inputs not preserved");
const empty = host.checks(cwd, project.repository, found.base);
let failure = "";
try { host.checks(cwd, project.repository, "0".repeat(40)); } catch (e) { failure = (e as Error).message; }
if (empty.length || !failure) throw Error("Empty checks and failed observation confused");
const failed = host.checks(cwd, project.repository, found.head);
const endpoint = "repos/" + project.repository + "/statuses/" + found.head;
command("api", endpoint, "--method", "POST", "-f", "state=success", "-f", "context=transport/probe", "-f", "description=Latest successful rerun", "-f", "target_url=" + found.url);
const reported = host.checks(cwd, project.repository, found.head);
const snapshot = host.observe(cwd, project.repository, found.number);
if (failed.length !== 1 || failed[0]!.state !== "fail" || reported.length !== 1 || reported[0]!.state !== "pass" || snapshot.checks[0]?.state !== "pass") throw Error("Latest status normalization mismatch");
command("pr", "close", String(found.number), "--repo", project.repository);
const closed = host.find(cwd, project.repository, input.headBranch);
if (closed?.number !== found.number || closed.state !== "CLOSED") throw Error("Closed PR lookup mismatch");
const output = { project, input, recovered: found, emptyOid: found.base, empty, invalidOidFailure: failure, failed, reported, snapshot, closed };
await Bun.write(".wm/transport-live.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify(output, null, 2));
```

## Seeded transport fixtures (not live acceptance)

`bun .wm/transport-fixture-probe.ts` temporarily put a Bun `gh` responder ahead of PATH. It did not contact GitHub or retain new tests. Inputs deliberately split REST pages, reviews, threads, and a thread's comments into multiple pages, with opaque IDs (`opaque-review-A`, `opaque-review-B`, `opaque-thread-A`).

- Paginated reviews yielded APPROVED and CHANGES_REQUESTED, excluding a PENDING review. Two threads had comment counts `[2,1]`; an outdated line used `originalLine:17`. No numeric parsing of review/comment IDs.
- Seeded check runs combined superseded failure/success under one app/suite/name with neutral, skipped, queued, cancelled, timed-out, action-required, error and an unknown conclusion; two pages of legacy statuses superseded failure with success. A second independent check suite with the same app/job name retained its failing run rather than being hidden by another workflow's success.
- Result by check name: `{rerun:"pass",neutral:"pass",skipped:"pass",queued:"pending",cancelled:"fail",timed_out:"fail",action_required:"fail",unknown:"pending",error:"fail",independentWorkflowSameName:"fail",legacy:"pass"}`.
- Reply replay found `<!-- durable-marker-A -->` only on the second comments page, so no mutation. A new reply on the other thread included marker B; immediate replay yielded exactly one mutation total. No resolve mutation was issued.
- Guarded merge capture was exactly `gh api repos/owner/repo/pulls/42/merge --method PUT --input -`, JSON `{merge_method:"merge",sha:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`. No auto-merge, squash or rebase argument/mutation.
- Incomplete check-run total threw `incomplete paginated check_runs; retry observation`; simulated authorization failure threw an actionable error; two exact head matches threw `multiple pull requests ... (#42, #43)`.

A live, read-only schema introspection also confirmed `AddPullRequestReviewThreadReplyInput` exposes `pullRequestReviewThreadId`/`body` and that `PullRequestReviewThread` exposes `pullRequest`. This is schema evidence, **not** live thread reply evidence:

```sh
gh api graphql -f 'query={ replyInput: __type(name:"AddPullRequestReviewThreadReplyInput") { inputFields { name } } thread: __type(name:"PullRequestReviewThread") { fields { name } } }' --jq '{replyInput: [.data.replyInput.inputFields[].name], threadHasPullRequest: any(.data.thread.fields[]; .name == "pullRequest")}'
```

Live thread reply, nonempty submitted reviews, and guarded-merge end-to-end journeys remain explicitly owned by `rehearse-reconciled-github-pr-landings`, per this ticket's boundary; the seeded observations above do not claim those live outcomes.

## Regression checks

- `bunx tsc --noEmit`: passed, including after the final check-suite identity adjustment.
- `bun test --cwd skills/enabled/all/mlegls/conventions/tracker/scripts`: 24 passed, 681 assertions.
- `bun test ./lib/reconcile ./lib/tracker-lint.test.ts ./lib/tracker-views.test.ts`: first round had 18 pass, 1 skip, and the kept refinement test timing out at 30002.76ms, followed by a snapshot subprocess cancellation error.
- `bun test ./lib/reconcile/refinement.test.ts -t 'landed refinement stubs forbid discard or replacement'`: immediate isolated rerun passed in 15407.03ms, 34 assertions. No source/test change was needed to reproduce the pass.
- Repeated whole affected reconciler/tracker-library run: **19 passed, 1 conditional skip, 0 failed**, 212 assertions, 127.21 seconds. The earlier timeout is a demonstrated flake, not a carried failing gate.

Timeout friction was searched for and filed outside the execution subtree as [reconciler-refinement-regression-exceeds-thirty-second-timeout](../../issues/reconciler-refinement-regression-exceeds-thirty-second-timeout.md); shared-host load is a hypothesis, not an established cause.

## Cleanup and limits

PR #1 is closed. The disposable private repository and its branches/status history remain available for a fresh verifier; no live process/deployment/container/browser was left running. After verification, its owner can delete it with:

```sh
gh repo delete mlegls/reconcile-pr-transport-20261014-35767b2d --yes
```

Deletion requires GitHub `delete_repo` permission (not reported in the current login's scopes); use authorized GitHub repository Settings deletion if that permission is unavailable. Do not add credentials/scopes merely to run this transport. Local `.wm/pr-transport-scratch` is worktree-owned scratch and can be removed with the worktree.

**Door:** two-way source change; create/reply/merge calls write to GitHub when their caller invokes them. **Blast radius:** transport. All live writes here were restricted to this explicitly owned scratch repository.

## Review pass (live, 2026-10-14)

Same disposable repository; branch `review-checks-probe` (head `231dbea0515e1cc5595ee2a070fc316431c55fe1`, two Actions workflows A and B each with a job named `build`; A always fails) and PR #3 (closed afterwards with `gh pr close 3`). Cleanup as above.

| Claim | Observed (library host, live) |
| --- | --- |
| Real check runs; independent suites with the same job name stay distinct | `checks(head)` returned two `build` entries: A's `fail`, B's `pass`. |
| Rerun supersedes the earlier attempt | After `gh run rerun` of A, REST `filter=all` listed A's original and rerun runs in the same check suite; `checks` returned one entry for A (the newer id) and B. |
| Pending reviews are ignored | With an unsubmitted review holding an inline comment, `observe` gave `reviews: []`, `threads: []` (needed a repair: pending thread comments were previously returned). |
| Submitted review and thread | After submitting: one `COMMENTED` review with exact commit OID; one unresolved thread with comment id, reviewId, path, line, url. |
| Reply replay | `reply(thread, "fixed", "<!-- marker:abc -->")` called twice produced exactly one reply comment (the second call found the marker). Note GitHub files the reply under its own new review id. |
