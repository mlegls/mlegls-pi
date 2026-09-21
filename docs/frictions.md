# Frictions

TypeScript errors resolved and upstream comments followed up: [2026-09-21 follow-up](research/friction-followup-2026-09-21.md).

Resolved reports and reproduction evidence: [2026-09-16 verification](research/exec-friction-verification-2026-09-16.md). Unverified reports from a day of multi-agent dispatch, by frequency: [2026-09-16 reports](research/exec-friction-reports-2026-09-16.md). Edit reports are now dispositioned in [edit verification](research/edit-dsl-verification-2026-09-16.md); the original lost claim and bare-deletion failure remain unreproduced.

- Desktop consent remains an OS boundary: actual ScreenCaptureKit capture can prompt despite positive preflight. The fork removes consent-capable routine checks and automatic onboarding; explicit setup owns permission requests. Development installs must use `--ignore-scripts` to avoid changing the native helper's signing identity. Full visual capture after the runtime migration remains unverified; resume only with deliberate user coordination.
- Exec’s explicit skill-ownership marker requires the pinned `mlegls/pi-better-skills` fork at `a87cfcc`; stock 1.3.2 heuristically reinterprets exec output. The fork preserves the ownership guard and raw-read guidance across package updates. Upstream proposal: https://github.com/edxeth/pi-better-skills/pull/4. Maintainer requested reproduction; a verified raw-read activation probe and clarification were posted on 2026-09-21. Next: follow up on the ownership contract, then switch back once supported.


- Anchor reconciliation uses line-diff identity: after an external change among identical repeated rows, an old anchor can follow a different text-identical row. The capacity fix preserves this existing behavior. A whole-file stale fence would avoid ambiguity but reject unrelated edits too; deferred pending a narrower identity contract.
- chrome-devtools-axi requires the pinned `mlegls/chrome-devtools-axi` build `2386fcf` (`0.1.34-mlegls.1`) for callable scroll/wait/selector scripts. Installed globally through mise; source patch remains in `patches/chrome-devtools-axi-scroll.patch`. PR https://github.com/kunchenguid/chrome-devtools-axi/pull/142 is approved but blocked on the required `no-mistakes` pipeline attestation; the CLI is not installed here. Next: run the actual submission gate, then return to upstream after a release includes the fix.
- Board-dependent tests inherit `BB_THREAD_ID` and fail under BB because its board host is intentionally disabled. `env -u BB_THREAD_ID bun test` passes (196 pass, 2 skip); next: make test host mode explicit rather than inheriting the invoking agent’s environment.

Host installation failure isolation resolved through independent Pi extension entrypoints: [2026-09-21 verification](research/host-failure-isolation-2026-09-21.md). Startup-only installation and `/reload` recovery remain intentional.
