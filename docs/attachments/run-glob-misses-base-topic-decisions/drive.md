# Independent CLI drive

## Before first product use

Tested revision: `8b8438b77806884abc24b070845cf88cb7bb1783`.

Predictions recorded before opening the instruction surfaces or running the CLI. The supplied replay and its implementation observations were read to establish setup, so these are ticket-derived expectations, not blind guesses about an unknown feature.

1. **Instructions agree:** as a worker reading the preamble, dispatch docs and multi-agent skill, I expect each run-wide coordination read to include the bare run topic and child topics. I expect a warning that nested run topics are also included, and report-tag filtering not to be presented as a way to receive decisions.
2. **Decisions are reachable:** after creating the supplied synthetic board, I expect the taught read to return the base decision, peer decision and nested decision, plus the worker report, but not the outside-run decision. The old `trial/*` should miss the base and nested decisions. Report filtering should return only the report.
3. **Subscription follows the same pattern:** when the docs teach subscriptions too, I expect a fresh bare-topic decision posted after subscribing to the taught run-wide pattern to wake that subscription. A sibling run's decision should not wake it.

Setup checked: local Bun CLI, this committed worker checkout, no authentication, exclusively owned temporary board seeded with synthetic messages. Entry point is the replay block in `index.md`. Dependencies are present (`node_modules`); setup will be complete only after the commands run successfully. Every product invocation will explicitly select a new temporary `PI_BOARD_DIR` and `PI_BOARD_NAME`, never an inherited shared board. No services or browser will be started.

## Session log

2026-09-30, local Bun 1.4.2, no authentication:

1. Read only the delivered instruction surfaces (not implementation, diffs or tests). `agents/_common.md` teaches `{{run}}/**` for both the host read and Bash adapter. `docs/dispatch.md` teaches `<run>/**` for report subscriptions and a separate unfiltered peer read. The multi-agent skill does likewise. All three explicitly mention base-topic decisions, descendants/nested runs, and why `*` misses the base. **Instruction story held.**
2. Ran the supplied replay from this checkout against owned temporary board `tmp.QAZjtCHxDt`, with explicit `PI_BOARD_DIR`/`PI_BOARD_NAME`. Seeding returned five messages successfully: readiness established. Old `trial/*` returned peer decision and report (2/0 total/omitted); new `trial/**` returned base, peer, nested decisions and report (4/0); report-filtered globstar returned only the report (1/0). Reading full content confirmed the actual decision bodies. **Decision-read story held.** [Selected CLI output](drive-cli.txt).
3. Wanted to explore waking on a new decision. Top-level help exposed `wait`; subcommand help threw an argument-validation stack trace instead of usage. Filed [board CLI help friction](../../issues/board-cli-help-runs-required-argument-validation.md); used top-level usage plus `cursor` instead. [Discovery output](drive-wait-setup.txt).
4. The first sibling-only wait returned exit 1, which stopped the `set -e` script before its output was captured. Repeated with the exit handled explicitly, on a fresh board `tmp.1WRqjrA7dp`. From offset 0, posted `trial-other/peer`; `wait --topic 'trial/**' --timeout 400` returned no message, exit 1. Then captured cursor 258, started `wait --topic 'trial/**' --from-offset 258 --timeout 2000`, and posted `trial` tagged `decision`. Wait returned the fresh base decision, exit 0. The exact Bash adapter taught in the preamble, `ab lib board read '{"topic":"trial/**"}'`, returned that same decision and excluded the sibling. [Waiting and adapter output](drive-wait.txt).
5. Every temporary board was removed by its exit trap, including the interrupted first wait attempt. All wait processes finished. No dev servers, browser pages, external deployments or shared data were started/changed.

## Expectations and frictions

| Prediction | Result | What happened |
| --- | --- | --- |
| All three instructions agree, disclose nested reads and separate report filters | met | Consistent globstar coordination examples and explicit warnings. |
| New read reaches base/peer/nested decisions; old pattern misses base/nested; report filter excludes decisions | met | Exact expected bodies and totals; no outside-run message. |
| Host subscription wakes on a fresh base decision, not a sibling | not met: unobservable host surface | CLI wait behaved that way, but this Bash-only drive cannot exercise host `board.subscribe` delivery/ack. No host-subscription claim is made. |
| Formed during use: `wait --help` should explain waiting | not met | Required-argument stack trace; workaround and issue linked above. |
| Formed during use: timeout can be handled as an ordinary empty wait | met after retry | Empty stdout and exit 1; a naïve `set -e` replay stops. |

Other friction: globstar deliberately includes nested-run decisions, adding scope/noise; the instructions disclose this. No confusion or slowness in the actual reads.

## Replayable checks for review

- **Instruction consistency:** open the three named surfaces as a worker; accept run-wide coordination examples only if the taught pattern includes the bare topic and children. Confirm the nested-run warning and an unfiltered decision-read example, distinct from report filtering.
- **Reachability and boundaries:** run the `index.md` replay in a fresh temporary board; accept exactly base/peer/nested/report for `trial/**`, peer/report for `trial/*`, report alone for report-filtered globstar, all with omitted 0. Neither `other/peer` nor `trial-other/peer` should appear in a run-wide read.
- **Actual worker Bash surface:** with explicit temporary selectors, send a `trial` decision and `trial-other/peer` decision. Run `ab lib board read '{"topic":"trial/**"}'`; accept only the base decision, including its body and `decision` tag.
- **Fresh waiting:** capture a cursor, start the CLI wait from that cursor with topic `trial/**`, post a `trial` decision, and accept exit 0 with that message. Repeat from a fresh cursor with only `trial-other/peer`, timeout 400 ms; accept no message (observed exit 1). Use a generous timeout for the positive case.
- **Host subscription follow-up:** in a host exposing board subscriptions, subscribe to `trial/**` unfiltered before posting a bare `trial` decision; accept a wake carrying that decision. A sibling run should not wake it. This was not driven here; CLI waiting is not proof of the host notification lifecycle.

No tests were written or read; no product repairs. This is a nonvisual CLI/instruction journey (`visual: false`, `shots: []`).
