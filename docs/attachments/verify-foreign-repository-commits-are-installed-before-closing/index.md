# Foreign-repository completion drive

## Predictions before first use

1. A reviewed foreign commit present only on its implementation branch should prevent completion and raise an exception.
2. Once the configured loaded checkout contains that commit, completion should close normally.
3. Existing same-repository completion should continue working.

## Setup and reproduction

Tested revision: `a49fc773a2be2f5ad3d72c5f0242958729847cc8`.
Entry point: `bun test lib/reconcile/completion.test.ts`, run from this ticket's drive worktree with Bun 1.4.4.
The supplied setup is a local developer-facing protocol fixture, using disposable `/tmp/rc-protocol-*` Git/tracker repositories owned and cleaned by the runner. No services, authentication or browser are required. Seed, per the handoff: a foreign implementation branch contains a commit absent from the configured pi source. The supplied setup and encounter are the same command; it completed successfully in 4.46 seconds. No inherited deployment selectors were used.

## Actions and observations

Ran the supplied entry command without reading implementation, tests or fixtures. It exited successfully: **3 passed, 0 failed, 45 assertions**.

Reported cases:
- `foreign handoff commits hold closing until the configured loaded checkout contains them` — passed.
- `landings carry leaf results to the owner, replay merged code and incomplete child-first closes after retirement` — passed.
- `a close holds on a cited packet that exists only on a drive branch, names it, and closes once the target has it; unrelated stale links never block` — passed.

## Stories and expectations

- Missing loaded foreign commit holds completion: **held through the supplied runner**, prediction 1 met at that surface.
- Loaded foreign commit permits completion: **held through the supplied runner**, prediction 2 met at that surface.
- Existing completion behavior: prediction 3 met for the two other reported protocol cases.

The observable evidence is the runner's case outcomes. The missing-commit exception's exact payload and the final tracker state are not printed by this surface; they were not independently inspected. This is a fixture-backed encounter, not a live reconciler closure or proof about the user's installed pi checkout.

## Replayable checks

Run `bun test lib/reconcile/completion.test.ts` at the tested revision. Accept a successful exit with the named foreign-handoff case passing, plus both existing completion cases passing. A failing foreign-handoff case contradicts the supplied completion contract and requires investigation before acceptance.

## Frictions and cleanup

No execution friction observed. The handoff exposes aggregate assertions rather than a human-readable exception/closure transcript; review must assess the assertions behind that result. No rendered journey, screenshots, services, browser pages or long-lived processes. The runner completed; disposable fixture cleanup belongs to its supplied lifecycle.
