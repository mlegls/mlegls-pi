# Red-main repair admission: drive

## Predictions before use

- A repair touching a different file will be admitted if its issue body or handoff names the current red SHA, including its verify-main log path.
- An owner resolving a red-held node with `red-repair` will admit that node.
- Without either signal or a matching changed diagnostic file, it will remain held.
- Admitted repairs will still run pre-integrate; admission alone will not turn the main verification verdict green.

## Setup

Revision: `66b036524076231103a1c725b4d5555a5f72a8ab`, in the assigned drive worktree. Local reconciler CLI with disposable Git/tracker fixtures, no authentication. The implementer's committed replay creates and removes its own repositories and fake BB threads; no inherited live deployment is used. Developer persona; the ticket explicitly requests tests as the acceptance surface. No source, tests or fixtures were read.

Replay: `bun test lib/reconcile/red-repair.test.ts lib/reconcile/checks.test.ts`.

## Encounter and outcomes

The supplied replay completed successfully in 7.57 seconds: **9 passed, 0 failed, 50 assertions**.

- **Held: cross-file repair admitted by owner designation.** Output: `owner designated root as repair for the current red main`, then `landed root in the owner's checkout`; the owner integration scenario passed.
- **Held: cross-file repair admitted by issue body.** The body integration scenario printed `landed root in the owner's checkout` and passed.
- **Held: cross-file repair admitted by handoff.** The handoff integration scenario printed `landed root in the owner's checkout` and passed.
- **Held through the supplied runner: unrelated code remains held.** `red main admits a landing that touches a file its diagnostics name, and holds other code` and `red main admits issue and handoff SHA references and owner designation, holding unrelated code` passed.
- **Held through the supplied runner: admission uses normal integration.** All three integration scenarios passed with the description `without bypassing integration`. The setup handoff states these scenarios declare pre-integrate. No live main was modified or independently monitored; a subsequent real verify-main verdict was outside this disposable replay.

## Expectations

All admission predictions were met by the named replay scenarios. Normal integration was met at runner level. The expectation that admission does not itself certify green was not separately observed against live main; this drive's evidence is the authorized disposable-fixture replay, not a live deployment claim.

## Replayable checks

1. Run the replay command above at the recorded revision. Accept body, handoff and owner scenarios only if each reports a normal landing and passes its integration assertions.
2. Check the unrelated-code scenario passes; the acceptance result is remaining held absent a matching diagnostic file, red reference or owner designation.
3. Check all three `without bypassing integration` scenarios pass; the acceptance result is exercising declared pre-integrate rather than bypassing it.

## Frictions and limits

No operational friction: setup was self-contained and the replay completed on its first run. CLI-only journey: no rendered UI or screenshots. Runner assertions were treated as the supplied acceptance surface, without inspecting implementation or fixtures. No server, browser or external deployment was started.
