# Independent CLI drive

Revision: `4a1e90c64c2754d4ec3e7fe86bda76fbf6e315ad`.

## Predictions before opening the product

From the parent/child tickets, CLI help and tracker user instructions:

1. **Block replacement:** read a disposable text file, replace an inclusive range with `=a =b`, then repeat with `=a b`. Both should accept the replacement and leave outside lines untouched. Reusing a changed anchor should fail without a new write. Test adequacy is for review; no source or tests will be read.
2. **Mail:** send to an offline/unsubscribed recipient. Expect a recorded message ID and retained warning but nonzero exit status. Unknown subscriptions should warn without claiming definite failure; recognized live recipients should return zero. Acceptance proves recording/subscriber recognition, not consumption.
3. **Scoped tracker repair:** run read-only `check`, then `check --fix <archived path>`. Expect only references/blockers targeting that moved file to change. Unrelated dirty prose and unrelated done blockers should survive byte-for-byte. Other findings should remain reported; a nonzero overall status is expected until those are repaired. Archive user instructions should use scoped fixing (observed before setup).
4. **Code examples:** inline/fenced wikilink examples should neither be diagnosed as live links nor rewritten, while a neighboring real broken link is diagnosed and a real moved link can be repaired. The rollout example should appear as unescaped inline code.

## Setup plan and ownership

Handoff: local CLI, local author/offline Pi recipients, no authentication; committed isolated anchor/tracker setup; `bash docs/attachments/small-ab-cli-fixes/setup.sh`.
Owned target: this worker's checkout, not the canonical checkout. Ambient `ab` resolves to `/Users/mlegls/dev/mlegls-pi/bin/ab`; use the checkout-local entry point supplied by setup. No inherited board/state selector will be used for destructive seeding. No browser, remote deployment or dev server is needed.

## Setup encounter and developing expectations

Setup completed synchronously. It created `.wm/tracker-scoped-drive/scoped-drive` with dirty `mixed.md`/`other-session.md`, moved A/B archive notes, and private HOME/vault; anchor state paths were printed. It did **not** print tracker invocation selectors or create mail recipients. Reconstructed tracker invocation from user docs; mail isolation/recipient launch from the earlier public mail packet. Before sending, expect `mail --stats` to show zero with `XDG_DATA_HOME` set, since AB_STATE alone is not a board selector. Before launching Pi, remove inherited worker/session selectors, load only checkout-local extensions and await RPC `get_state`.

The required peer-board read exposed prior outcomes before predictions; this is not a fully blind drive. Existing owner: [driver board read](../../issues/driver-board-read-leaks-implementer-conclusions.md).

Anchor journey: sigiled replacement accepted (exit 0); legacy replacement accepted (exit 0); changed anchor retry rejected (exit 2) without a write. Outside `before`/`after` lines survived. Prediction 1 met. [Transcript](drive-edit.txt).

Tracker journey so far: read-only check kept both hashes unchanged; scoped A/B fix updated the three real A/B links (including alias), left inline/fenced examples, dirty prose and older references unchanged. `other-session.md`, including its unrelated done blocker, remained byte-identical. Exit 1 correctly reflected remaining findings. Prediction 3 met. [Transcript](drive-tracker.txt).

Next: add a user-authored note with missing links only inside inline/backtick/tilde fences; expect no new diagnostics. Add a neighboring live missing link; expect its exact name reported. After deleting that intentionally broken live link, unscoped fixing should repair only real older links/drop its blocker and report `ok`, leaving example text untouched. Table aliases with escaped pipes should keep their escape after moving.

## Remaining encounters

**Code masking: held.** A user-authored note added inline and double-backtick missing examples plus both backtick and tilde fenced examples. `check` reported only the real moved table alias and preexisting findings. Adding `missing-live` outside code produced its exact missing-link diagnostic. Removed that intentionally broken live link; scoped fixing preserved the table alias's escaped pipe. Unscoped fixing then repaired older real links/dropped its done blocker and returned `ok`, exit 0; a subsequent read-only check also returned `ok`, exit 0. All example text remained unchanged. Prediction 4 and the developing code/table expectations met. [Transcript](drive-tracker.txt).

The rollout packet's literal `[[parent]]` example is unescaped inline code, observed through the text surface (not rendered UI). [Excerpt](drive-rollout-example.txt).

**Mail: held.** Empty initial stats established a separate board. Sending to an absent topic returned exit 1, a recorded ID and the definite warning; an exact board read showed the post persisted. A metadata-only offline Pi returned successful RPC readiness, then its mailbox returned exit 0 with “could not confirm a live subscriber.” A metadata+board Pi returned successful readiness; mailbox and worktree sends returned exit 0 without warnings. After stopping and awaiting that recipient, mailing its former mailbox returned exit 1 with the definite warning. Final stats accounted for all five sends: one ticket, three mailbox, one worktree. Prediction 2 and empty-board expectation met. [Transcript](drive-mail.txt).

The initial Pi launch used disposable HOME and failed before readiness because the local launcher sought its installed runtime under that HOME. Both owned processes in the subsequent successful run were terminated and awaited. Workaround: inherit HOME but isolate PI_CODING_AGENT_DIR, session-dir, XDG data/state and AB state; remove inherited worker/session selectors and authentication environment variables. [Failed launch](drive-mail-first-attempt.txt). Filed with the accessible owner tracker: [[projects/system-config/issues/pi-launcher-resolves-installed-cli-against-temporary-home]], commit `7e35af5`. No authentication was configured in the isolated persona. Provider activity was not measured; this drive tests send status, not consumption.

The first successful mail pass removed API-key variables but missed an inherited generic token. Repeated the full five-send journey with every environment name matching `KEY|TOKEN|AUTH|CREDENTIAL` removed, still using an empty isolated Pi config. All outcomes were identical; `drive-mail.txt` now contains this stricter no-auth replay. Neither pass measured provider activity or message consumption.

## Frictions and expectations

- Setup reached the anchor/tracker surface, but further commands required the public evidence recipes. [Existing handoff owner](../../issues/mail-drive-handoff-names-only-a-test-runner.md); setup discoverability expectation **not met** by stdout alone, resolved through docs.
- Peer-board read disclosed previous outcomes before predictions. [Existing drive-preamble owner](../../issues/driver-board-read-leaks-implementer-conclusions.md); blindness **not met**.
- Board discovery hit shared history and produced a very large topic list; no synthetic posts went there. AB_STATE-only mail isolation expectation **not met**; explicit XDG_DATA_HOME empty preflight **met**. [Existing board-selector owner](../../issues/document-board-store-selector-for-mail-drives.md).
- Disposable-HOME Pi readiness expectation **not met**; unchanged HOME plus isolated configuration/data/state **met**, as filed above.
- Exit-1 sends still print IDs, but status and stderr correctly distinguish recording from definite delivery failure. This is the contract's allowed nonzero alternative, not a failed claim.
- All four behavior predictions and developing preservation/live-link/table-alias expectations **met**.

## Replayable checks

Run committed `setup.sh` in a fresh checkout after `bun run setup`; it refuses an already-existing tracker fixture. Use checkout-local `./bin/ab`, not ambient `ab`. Set AB_STATE/AB_SESSION_STATE to `.wm/joined-state/ab` and `.wm/joined-state/session` for anchor commands.

1. Create a four-line file containing `before`, `first`, `second`, `after`; read it and copy first/second anchors. Replace with `=FIRST =SECOND` and two new lines. Accept exit 0, exactly those new middle lines, unchanged outside lines. Reuse the old header; accept nonzero, unchanged file. Read fresh anchors and replace with `=FIRST SECOND` and `legacy`; accept exit 0 and exactly three final lines. [Actual commands/outputs](drive-edit.txt).
2. Set `ROOT` to the checkout; `STATE=$ROOT/.wm/tracker-scoped-drive`, `TRACKER_PROJECT=$STATE/scoped-drive`, `HOME=$STATE/home`, `TRACKER_VAULT=$HOME/obsidian`, `TRACKER_NO_INFLIGHT=1`; run the local `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts` with Bun from that target. Save hashes of mixed/other-session. `check` must report findings with exit 1 and unchanged hashes. `check --fix docs/issues/archive/move-a.md docs/issues/archive/move-b.md` must change only real A/B references (including alias), preserve dirty prose/code/older links and leave other-session byte-identical including its blocker. Accept exit 1 for still-reported unrelated findings.
3. Add `examples.md` exactly as shown in the [tracker transcript](drive-tracker.txt), initially with the table target `move-a` rather than `archive/move-a`. `check` must never report the four missing code-example targets. Append a live `[[projects/scoped-drive/issues/missing-live]]`; accept that exact diagnostic and exit 1. Remove only the intentionally broken live link and run scoped A fixing; accept `[[projects/scoped-drive/issues/archive/move-a\|table alias]]`, untouched example text and unrelated findings retained.
4. Run unscoped `check --fix` then `check`; accept each exit 0 with `ok`, older real links archived and done blocker removed, dirty prose/code examples preserved.
5. Follow the [public mail setup recipe](../make-undeliverable-mail-status-visible-to-scripts/index.md#independent-cli-encounter), but retain original HOME and use a fresh `.wm/drive/mail` for all explicit configuration/data/state/session selectors. Strip inherited PI_/WM_/AB_/XDG_/TRACKER_ variables before applying selectors, and remove every environment name matching `KEY|TOKEN|AUTH|CREDENTIAL` (case-insensitive). `mail --stats` must be empty. Send absent-topic mail and read that exact topic: accept ID retained in the post, exit 1 and definite warning. Launch metadata-only Pi and then metadata+board Pi with explicit checkout-local extensions, await successful `get_state` before sending to each exact mailbox. Accept unknown exit 0+cautious warning, live mailbox/worktree exit 0+empty stderr. Stop/await the live process, resend: accept exit 1+definite warning. Final stats must count all five sends. [Actual readiness/status outputs](drive-mail.txt).
6. Observe the rollout packet's `[[parent]]` example inside inline code without backslash-escaped brackets. Accept literal inline code, not a live navigation link.

## Limits and cleanup

No product source, diff, tests or fixture implementation was inspected. Required test adequacy is left to the reviewer; running existing regressions does not establish their assertions. Unknown mail state used a live metadata-only recipient, not an actual daemon restart. Recognition/recording never establishes consumption. CLI/text only: `visual: false`, `shots: []`.

No browser, dev server, container, tunnel or remote deployment was started. Every owned Pi process was stopped and awaited; no matching process remained in the process listing. Disposable scratch is removed after evidence capture. The only outside-checkout filesystem change is the committed owner-tracker issue in system-config; unrelated preexisting system-config edits were not staged.

Existing joined regression command completed successfully: `./bin/ab check -- bun-axi test lib/outline-read lib/board/mail-drive.test.ts skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts`; **76 passed across 8 files**, 15.5 seconds of test execution. [Result](drive-regressions.txt).
