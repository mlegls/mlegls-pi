# Session friction review — September 26

Yes: tooling observations are still being left only in final reports. There is a direct instruction to do that, not merely failure to follow the filing rule.

Scope: keyword-led scan of 573 Pi JSONL files whose filenames date September 22–26, followed by reading selected assistant reports and current instructions/issues. 231 messages matched the broad scan, including application friction work and this review's opening message. Not an exhaustive error census: older sessions resumed during this period, Claude transcripts, and reports without the searched vocabulary are outside this pass. Reported tool behavior below has not been reproduced. Source locators are session UUID + physical JSONL line under `~/.pi/agent/sessions/`; UUIDs identify filenames regardless of project-directory renames.

## Recovered observations

### A. Filing ownership

`agents/_common.md:15`: “include concrete ergonomic friction in the final report … the parent consolidates them.” Tracker procedure: whoever meets a friction files it immediately; the report links it. The subtree `unowned` lint reads issue bodies, so final-report-only observations escape it.

[New idea](../issues/worker-friction-reports-have-no-durable-owner.md). This is the first thing to reconcile; another collector is not yet justified.

### B. Browser first use

Root invocation cannot find project Playwright; running from `packages/web` works. Repeated omitted `--until` attempts are caller errors, but the stance's advertised command omits it too. Sign-in and end-state stalls are separate observations, not established consequences of dependency resolution.

Sources: `01a0dcbc-dc5e-7628-92a8-b435bf335fb9:36,151`; `01a0dcd2-5cb3-719c-9683-e9b491ccfc4b:39`; `01a0dcd4-0439-7190-9c55-0aa636998bd6:117`. Coordinator explicitly deferred filing the Playwright problem: `01a0dcaf-c727-7506-be41-38d1168492b9:81`.

[New idea](../issues/computer-browser-first-use-depends-on-package-cwd.md).

### C. Edit DSL

Literal conventional diff markers were written into source in two independent reports. Other repeated costs: missing blank hunk separators, insertion-like JSX, mistaken or incomplete anchor ranges. Most are caller mistakes; repetition makes them interface evidence, not proof that valid edits fail.

Sources: `01a0dcb1-d154-7338-a04c-0480e8abb150:142`; `01a0dcb1-cb6d-71f3-804c-4ef7827f479c:384`; unknown-anchor diagnostic: `01a0d8ad-5d89-74b7-8fac-fe2edb023f1b:309`.

[New idea](../issues/edit-dsl-confusions-write-literal-diff-lines.md). Do not conflate with the earlier resolved hunk-header issue.

### D. Browser target/ref ownership

Reports describe snapshots switching to another tab and refs going stale after screenshot/eval/wait. Named sessions, fresh snapshots and CSS/eval were the workarounds. Named sessions are already recommended in `agents/verify.md`; whether each caller followed that advice needs checking. CLI owner: chrome-devtools-axi, not necessarily ab.

Sources: `01a0dcc8-f6a6-7570-bba7-c7e26ad127e4:309`; `01a0dcf8-6ddb-73fa-93ff-51003b6f9aee:310`; `01a0dcb1-d69d-702e-a09c-daa09add44a1:290`.

[New idea](../issues/browser-cli-target-and-reference-lifetime-friction.md).

### E. Tracker check changes branch-local links

The checker rewrites links against canonical vault state, which can disagree with the worktree's archive paths and attachments. A worker used a worktree-local `TRACKER_VAULT` mapping; another coordinator reverted 48 unrelated rewrites. Repair is documented; branch-local resolution and unwanted churn remain worth reviewing.

Sources: `01a0d6c8-d861-7641-a79f-2ca08e46caf6:111`; `01a0cc01-0b1a-7688-aca4-00c5a00eb882:994`.

[New idea](../issues/tracker-check-repairs-links-against-another-checkout.md).

## Existing owners, resolved items, and limits

- **Skims:** short docs/code, CSS values and aria snapshots needed exact recovery. Instruction fidelity already has [an open owner](../issues/skims-drop-the-conditions-in-instructions.md). New reports: `01a0dce3-d55b-7732-8fe4-54e767a53f86:359`, `01a0d8ad-5d89-74b7-8fac-fe2edb023f1b:309`. One worker proposed exempting files below 200 lines; that threshold is a suggestion, not an evaluated remedy.
- **Close-commit races and stale retired children:** already covered by [close on the ticket branch](../issues/close-a-supervised-ticket-inside-its-branch.md). A coordinator guessed `spawn pi ENOENT` meant daemon PATH; the existing issue traces a retired-child timeline request instead. Preserve the symptom, not the unverified diagnosis. Other reports of `Connection ended` and `already has an active run` need original-event inspection before grouping them here (`01a0d667-d6d5-73e2-875e-e00ee6248ccc:699,1237`).
- **Verifier effectiveness:** coordinator reports repeated setup stalls, using other worktrees' servers, and stronger-model retries completing drives (`01a0d667-d6d5-73e2-875e-e00ee6248ccc:1083`). Current stance still recommends Luna/medium. A separate route-to-Sol worker reported completion (`01a0d800-f54a-7661-b329-c10efce7ff9b:118`); this review has not established integration/reversal history, so does not call it an unfiled model-routing bug.
- **Project setup:** port collisions, inherited credentials, missing Clerk environment and lingering Vite children belong first to Concept's setup/process ownership. Today’s reports alone do not establish regressions in earlier setup fixes. No services were stopped during this review.
- **Already fixed today:** GNU userland disclosure, `ab raw` EPIPE and Lavish takeover guidance in `30fc343`; prompt search in `8beb8ff`. Do not refile the preceding retro's proposals (`01a0dce9-4e99-770e-b574-931819bc5b1e:562`).
- **Low-confidence one-offs:** missing edit output after a piped read, multi-glob grep returning nothing, directory input to `ab view`, and a tmux timing failure that passed alone. Recover exact invocations before proposing fixes. Directory input and unsupported grep flags are not supported-operation failures.

No runtime or prompt behavior changed. The five new issues are raw ideas, not an execution queue; original sessions remain cited in this note, while issue authors identify the recovery session.
