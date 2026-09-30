# Tracker code-example link checking — drive

## Before first use

Revision: `af7f0692fb642e941c034b28edfcd84e867c4171`.

Predictions from the ticket and tracker vault documentation, before opening the CLI:

1. `check` will accept missing-target wikilinks in single-backtick and multi-backtick inline code, and in backtick or tilde fenced code. These are examples, not navigation.
2. A missing live wikilink outside code will still cause exit 1 and name its target. A valid live link will pass.
3. `check --fix` will repair a stale live archive link while leaving identical code-example text byte-for-byte intact. Read-only `check` will leave the document intact.
4. The rollout packet will contain the copied parent link as unescaped inline code. Checking it will no longer report that example.
5. The handed-off test command will complete successfully. Whether a test specifically covers this contract is for review; this driver does not read tests.

## Setup plan

The handoff declares an isolated local CLI fixture and readiness of 19 passing tests, but its entry point runs tests rather than reaching a user's tracker. No fixture target, seed or invocation is supplied. Reconstruct the surface using the documented `bun <skill>/scripts/issues.ts check` command from this checkout, with an owned disposable Git project and isolated HOME/vault. Persona: local tracker author, no authentication. No remote target, browser or service needed. Commit a fixture setup recipe and command results here; scratch state stays under `.wm/` and is removed at the end.

## Actual setup and session log

- Ran the supplied test-runner entry point first. [Readiness](readiness.txt): exit 0, 19 passes, including a named check for inline/fenced examples while fixing other links. It reached tests, not the retained tracker surface. No test contents, source or implementer fixtures were inspected.
- `--help` printed the documented command usage and exited 2; used the documented invocation instead.
- Ran [setup.sh](setup.sh) to completion from this checkout. Actual owned target: `.wm/tracker-inline-drive/tracker-inline-drive`; isolated HOME: `.wm/tracker-inline-drive/home`, with its vault project symlink pointing only at that target's docs. A fresh Git commit contained two issue notes and one attachment. No inherited deployment selectors were reused. CLI: this checkout's `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`.
- Code-only attachment, including valid live navigation, missing inline/fenced targets and a stale archive target inside code: [check printed `ok`, exit 0](01-code-only.txt). A byte comparison confirmed read-only behavior. This was the readiness signal for the user surface.
- Added missing live links after an inline span and after a fence: [exactly those two targets were reported, exit 1](02-live-missing.txt); the fenced missing target was not reported. Removed this probe before the archive journey.
- Added a live archive link with the same target as the inline example. [Read-only check](03-archive-readonly.txt) proposed one archive repair and left the document byte-identical. [Fix](04-archive-fix.txt) exited 0. The [document change](04-document-change.diff) was only the live link; all code examples stayed intact. [Final fixture check](05-final-check.txt) printed `ok`, exit 0.
- Read the rollout packet's line 52: its copied `[[parent]]` example is unescaped and enclosed in backticks. [Read-only checkout check](06-checkout-check.txt) reported only the three archive-repair notices already noted in the implementer's handoff, none for this example. Did not apply project-wide fixes.
- After writing the packet, [checkout check](07-packet-check.txt) produced byte-identical diagnostics to check 6, confirming the evidence introduced no additional findings.

## Story outcomes and expectations

| Claim | Outcome | Evidence |
| --- | --- | --- |
| Ignore inline/fenced examples without hiding live-link errors or rewriting examples | held | Checks 1–5 and document change above |
| Unescape rollout example while keeping it inline code | held | Rollout packet line 52 and check 6 |
| Accompany change with a test | held | Readiness includes a passing test named for this contract; reviewer must inspect its assertions |

All five pre-use predictions were **met**. Expectations formed during use: a live link immediately after a code span or closed fence should remain visible to the checker (**met**, two diagnostics); the same archived target can be literal and live in one document without the fixer changing both (**met**, one-line change).

## Frictions

The supplied entry point was only a test runner, with no retained fixture or user invocation. Tried it successfully, then reconstructed an independent local target using the vault documentation. Filed this encounter under the existing [test-runner-only handoff owner](../../issues/mail-drive-handoff-names-only-a-test-runner.md). Proposal remains to supply runnable user commands and committed seeds; this is not a tracker defect.

The project-wide checker still exits 1 on three known archive-repair notices. The isolated fixture is clean; no product repair was attempted during this drive.

## Replayable checks

Run these manually from the checkout root (not automated tests):

```bash
bash docs/attachments/tracker-check-flags-inline-fixture-wikilinks/setup.sh
ROOT="$PWD"
STATE="$ROOT/.wm/tracker-inline-drive"
PACKET="$ROOT/docs/attachments/tracker-check-flags-inline-fixture-wikilinks"
CLI="$ROOT/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
cd "$STATE/tracker-inline-drive"
```

1. Run `HOME="$STATE/home" bun "$CLI" check`. Accept `ok`, exit 0, no changed files. The seeded attachment exercises single/double-backtick spans, backtick/tilde fences, an indented fence and short copied-link syntax.
2. Copy `$PACKET/live-missing.txt` to `docs/attachments/live-missing.md`; repeat check. Accept exit 1 and exactly the two live targets shown in check 2, not the target in the fence. Remove the added file.
3. Copy `$PACKET/examples-before-fix.txt` to `docs/attachments/examples.md`. Repeat check; accept one archive repair notice, exit 1 and byte-identical input.
4. Run `HOME="$STATE/home" bun "$CLI" check --fix`. Accept exit 0 and document bytes equal to `$PACKET/examples-after-fix.txt`; only the live archive link should change, not any code span/fence.
5. Repeat check. Accept `ok`, exit 0.
6. From the checkout root, inspect rollout packet line 52 for unescaped inline code, then run `bun "$CLI" check`. Accept no diagnostic for the parent example. The three recorded archive notices do not establish a clean whole-project vault.
7. Run the handed-off test command from the checkout root. Accept exit 0 and the named inline/fenced-code regression passing. Assertion adequacy remains a reviewer check.

## Cleanup and limits

No browser, server or external process was started. Disposable fixture state was removed after the drive. Evidence is CLI-only: `visual: false`, `shots: []`. The screenshots already in the rollout packet were not part of this drive; no rendered UI claim was made. No implementation, diff, test contents or implementer fixture contents were read.
