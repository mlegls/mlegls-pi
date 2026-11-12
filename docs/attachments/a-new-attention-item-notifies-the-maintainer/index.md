# Attention notification first-user verification

Tested revision: `1684a8e8257b26b28771846910a37127bf18c03d`.

## Predictions before use

From the ticket and [desk guide](../../guide/desk.md#safe-first-use-setup):

- In a disposable main checkout and linked worker, the checked-out CLI will resolve the desk to the fixture's main checkout.
- A new test attention item will send a notification naming `main` and the test title, with its first paragraph. Clicking will open my live owning thread.
- An identical repeat will send nothing; a changed body will send one additional notification. Cleanup and handover will send nothing.
- A failed or undelivered send will leave the item written, exit zero and emit one stderr line.
- The guide will explain the notification behavior and the open-window requirement for web/desktop.

## Preparation observations

Persona: existing live thread `thr_caanfj9khu`; local CLI with the existing bb daemon, no credentials or new threads. Entry point: the guide's safe first-use setup. No fixture has been created and no attention add has been invoked in this verification pass yet.

The plugin's public status command responds: enabled, mobile/web/desktop enabled, one registered subscription. This establishes plugin availability, not device receipt.

The committed [implementation trial](implementation.md) says the required three-add sequence already ran once and produced two intended real pings. It explicitly warns subsequent verification against repeating real pings casually. That trial did not observe device banners or click-through; its global last-send status could not attribute sends individually.

The guide expectation is met by reading its notification and safe-first-use sections. Device arrival, exact notification count and click-through remain unobserved. A fresh three-add trial would repeat the maintainer ping beyond the ticket's once-only request. Awaiting a decision before doing that.

## Replayable checks

1. With an authorized device observer, run the guide's disposable fixture and three-add sequence once. Accept exactly two received notifications: first body and changed body, both titled `main: TEST: desk attention notification`; no receipt for the identical repeat.
2. Click a received notification. Accept navigation to the thread supplied by that run's live `BB_THREAD_ID`.
3. Remove the test item and clean the fixture. Accept no additional notification.

## Authorized repeat trial

The supervisor authorized one repeat because the maintainer missed the first trial and is now watching. Using the checked-out `bin/desk`, prepared disposable git main `/tmp/desk-attention-drive-vShbU1/main` and linked worker `/tmp/desk-attention-drive-vShbU1/worker`. Git initialization, empty commit and worktree creation finished before CLI use. The live owner was `thr_caanfj9khu`.

Ran working set, path and working clear; each resolved `/tmp/desk-attention-drive-vShbU1/main/desk`, meeting the fixture-ownership prediction. Then ran the guide's exact three adds: first body, identical first body, changed body, all with title `TEST: desk attention notification`. Each returned that same desk path, with no stderr. The entire sequence exited zero. Removed the attention item using the CLI, then removed the disposable fixture through the shell exit trap. No shared desk was modified.

The watching maintainer reported exactly two notifications arrived: the new/changed delivery and identical-body deduplication expectation is met. Clicking a notification in macOS Notification Center merely dismissed it and opened nothing. The owning-thread click-through expectation FAILED. This is a human report of the real device encounter, relayed by supervisor `thr_dfgkcug6jp`; no screenshot was captured by this CLI driver. The delivering Mac channel (bb desktop, browser web push or other) remains unidentified.

Do not repeat the three-add trial. After repair, one notification suffices to re-check click-through. Identify the actual delivering channel and verify its click action opens `thr_caanfj9khu` (or the live owner of that repair trial). The reviewer/implementer must own the repair; this driver changed no product code.

No browser, server or external deployment was started. The fixture was removed. No product source, tests or diffs were read.
