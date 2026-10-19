---
stage: idea
assignee: agent
author: session:01a0f2a8-43e1-74bf-8840-12dfc0b4587e
---

Owner: `mlegls-pi` supervision setup handoff, also tracked by [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]].

The first-use drive of [[projects/mlegls-pi/issues/archive/make-undeliverable-mail-status-visible-to-scripts]] received a complete-looking local fixture handoff whose sole entry point was `bun test lib/board/mail-drive.test.ts`. It passed (1 test, 30 assertions), then removed its fixture. This reached a test runner, not a retained board or a command the first-use persona could drive; the driver cannot read the fixture to extract setup.

Workaround: previous user-facing evidence documented `bun ab/main.ts mail`, isolated data/state selectors, and explicit checkout-local Pi extensions. With those, an independent CLI journey held all three send-status stories. [Packet](../attachments/make-undeliverable-mail-status-visible-to-scripts/index.md).

Proposal: supplement test-runner handoffs with a public CLI entry point and isolated setup commands, including readiness and cleanup. This is handoff friction, not a mail-status defect.

Another encounter, 2026-09-30: the [tracker inline-code drive](../attachments/tracker-check-flags-inline-fixture-wikilinks/index.md) received only `bun test skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` as its fixture entry point. It passed 19 tests but supplied no retained tracker target, seed or user command. Workaround: the vault adapter docs supplied the public CLI invocation; the driver committed a separate isolated HOME/vault/Git-project setup recipe and drove the stories there. Same supervision handoff owner and proposed improvement, not a tracker link-checking defect.

The [joined CLI drive](../attachments/small-ab-cli-fixes/drive.md) received a retained anchor/tracker seed this time. Its entry point successfully opened `mixed.md`, but stdout supplied paths without tracker invocation selectors or mail-recipient setup. The driver's remaining setup came from the parent packet and previous public mail recipe; both surfaces became usable without implementation/fixture inspection. This narrows the friction to setup discoverability rather than a test-only handoff.

Another encounter, 2026-10-19: `bb-environments-follow-our-worktrees` supplied only `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/dispatch.test.ts` although its persona is the BB/wm operator, not a test-runner developer. The committed implementation packet supplied a read-only sweep command and concrete BB IDs, enabling partial independent observation. No public checkout-local spawn/retire recipe without launching another agent was supplied; the inherited supervisor's spawned driver had null merge-base metadata, and its just-retired implementer left a ready environment at a missing path. Those live observations cannot identify which runtime revision performed the lifecycle. Workaround: inspect BB's public environment/thread APIs, replay the read-only inventory and corroborate the sweep's 1,101 destroyed-row count. [Drive packet](../attachments/bb-environments-follow-our-worktrees/drive.md). Supply a retained checkout-local operator lifecycle recipe, not tests alone.
