# Frictions

- Desktop consent remains an OS boundary: actual ScreenCaptureKit capture can prompt despite positive preflight. The fork removes consent-capable routine checks and automatic onboarding; explicit setup owns permission requests. Development installs must use `--ignore-scripts` to avoid changing the native helper's signing identity. Full visual capture after the runtime migration remains unverified; resume only with deliberate user coordination.
- Exec’s explicit skill-ownership marker requires the local pi-better-skills dependency commits `f87a642` and `a87cfcc`; stock 1.3.2 heuristically reinterprets exec output. The local patch skips inference/expansion for marked results and corrects raw-read guidance, but must be retained when updating until upstream supports the contract. Next: upstream the boundary.

