---
stage: idea
assignee: agent
author: session:01a0f2a8-43e1-74bf-8840-12dfc0b4587e
---

Owner: `mlegls-pi` supervision setup handoff, also tracked by [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]].

The first-use drive of [[projects/mlegls-pi/issues/make-undeliverable-mail-status-visible-to-scripts]] received a complete-looking local fixture handoff whose sole entry point was `bun test lib/board/mail-drive.test.ts`. It passed (1 test, 30 assertions), then removed its fixture. This reached a test runner, not a retained board or a command the first-use persona could drive; the driver cannot read the fixture to extract setup.

Workaround: previous user-facing evidence documented `bun ab/main.ts mail`, isolated data/state selectors, and explicit checkout-local Pi extensions. With those, an independent CLI journey held all three send-status stories. [Packet](../attachments/make-undeliverable-mail-status-visible-to-scripts/index.md).

Proposal: supplement test-runner handoffs with a public CLI entry point and isolated setup commands, including readiness and cleanup. This is handoff friction, not a mail-status defect.

Another encounter, 2026-09-30: the [tracker inline-code drive](../attachments/tracker-check-flags-inline-fixture-wikilinks/index.md) received only `bun test skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` as its fixture entry point. It passed 19 tests but supplied no retained tracker target, seed or user command. Workaround: the vault adapter docs supplied the public CLI invocation; the driver committed a separate isolated HOME/vault/Git-project setup recipe and drove the stories there. Same supervision handoff owner and proposed improvement, not a tracker link-checking defect.
