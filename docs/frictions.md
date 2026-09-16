# Frictions

- Desktop consent remains an OS boundary: actual ScreenCaptureKit capture can prompt despite positive preflight. The fork removes consent-capable routine checks and automatic onboarding; explicit setup owns permission requests. Development installs must use `--ignore-scripts` to avoid changing the native helper's signing identity. Full visual capture after the runtime migration remains unverified; resume only with deliberate user coordination.
- Exec’s explicit skill-ownership marker requires the pinned `mlegls/pi-better-skills` fork at `a87cfcc`; stock 1.3.2 heuristically reinterprets exec output. The fork preserves the ownership guard and raw-read guidance across package updates. Upstream proposal: https://github.com/edxeth/pi-better-skills/pull/4. Next: switch back once upstream supports the contract.

