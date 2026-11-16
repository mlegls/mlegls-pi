---
stage: done
assignee: agent
author: session:01a0f2a8-43e1-74bf-8840-12dfc0b4587e
priority: 3
---
Owner: `mlegls-pi` supervision setup handoff, also tracked by [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]].

The first-use drive of [[projects/mlegls-pi/issues/archive/make-undeliverable-mail-status-visible-to-scripts]] received a complete-looking local fixture handoff whose sole entry point was `bun test lib/board/mail-drive.test.ts`. It passed (1 test, 30 assertions), then removed its fixture. This reached a test runner, not a retained board or a command the first-use persona could drive; the driver cannot read the fixture to extract setup.

Workaround: previous user-facing evidence documented `bun ab/main.ts mail`, isolated data/state selectors, and explicit checkout-local Pi extensions. With those, an independent CLI journey held all three send-status stories. [Packet](../attachments/make-undeliverable-mail-status-visible-to-scripts/index.md).

Proposal: supplement test-runner handoffs with a public CLI entry point and isolated setup commands, including readiness and cleanup. This is handoff friction, not a mail-status defect.

Another encounter, 2026-09-30: the [tracker inline-code drive](../attachments/tracker-check-flags-inline-fixture-wikilinks/index.md) received only `bun test skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` as its fixture entry point. It passed 19 tests but supplied no retained tracker target, seed or user command. Workaround: the vault adapter docs supplied the public CLI invocation; the driver committed a separate isolated HOME/vault/Git-project setup recipe and drove the stories there. Same supervision handoff owner and proposed improvement, not a tracker link-checking defect.

The [joined CLI drive](../attachments/small-ab-cli-fixes/drive.md) received a retained anchor/tracker seed this time. Its entry point successfully opened `mixed.md`, but stdout supplied paths without tracker invocation selectors or mail-recipient setup. The driver's remaining setup came from the parent packet and previous public mail recipe; both surfaces became usable without implementation/fixture inspection. This narrows the friction to setup discoverability rather than a test-only handoff.

Another encounter, 2026-10-19: `bb-environments-follow-our-worktrees` supplied only `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/dispatch.test.ts` although its persona is the BB/wm operator, not a test-runner developer. The committed implementation packet supplied a read-only sweep command and concrete BB IDs, enabling partial independent observation. No public checkout-local spawn/retire recipe without launching another agent was supplied; the inherited supervisor's spawned driver had null merge-base metadata, and its just-retired implementer left a ready environment at a missing path. Those live observations cannot identify which runtime revision performed the lifecycle. Workaround: inspect BB's public environment/thread APIs, replay the read-only inventory and corroborate the sweep's 1,101 destroyed-row count. [Drive packet](../attachments/bb-environments-follow-our-worktrees/drive.md). Supply a retained checkout-local operator lifecycle recipe, not tests alone.

The 2026-11-12 bash timeout guard drive again received only `bun test extensions/guard/index.test.ts`. The user surface is Pi tool dispatch. Workaround: explicitly load the checkout-owned extension with `pi --no-extensions -e ./extensions/guard/index.ts`, adding `-e builtin:codemode` for nested calls. Both real tool surfaces held. [Packet](../attachments/bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours/index.md).

Concept, the same period: one drive got `setup: null` for a migration retirement (@thread:thr_ihbpyrp6s2#msg=32346), another only a unit-test command for the notebook-reader repair (#msg=33861); each cost a drive session and a supervisor wake (about $0.5–0.6). The 2026-11-16 efficiency audit (@thread:thr_js85m2wmby) promoted this to a ticket; the maintainer approved. The `implement` skill's step 4 now says a unit-test command is not setup when the story's user meets a public surface.

## tasks

1. Before launching a drive, the reconciler checks the implement handoff's setup: null, or only test-runner commands (`bun test`, `bun run test`, `vitest`, `mise run test…`), goes back to the implementer as a repair round with the reason, instead of starting a driver that escalates. A ticket with `drive: none` skips the check.
2. Done when: a reconciler test with a null setup and one with only `bun test …` re-prompt the implementer and launch no driver, and a handoff naming a CLI or browser entry launches the drive.

## Result

done

```yaml
commit: b7dbe881
stories:
  - story: Null setup re-prompts the implementer without launching a driver
    outcome: held
  - story: Test-only setup re-prompts the same implementer without launching a driver
    outcome: held
  - story: CLI or browser entry launches a driver carrying the supplied setup
    outcome: held
  - story: "drive: none bypasses the setup gate and proceeds to review"
    outcome: held
evidence:
  path: docs/attachments/mail-drive-handoff-names-only-a-test-runner/drive.md
  visual: false
  shots: []
tests:
  - lib/reconcile/setup.test.ts
  - lib/reconcile/unreadable-log.test.ts
fixed:
  - "lib/reconcile/checks.ts: the gate rejected prose setup like `bun test a.ts; then open http://localhost:3000` as test-only, because a URL only counted at the start of a fragment. A URL anywhere in a non-test fragment now counts as a surface. Commit: the 'setup gate: a URL anywhere in prose setup counts as a user surface' commit just before b7dbe881."
caveats:
  - "lib/reconcile/unreadable-log.test.ts: the change edited its fake handoffs to include a setup entry, so the gate lets them reach the drive phase. No assertions changed."
  - "I ran `bun test lib/reconcile lib/dispatch.test.ts`: 68 pass, 0 fail, 308 s. The `mise run test:affected` task wasn't run."
  - "setup.test.ts costs about 17 s: it starts a real reconciler with fake BB and runs three fixture targets."
  - "The gate is a heuristic over free-form setup text. A setup the heuristic misreads as test-only costs one repair round, and the repair prompt tells the implementer what to supply."
```

Evidence: [docs/attachments/mail-drive-handoff-names-only-a-test-runner/drive.md](../attachments/mail-drive-handoff-names-only-a-test-runner/drive.md)
