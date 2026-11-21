# Repository hook enablement: first-use drive

## Predictions before using the CLI

- With no configured hook path and sample-only default hooks, the documented repository hook enablement command should run. An ordinary commit afterward should invoke the shipped pre-commit hook.
- With a configured hook path, attempting that same setup should leave the existing configuration alone.
- With an existing custom default hook, attempting setup should leave that hook in place and active.

## CLI encounter

Driven at `6f0ba29f` as a supervised worker using the supplied offline replay. Each invocation creates and removes its own disposable Git repository. No credentials or service needed.

Run `bun docs/attachments/worker-hook-guard-refuses-enabling-repository-hooks/replay.ts` with the suffix shown below. The replay sends the documented `git config --local core.hooksPath scripts/hooks` through the guard, then makes an ordinary empty commit. Readiness was confirmed by the successful fresh commit and hook marker.

| Suffix | What to check | Observed |
| --- | --- | --- |
| None | Setup is admitted and the commit prints `shipped pre-commit ran`. | Met: both happened. |
| `configured` | Setup is refused and the commit prints `configured pre-commit ran`. | Met: both happened. |
| `custom-default` | Setup is refused and the commit prints `default pre-commit ran`. | Met: both happened. |

All three invocations exited 0. The preservation evidence is which hook the subsequent commit actually ran.

The refusal in both preservation cases is generic: “Workers don't bypass git hooks (core.hooksPath).” It doesn't identify the existing hook as the reason the setup is unnecessary. The ordinary commit worked in both cases.
