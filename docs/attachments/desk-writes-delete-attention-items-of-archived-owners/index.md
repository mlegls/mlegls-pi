# Archived-owner desk attention verification

## Predictions before first use

From the ticket and `ab desk --help`:

- A desk write should remove an archived owner's role row while retaining its unanswered attention item.
- With a live pickup owner, the retained item should move to that owner and retain the original owner in its body.
- Without a pickup owner, a live supervisor role should receive the item, preserving provenance.
- With neither live supervisor available, the item should remain with an `owner gone` marker until explicit removal.

## Setup

Revision: `2ba1dfc94558917b7b4fefcc1ddcd29f2a3ac397`.
Checkout: `desk-writes-delete-attention-items-of-archived-owners-drive-2`.
The supplied acceptance entry point is `bun test lib/desk.test.ts`: a temporary Git repository, stub BB CLI, archived owner and pickup/supervisor variants; no credentials or live thread mutations. The ticket explicitly requests a desk test as its acceptance surface. No implementation, test source, fixtures or diff were read. `ab desk --help` responds and states that every write cleans both files.

## Encounter and outcome

Ran `bun test lib/desk.test.ts` in this checkout. It completed with exit 0: **1 pass, 0 fail, 34 assertions**. The reported case was `desk writes retain archived-owner attention, recover its owner, and drop archived-owner roles`. Runtime was 84 ms. No service, browser, or deployment was started.

The ticket's explicit desk-test acceptance criterion held through its supplied runner. The retention, owner recovery and role cleanup expectations were met at the runner's reported level. The runner groups the pickup, supervisor-role and no-supervisor variants into one result; their individual states and provenance text were not independently exposed or inspected. The reviewer should judge the assertions' correspondence to those detailed requirements.

## Frictions

No execution friction. The single aggregate case gives less diagnostic visibility than separately named owner-selection cases.

## Replayable checks

1. From the tested revision, run `bun test lib/desk.test.ts`. Accept exit 0 with the archived-owner retention/recovery/role-cleanup case passing; observed 34 assertions.
2. For review of detailed coverage, check that the acceptance case observes pickup preference over a live supervisor role, fallback to that role when pickup is unavailable, original-owner provenance after reassignment, and an `owner gone` marker when neither successor is live. These details were predictions from the ticket; the aggregate runner output alone does not identify their individual results.

## Evidence limits

Nonvisual, isolated fixture acceptance only. No live shared desk data was touched. No assertion-level inspection or additional tests were performed by the driver.

## Review

Read `lib/desk.test.ts` assertions: five scenarios (pickup owner live; pickup owner archived with live supervisor role; pickup disabled; no pickup state; neither live) each assert the item survives, the Owner line is the pickup owner, else the supervisor role holder, else `thr_old (owner gone)`, `Previous owner` is kept on reassignment, the archived `working` role row is dropped, a second clean is idempotent, and `removeAttention` removes it. This covers the driver's replayable check 2. `bun test lib/desk.test.ts` re-run at review head: 1 pass, 34 assertions. Repair: the `ab desk` usage text and the shape/supervise skills still said writes clean attention of archived owners; reworded (2977f60c).
