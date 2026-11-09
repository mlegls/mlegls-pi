# Independent first-use drive

## Predictions recorded before use

- Headless missing model: invoking the prepared library entry should print a warning to stderr naming `fixture-om-missing/no-such-model` and `fixture-session/foreground`, and report the latter as selected.
- UI missing model: the prepared notification adapter should receive a warning naming both models. This is a library interaction, not a rendered UI journey.
- Configured model present: the selected identity should be the configured model, without a fallback warning.
- Worker replay and condenser replay: the real CLIs should exit nonzero for an absent selected model before making requests; the error should name that model.
- Headless regression test: review owns inspection/execution of the ticket-authorized test; this driver will not inspect tests.

## Starting state

Revision `ff1502bf135f53580bfdc4df94237ef3406a076c`, clean driver checkout `/home/mlegls/dev/mlegls-pi__worktrees/om-model-fallback-is-silent-without-a-ui-drive-2`. The implementer handoff named its own checkout; the committed launcher is present here, so all commands will run against this driver's checkout. Offline library fixture plus real replay CLIs; synthetic registry/auth and frozen snapshot; no credentials or requests. No inherited deployment selectors, server or port is needed. Entry: `bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts headless`. Readiness was established by successfully loading that entry locally.

## Observations and outcomes

All five modes ran from the driver checkout using Bun 1.4.4. Reproduce each with `bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts <mode>`.

| Story / mode | Observation | Outcome / prediction |
| --- | --- | --- |
| Headless missing model / `headless` | Exit 0; stdout selected `fixture-session/foreground`; stderr printed `Observational memory: configured model fixture-om-missing/no-such-model not found, using session model fixture-session/foreground`. | held / met |
| UI warning / `ui` | Exit 0; adapter printed one notification with the same complete warning and `level: warning`, then selected session model. | held / met |
| Available model / `configured` | Exit 0; stdout selected `fixture-om-missing/no-such-model`; no extra fallback warning appeared. | held / met |
| Exact worker replay / `replay` | Setup named the requested missing model; exit 1 with `Required exact replay model is not in Pi's catalog: fixture-om-missing/no-such-model`. | held / met |
| Exact condenser replay / `condenser` | Setup additionally named `mode: condenser`; exit 1 with the same exact-model error. | held / met |
| Headless regression test exists | Not inspected or run: driver assignment excludes tests. Reviewer must establish this acceptance criterion. | unobservable in this drive |

The replay processes reached the prepared CLI surface, rather than failing during launcher setup. Both emitted an error stack after the named-model rejection. The UI case is an offline notification-adapter observation, not a rendered terminal interaction; no screenshot claim is made.

## Replayable checks

1. Run `headless`; accept only exit 0, the session identity on stdout and both configured and used identities in stderr. A fallback identity alone would fail the warning story.
2. Run `ui`; accept one warning-level notification naming both identities and the selected session identity. Run `configured`; accept the configured identity without a fallback warning.
3. Run `replay` and `condenser` separately; accept exit 1 and an exact-model catalog error naming the requested identity, rather than a substituted model result.

## Frictions, limits and cleanup

No unresolved user friction encountered in these bounded offline journeys. All behavioral predictions were met. Test coverage remains a reviewer-owned check, rather than a claim derived from a fixture's success. No source, diffs, tests or fixture implementation were read. No credentials were used, browser opened or servers started. The managed CLI process finished; no owned process remains running. The entry point documents automatic scratch cleanup for replay modes.

