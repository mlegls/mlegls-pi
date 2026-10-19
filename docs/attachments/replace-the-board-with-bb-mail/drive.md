# Independent joined encounter

## Predictions recorded before use

Tested revision: `28aaa64c6cd744785cf9591e5a4cdea0dbdf2051`.

The children already cover desk cleanup, notice suppression and live reconcile. The remaining joined journey in the setup handoff is tracker supervisor discovery through desk conventions followed by queued SDK messaging. I expect the supplied public encounter to find the live role holder, queue both role-addressed and explicitly addressed supervision, and refuse an unavailable supervisor without sending real messages. I expect removal of the role to remove discovery.

## Starting state

Owned worktree: `replace-the-board-with-bb-mail-drive-i`. Setup was reported complete by the parent. Existing `BB_THREAD_ID` is present (value not recorded). Per committed setup documentation, the encounter creates and removes its own temporary checkout, vault issue, pin state and desk; SDK messages are captured, not delivered. No shared server reload or browser is involved. Entry point: `npm ci --prefix bb/tracker --ignore-scripts --no-audit --no-fund && bun docs/attachments/replace-the-board-with-bb-mail/encounter.ts`.

## Encounter

Dependency preparation finished successfully (167 packages); encounter exited 0. Discovery returned one idle standing supervisor. Both role and explicit delivery returned `queued to the supervisor`; captured SDK sends used `queue-if-active` and named the ready fixture issue. Deleted/archived role discovery returned an empty list; unavailable-role delivery reported `No live supervisor in desk/ROLES.md`; absent-role discovery returned an empty list. The encounter reported removal of its disposable checkout. No servers or pages were started.

## Outcomes and expectations

- Held / met: tracker discovers the desk role and routes supervision by role or explicit thread ID through the queued SDK surface.
- Held / met: unavailable or absent role is not offered as a supervisor, and unavailable-role delivery has an actionable error.
- These are isolated SDK observations, not fresh live message delivery or notice-suppression acceptance; those remain covered by the children's linked evidence. No implementation, test or fixture source was read during this drive.

## Replayable checks

Run the entry point above from the tested checkout with an existing `BB_THREAD_ID`. Accept discovery of the standing supervisor, two queued delivery results and captured `queue-if-active` sends naming the fixture issue. Accept an empty supervisors list after unavailable/absent role state and the exact unavailable-role error above. Require exit 0 and reported disposable-checkout removal.

## Frictions

No user-facing friction encountered on this fixture journey. npm emitted a `prebuild-install` deprecation advisory; dependency preparation still completed in about one second. No product failure or setup failure observed.

## Scope limits

No real bb message was sent; this supplied fixture proves the residual joined SDK/desk seam, not a second live run of the children's stories.
