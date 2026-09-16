# Frictions

Resolved reports and reproduction evidence: [2026-09-16 verification](research/exec-friction-verification-2026-09-16.md).

- Desktop consent remains an OS boundary: actual ScreenCaptureKit capture can prompt despite positive preflight. The fork removes consent-capable routine checks and automatic onboarding; explicit setup owns permission requests. Development installs must use `--ignore-scripts` to avoid changing the native helper's signing identity. Full visual capture after the runtime migration remains unverified; resume only with deliberate user coordination.
- Exec’s explicit skill-ownership marker requires the pinned `mlegls/pi-better-skills` fork at `a87cfcc`; stock 1.3.2 heuristically reinterprets exec output. The fork preserves the ownership guard and raw-read guidance across package updates. Upstream proposal: https://github.com/edxeth/pi-better-skills/pull/4. Next: switch back once upstream supports the contract.


- Anchor reconciliation uses line-diff identity: after an external change among identical repeated rows, an old anchor can follow a different text-identical row. The capacity fix preserves this existing behavior. A whole-file stale fence would avoid ambiguity but reject unrelated edits too; deferred pending a narrower identity contract.
- chrome-devtools-axi requires the pinned `mlegls/chrome-devtools-axi` build `2386fcf` (`0.1.34-mlegls.1`) for callable scroll/wait/selector scripts. Installed globally through mise; source patch remains in `patches/chrome-devtools-axi-scroll.patch`. Next: return to upstream after a release includes https://github.com/kunchenguid/chrome-devtools-axi/pull/142.
- Repository-wide `tsc --noEmit` reports five errors in untouched Exa test, session subprocess, and system-prompt test code; runtime suites pass. Next: repair the fetch mock typing, nullable child streams, and optional callable assertion separately.
