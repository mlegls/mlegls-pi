# dsh-port root review

Reviewed `19cc62b..b2d1632` at the integration seams, not a second leaf audit.
Repairs: `e04beee`, `54f2f4d`.

- Skim now owns retention without stock spill/pruning truncating its input. Removed
  the duplicate spill-local registration; both Web and headless compose each plugin once.
- Retained locators replay from ignorable session events, including inherited fork
  history. Explicit pulls opt their program's output out of another skim pass.
- Forks reset board delivery state and inherited queued board notices; same-session
  replay keeps subscriptions/cursor/seen. Malformed shared-log records remain contained.
- The full headless overlay disables stock filesystem tools, removing the duplicate
  hashline `read` registration. Its small registry adapter is `dsh/cordis.headless.yml`.

## Setup and evidence

Live revision `e04beee`, clean checkout, Node 24, pinned dsh 0.1.7-rc.2.
`cd dsh && bun run setup` completed ([build log](setup.log)). Local headless
DeepSeek Flash PTC, environment API key (not recorded), checkout-owned
`dsh/.local/root-review/home`; all six PI_BOARD/PI_WM identity variables unset.
No browser or remote deployment. Session `session-4bdb51e2-1382-4955-8887-ddd34d914e64`.
Entry command is the README's Live headless turn, using both `cordis.yml` and
`cordis.headless.yml`, plus `provider.deepseek.yml`.

| Claim | Outcome | Evidence |
|---|---|---|
| Hashline edit, scratch, skim/pull and board_send in one PTC program | held | [original session records](session-excerpt.json), tool/result 41: alpha/BETA readback, scratch `{ok:true}`, exact 7,000-character explicit skim recall, board post `muju0ijk-ig9u4f` |
| Automatic over-budget SHA-256 fallback retains the full result | held | seq 60/61: `ing-efaa2733a46a9744`, 168,019 characters; seq 68 asserts exact equality |
| Printed pull is not skimmed/spilled again | held | seq 68 contains all 11,000 requested characters plus the equality report (11,150 total) |
| Restart recalls a locator; scratch deliberately disappears | held | [fresh-process continuation](resume.json): exact 168,019 characters, scratch found=false |
| Board fork identity, queued-wake retraction and malformed-record robustness | held | `dsh/board/index.test.ts`; new fork gets only its own mailbox, drops inherited wake; malformed record does not stop delivery |
| Ignorable append patch covers every overlay writer | held | `dsh/session-patch.test.ts`: board subscriptions/cursor/seen, memory checkpoint, skim retained all survive JSON replay off-surface |
| Web/headless composition and all bundles | held | `dsh/overlay.test.ts`, [final overlay inventory](overlay.json), setup log |
| Memory surface replacement, checkpoint/tail, same-session/fork citation recall | held | Unchanged provider; reviewed [saved memory packet](../dsh-memory-compaction-provider/index.md), exact rerun log and actual trajectory images 13/14 |
| Shared board idle wake and child cancellation monitor | held | Reviewed [board packet](../dsh-board-host/index.md) and actual image 02; same-session logic unchanged; fresh shared-store post confirmed from Pi |
| Preset-routed children, immediate handles, board result/wake and crash monitor | held | [driver packet](../dsh-templated-spawn-and-dispatch/index.md); its black-box test rerun with retained probe log |

One intermediate model program appended `return "emitted"` to the requested large
output; its equality check correctly failed. It re-emitted without that return,
then proved exact equality. This was not a retention repair.

Headless `--json` clips tool-result display to 8,192 characters. The exact-output
assertion above uses the persisted event, not the clipped CLI display. Excerpts
retain original event objects, omit reasoning, and contain no credentials. This
root journey is backend-only (visual: false); cited leaf images remain their
original encounters, not new screenshots establishing the fork repair.

## Checks and limits

[Tests](tests.log): board/store/query, ingress, route assignment/dispatch, shared
memory, overlay replay and driver evidence. Focused strict TypeScript check passed
for skim, board and memory. No driver's test was weakened. Hashline and transform
share the process-wide Symbol-backed per-agent ledger despite separate bundles.
The local session/subagent patches and lock metadata remain intact.

Residuals have owners, outside this ticket's execution tree:

- [Web teardown with a live child](../../issues/dsh-web-shutdown-inbox-projection-order.md): individual cancellation passed; whole-host teardown not re-driven. Exact diagnostic originates in upstream inbox projection disposal.
- [Dispatch evidence limits](../../issues/dsh-dispatch-unexercised-admission-and-resume.md): board-only wake, unpinned classification, cold continuation and saturation remain unisolated/untested.
- [Headless JSON clipping](../../issues/dsh-headless-json-clips-tool-results.md): verification uses persisted records.
- [DeepSeek request preparation](../../issues/dsh-web-deepseek-extension-preparation-fails.md): existing two-plugin disable workaround retained.
- [Default workspace outside DSH_HOME](../../issues/dsh-web-default-workspace-outside-home.md): existing checkout-workspace helper retained; no Web launched here.
- [Unsupported SOCKS proxy](../../issues/dsh-unsupported-socks-proxy-falls-back-to-direct.md): warning recurred; direct connection succeeded.
- [Bash board acknowledgment](../../issues/board-acks-are-a-host-runtime-event.md): peer reads worked, `ab lib board ack` did not; recorded under its existing owner.

Spill retention is bounded by upstream local-file cleanup (default 30 days).
Scratch and hashline ledgers remain intentionally ephemeral. No acceptance claim
is made for semantic skim quality or host-process-death isolation.

## Final clean-checkout check

After removing the duplicate spill backend, a clean checkout of `6d7ddec` ran
`cd dsh && bun run setup` again, then one fresh headless DeepSeek PTC turn with
all six inherited identity variables unset. [Exact public calls/results](final.json)
show one `run_code` completing hashline edit/readback, scratch put/get, explicit
skim/exact pull, and board_send. All four checks are **held**. The [Pi-side
readback](final-board.json) confirms `DSH_ROOT_FINAL_OK` from the new DSH session.
No duplicate hashline registration warning occurred. Setup rebuilt all eight
bundles; no runtime change followed this check.

51 focused tests passed (49 regressions/driver assertions plus 2 overlay checks).
Strict TypeScript checking also passed for dispatch/template. Tracker check has
no dsh findings; four unrelated stale prerequisites remain in supervision issues.
Moved the existing default-workspace idea out of the dsh-port execution tree and
removed completed spike prerequisites/broken evidence link from child tickets.

Both headless processes exited. No Web, browser, child, tunnel or container was
started. Owned temporary spill files were removed after replay verification;
worktree-local ignored homes and fixtures remain for retirement. The two verification
board posts remain in the shared append-only log.
