# Sigiled second anchor: CLI drive

## Predictions (before fixture interaction)

From the ticket and `ab edit --help`:

- **P1:** Reading a five-line scratch file and submitting `=start =end` for its middle three lines will succeed, replace that inclusive range, and preserve both outside lines.
- **P2:** The same operation with documented `=start end` will still succeed with identical file contents.
- **P3:** Reusing the changed range's old anchors will reject the edit without modifying the file (the ticket explicitly promises stale-anchor safety).
- **P4:** A sigiled second anchor followed by an explicit `@PATH` file assertion should work, since help permits a file assertion on each hunk.

The ticket also requires a test. Its existence is not observable through the user's CLI; the driver will not inspect tests or implementation.

## Setup

- Tested revision: `4678f1c5a579bb614448b2c85873b4d7f3269dfd`.
- Setup handoff was `null`; reconstructed local CLI setup from README's Development section.
- Owned target: this drive worktree; scratch text and isolated anchor state under `.wm/anchor-drive/`. No remote deployment, authentication, or browser.
- Persona: local shell user editing a disposable text file.
- Entry point: checkout-local `bun ab/main.ts`; ambient `ab` resolves to the canonical checkout, so it is not used for the behavior under test.
- Seed: five-line UTF-8 text (`before`, `old one`, `old two`, `old three`, `after`).
- Setup readiness and actions recorded below after execution.

## Session log

1. `bun run setup` completed successfully from this checkout (all four dependency installs reported no changes). Checkout-local `bun ab/main.ts edit --help` responded and explicitly documented both spellings. No service was needed.
2. Read `sigiled.txt`: the middle range had anchors `afhp` through `aata`. Submitted `=afhp =aata` with two replacement lines. Exit **0**, “1 edit applied (5 → 4 lines)”; fresh read showed exactly `before`, `new first`, `new second`, `after`. **P1 met**.
3. Reused `=afhp =aata` with `should not appear`. Exit **2**, “unknown anchors afhp, aata … Nothing was modified.” Fresh read confirmed unchanged four-line content. **P3 met** (invalidation appears as unknown anchors).
4. Repeated on `unsigiled.txt` using `=kfhp kata`. Exit **0**, same four lines; `cmp` between the two edited files exited **0**. **P2 met**.
5. Read a third identical file `asserted.txt`; middle anchors were `sfhp` and `sata`. Next action will use the explicit file assertion.

### Additional expectation formed while driving

- **P5 (before trying it):** A sigiled-range header after a blank line should start a second hunk rather than be copied into the first hunk's body. I will combine an ordinary first-line replacement and a sigiled-range second hunk in one submission. Success means both changes appear and the header does not appear as file text.
6. Submitted `=sfhp =sata @.wm/anchor-drive/asserted.txt`. Exit **0**, 5 → 4 lines; fresh read showed the same expected content. **P4 met**.
7. Read `multiple.txt`, then submitted a first hunk `=7t7n` replacing `before` with `changed before`, a blank line, and a second hunk `=7fhp =7ata` replacing the middle three lines. Exit **0**, “2 edits applied (5 → 4 lines)”; fresh read showed `changed before`, `new first`, `new second`, `after`. **P5 met**.

## Outcomes

| Claim | Outcome | Observable evidence |
| --- | --- | --- |
| Sigiled second anchor is accepted | held | Action 2: exit 0, inclusive middle range replaced |
| Existing unsigiled spelling remains accepted | held | Action 4: exit 0, byte-identical result |
| Test accompanies the change | unobservable | Driver does not inspect tests; review must establish this |

No rendered UI; screenshots do not apply.

## Frictions

- Setup handoff was empty. README setup and a checkout-local entry point were enough to complete preparation without intervention.
- Ambient `ab` resolves to the canonical checkout, not this worker's checkout. Used `bun ab/main.ts` for every product interaction to avoid testing the wrong revision.
- No friction in the replacement journey itself. Checkout-local help describes both forms. Unknown-anchor rejection clearly says nothing changed.

## Replayable checks

All checks use `bun ab/main.ts` from the tested checkout, with `AB_SESSION_STATE` and `AB_STATE` assigned to an isolated scratch directory; no shared anchor state. Seed each input file with `before\nold one\nold two\nold three\nafter\n` and obtain fresh anchors through `read`. The literal anchors above are illustrative and must not be reused in a new session.

1. **Sigiled block:** Submit `=SECOND =FOURTH` and body `new first\nnew second`. Accept exit 0 and exact resulting bytes `before\nnew first\nnew second\nafter\n`.
2. **Legacy block:** On a separate seeded file submit `=SECOND FOURTH` with the same body. Accept exit 0 and the same bytes, equal to check 1.
3. **Invalidated anchors:** After check 1, submit its old `=SECOND =FOURTH` and body `should not appear`. Accept nonzero exit, rejection explaining invalid anchors/no modification, and byte-identical contents before/after the rejected attempt.
4. **File assertion:** On a fresh file submit `=SECOND =FOURTH @PATH`. Accept exit 0 and the same result as check 1.
5. **Second hunk boundary:** On a fresh file submit `=FIRST`, body `changed before`, a blank line, then `=SECOND =FOURTH`, body `new first\nnew second`. Accept exit 0, two edits, and exact bytes `changed before\nnew first\nnew second\nafter\n`; no header text or extra blank line in the file.

## Cleanup and scope

No servers, containers, tunnels, or browsers started. Scratch state remains only inside this worktree's `.wm/anchor-drive/` and is not part of the durable packet. No source, diff, test, or fixture inspection; no product repairs. Review remains responsible for confirming the ticket's test requirement.

## Review

Diff read with the log. `parseHeader` (`lib/outline-read/edit.ts`) strips a leading `=` from the second token of a two-anchor replace only; `-`/`>`/`<` are unchanged. Stale-anchor safety is downstream of parsing and untouched.

Test story: held. `lib/outline-read/edit.test.ts` covers `=aaaa =bbbb` in `parseHunks` and the edit-tool block replacement now uses `=a =b` end to end (`=a b` remains covered by the existing `parseHunks` assertion). `bun test lib/outline-read/edit.test.ts`: 20 pass. No repairs needed; no further tests added.
