# Outreach first-use drive

## Predictions before opening BB

- An outreach-only project appears; Queue opens with Rhea's reply, a rail count of one, and a detail record with the log and hypothesis.
- Mark handled clears the Queue and badge immediately. Show handled lets me undo it. A new reply while marked restores Rhea without refresh.
- Candidates groups Pat and Charlie under Busy operators, Pat first. Filtering works; selecting both and Discuss opens a thread with both people and the hypothesis. I can get back to each record and find the thread from there.
- Hypotheses shows Busy operators with 3 people, 1 replied, 1 confirm, 0 kill, and a decision bar. Discuss carries just the hypothesis.
- All and Dropped are distinct views; sync status is visible in the footer. A due follow-up belongs in Queue and can resurface when its date advances.

## Drive

Tested `bb-plugins` revision `c4e1c1b23ed27053d455a158cf987435a741ead6`. Followed `tracker/docs/outreach-first-use.md`: installed the worktree build, created an outreach-only demo project, checked the RPC returned that project, and verified HTTP 200 from the signed-in BB desktop profile before interacting. Captures are cropped to remove the unrelated sidebar.

- **Queue — met.** Rhea was the only item, the rail badge showed one, and her record showed the original log plus Busy operators. [Initial Queue](queue.jpg). Clicked Mark handled: Queue 0, clear state. Show handled revealed Undo handled, which restored Queue 1. Hid handled again, pressed `h` with Rhea's record open, and observed the badge disappear. Ran `bun scripts/outreach-demo.ts reply <root>`; without refresh Queue returned to 1 and the open record gained `demo-reply-2` (same day). [Resurfaced reply](resurfaced.jpg).
- **Candidates — met.** Busy operators grouped Pat P1 ahead of Charlie P3. Selecting Busy operators in the filter retained both; the seed has no other group to demonstrate exclusion. [Two selected candidates](candidates.jpg).
- **Discuss people — partly met.** Discuss 2 opened a dialog promising the records and their hypotheses, but the draft showed only Pat and Charlie. Submitted a short synthetic prompt. The sent message showed two chips, and the thread header's Outreach 2 menu contained exactly those two people. [Thread with two person mentions](discuss.jpg). Clicking Pat opened his record, and Threads → Verify operator handoff status took me back to that same thread. Busy operators was missing from the draft, sent message and header. [[projects/mlegls-pi/issues/outreach-discuss-omits-shared-hypothesis]].
- **Hypotheses — met through the draft.** Busy operators showed `3 people · 1 replied · 1 confirm · 0 kill · 2 open` and a decision bar. Its Discuss action opened a draft with just `~Busy operators`; closed without submitting. [Rollup](hypotheses.jpg).
- **Other views — met for the seed.** All showed all three records, Dropped showed `No dropped people`, and the footer showed `Beeper: no sync yet` and `Gmail: no sync yet`. No nonempty dropped state or successful/offline sync status was driven here.
- **Not observed:** follow-up-only queue entries and due-date resurfacing (reply-only seed); manual `~` picker (typed `~Busy` without seeing suggestions before the window disappeared; retry from a fresh composer with individual keystrokes before drawing a conclusion).

## Replay checks

1. Mark Rhea handled, show and undo her, then press `h` on the open record. Require Queue 0 and no rail badge; run the documented `reply` command and require Queue 1 with both log IDs without reloading.
2. Select Pat and Charlie and submit through Discuss 2. Require the two person mentions and one Busy operators mention in the draft, sent message and thread Outreach menu. Follow each person link and click the new thread in the record's Threads section. For Hypotheses → Discuss require only Busy operators.
3. Seed different hypotheses to establish exclusion, and a contacted record whose follow-up is already due to establish Queue's other source. Mark the latter handled, change its due date to a different due date, and require it to return without reload.

The desktop instance disappeared toward the end of the drive and close retries returned stale generation. [[projects/mlegls-pi/issues/bb-desktop-browser-disappears-before-session-cleanup]]. Stopped the synthetic thread, removed the disposable project/repo, and restored the prior tracker deployment.

## Review replay

All eight claims now hold. On `bb-plugins` `fb98bae`, with the built plugin running and the demo project present in the `outreach` RPC, Discuss 2 opened **Discuss 3 records** with Pat, Charlie and Busy operators. Sending a synthetic prompt produced three mention chips; the thread’s Outreach 3 menu listed two people and one hypothesis. [Replacement capture: sent message and return links](discuss.jpg). No change to the original hypothesis-only draft or person-to-thread navigation paths.

Extended the disposable demo with a Solo hypothesis/candidate and a messaged Due Contact. Selecting Busy operators excluded Solo and retained Pat P1 then Charlie P3. Marking Due Contact handled reduced Queue 2 to Queue 1. Editing only `next_followup` from `2026-11-14` to `2026-11-15` restored Queue 2 and showed the new date without reloading. In the resulting thread composer, typed `~Pat`, waited for the matching candidate result, selected it and typed ` ~Busy`. The picker offered `busy-operators` labeled `hypothesis · active` for the same project. Search results took longer than the first snapshot to appear.

`bb plugin build .` and `bunx tsc --noEmit` passed. Desktop cleanup across instance generations is tracked in [get-bb/bb#7534](https://github.com/get-bb/bb/issues/7534#issuecomment-7062553249).
