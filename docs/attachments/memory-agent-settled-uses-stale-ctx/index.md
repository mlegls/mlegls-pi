# Memory hibernation across session replacement — drive

## Predicted before first use (ticket + memory README)

- **Replacement/reload after `agent_settled`:** When a supervisor becomes idle with live children and sufficient tokens, its timer waits for the provider's documented idle interval. Replacing/reloading the session before that timer fires should not throw “This extension ctx is stale after session replacement or reload” and should not compact the replacement session. An old timer is cancelled or becomes inert. The ticket's original failure followed a `turn_end` persistence error; the memory handler should not add a second, stale-context crash.
- **Normal hibernation:** With a settled, eligible supervisor left idle through the documented cache interval, one hibernation checkpoint should still run. Below threshold / without live children / on new activity, no hibernation should run; hibernation policy is unchanged.

The provided entry point is `bun test extensions/memory`; this is a local regression, not a deployment. Tests create temporary fixtures; no persona or authentication is needed. Predictions above are written before running the entry point or inspecting tests/source.

## Setup and observations


- Revision: `fe3d210` (documentation-only prediction commit on the implementer's `e6a93ff`), worktree `memory-agent-settled-uses-stale-ctx-drive`; clean before drive. `pi --version` printed `0.87.1`.
- Owned target: this checkout's committed local branch, no deployment, no reused selector. Persona/auth: not applicable. Seed/state: the handoff says the test command creates temporary fixtures. Entry point: `bun test extensions/memory` from this checkout; no dev server or browser launched.
- Executed the entry point after predictions. It finished with **15 pass, 0 fail, 122 assertions across 4 files**, in 651 ms. Its hibernation test output included `supervisor waits for cache expiry, resets on activity, and cancels on shutdown` (pass), `finds running supervise jobs with live children owned by this session` (pass), and `supervisor cache lifetimes` (pass). No output named or described session replacement/reload, old timer firing after replacement, or stale-ctx exception. The test runner did not expose individual assertions, state transitions or compaction artifacts; I did not inspect its source/tests/fixtures.
- Checked Pi's public CLI (`pi --help`) for a no-code route: it exposes `--mode rpc`, `--session`, `--extension`, and `--offline`, but no command to emit `agent_settled`, arrange live supervisor children, or advance an old hibernation timer. A live session drive would also require the supervisor state and the documented 5-minute/1-hour idle interval, not provided by the local-regression setup. I did not substitute an artificial extension or claim the tests reproduced that transition.

## Stories and expectations

1. **Old timer after session replacement/reload — unobservable.** Expected the timer not to read stale context or compact the replacement, with no added stale-context crash. The provided entry point completed cleanly, but gave no visible lifecycle-specific case or output, so neither the cancellation nor the absence of replacement compaction is demonstrated. The clean test exit is not proof of this claim.
2. **Ordinary inactivity hibernation policy — held within the regression surface.** Expected eligible supervisor hibernation at expiry and reset/cancellation with activity or shutdown. The named hibernation regression passed; its internal compaction result and thresholds are not individually visible in CLI output. This is fixture-backed, not a live provider observation.

## Frictions

- The supplied regression entry point advertises 15 passing tests but no replacement/reload scenario by name. For the ticket's central lifecycle claim, it leaves a first user unable to distinguish the repair from the old stale-context failure without reading implementation or tests.
- The public CLI can start or resume a session, but does not offer a user-facing way to deterministically emit `agent_settled` and then replace the session before a pending timer fires. Waiting in a normal Pi session is not enough without an eligible supervisor/children and controlled post-settlement replacement.

## Replayable checks for review

- **Replacement:** Using a checkout-local Pi 0.87.1 session with memory extension, prepare a supervisor with a running child and enough context to meet `memory.hibernate.minTokens`; emit `agent_settled`, replace or reload that same session before its provider cache expiry, then advance/wait past the original expiry. Observe no `This extension ctx is stale after session replacement or reload`, no hibernation compaction for the replacement session, and no write to its `memory-attempts.jsonl` with `trigger: hibernate` from that old timer. Repeat with an old callback already queued at the replacement boundary; it must be inert.
- **Ordinary idle:** With the same eligibility but no replacement, let the documented provider idle interval elapse. Observe one hibernation checkpoint (`trigger: hibernate` in the session's attempts ledger), no duplicate from the same idle period. Send activity before expiry in another session; the original deadline must not compact, and any later fold must follow a fresh idle interval. End a third session before expiry; no post-shutdown fold.
- **Negative eligibility:** With no live children or below `memory.hibernate.minTokens`, allow the full expiry interval and observe no hibernation attempt. These are policy invariants mentioned in the docs, not assertions inferred from the passing suite.

No rendered journey; visual evidence is not applicable. No external resource or service was started.

## Review — 2026-09-30

The initial repair still failed the original late-event case: after Pi's shutdown/invalidation sequence, emitting `agent_settled` on the old runner reported the exact stale-context error at `extensions/memory/index.ts:215`. The first lifecycle replay produced **3 pass, 2 fail** (replacement and reload). Cancelling an existing timer was not enough: a late event could start another one and read `ctx.cwd` immediately.

The extension now retires on `session_shutdown` and ignores subsequent settled events before touching their context. The existing timer token also makes an already-queued callback inert. Pi 0.87.1's `withSession` is an option on commands that replace sessions, not a general context accessor on `ExtensionContext`; memory initiates no replacement and needs no post-replacement continuation. New work comes from the new extension instance's fresh event context. No old work is transferred to the replacement.

### Replay and current outcomes

`extensions/memory/lifecycle.test.ts` loads memory through Pi's real extension loader and runner, including Pi's stale-context enforcement, and uses real session managers and temporary supervisor/settings files. It explicitly delivers the shutdown/invalidation lifecycle for resume and reload. The clock and model response are fixtures; compaction requests are routed through the real `session_before_compact` handler and its attempt ledger, not through a live provider or TUI.

| Claim / replay | Current outcome | Observation |
| --- | --- | --- |
| Old timer after replacement/reload | held | Resume and reload each leave no runner error, hibernation notice, compaction request or attempt-ledger entry after a late settled event, a manually invoked already-queued callback, and expiry of the old deadline. |
| Fresh replacement can hibernate | held | Its own settled event and full idle interval produce one compaction request, the `Hibernating: folding` notice, child focus `t: x`, and one ledger entry with `trigger: hibernate`. |
| Ordinary idle / activity / shutdown | held | No request before expiry; activity cancels the old deadline; a fresh full interval produces one request and hibernation ledger entry; another interval does not duplicate it; shutdown cancels a newly scheduled timer. |
| Negative eligibility | held | Below-threshold and childless supervisors produce no request, notice, error or attempt-ledger entry after the full interval. |

Both driver frictions are fixed here: named resume/reload tests expose the missing case, and the deterministic SDK replay supplies the controlled lifecycle/clock route absent from the CLI. Both expectations are now observed, not inferred from the old generic test name. No driver check was dropped. The original first-use record above is unchanged.

No external resources were started; fixtures clean up their temporary directories and restore timers/environment. This establishes the extension lifecycle contract, not live provider checkpoint quality or an end-to-end interactive workspace switch.

### Verification receipts

- Tested code revision: `d814143` (retirement guard and ledger replay). Installed repository SDK: `@earendil-works/pi-coding-agent` **0.84.4**. `ab check -- bun test extensions/memory`: **20 pass, 0 fail, 173 assertions**, five files.
- Compatibility replay against the ticket's **Pi 0.87.1** SDK: temporarily replaced only this worktree's ignored `node_modules/@earendil-works/{pi-coding-agent,pi-ai}` directories with symlinks to the installed mise CLI's corresponding packages; ran `bun test extensions/memory/lifecycle.test.ts` through `ab check`; restored both original directories with an EXIT trap. **5 pass, 0 fail, 51 assertions.** No installed global package was modified. The target SDK root was `$HOME/.local/share/mise/installs/npm-earendil-works-pi-coding-agent/latest/node_modules/@earendil-works`; verify its package version before repeating this optional compatibility check.
- `ab check -- ./node_modules/.bin/tsc --noEmit`: unchanged root diagnostics remain; no diagnostic in `extensions/memory/index.ts` or `lifecycle.test.ts`. Existing owners: [[projects/mlegls-pi/issues/root-typecheck-memory-image-fixture]], [[projects/mlegls-pi/issues/root-board-store-fixture-typecheck]], [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]]. Focused memory tests are the available workaround.
