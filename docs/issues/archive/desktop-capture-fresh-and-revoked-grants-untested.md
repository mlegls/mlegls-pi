---
stage: done
author: session:2026-09-24T07-05-04-311Z_01a0d23b-6a37-75f1-bad0-4832beff35f3
---

Obsolete 2026-10-01: the native desktop helper behind `ab computer` was deleted in the pi 0.99 rebuild (`4b79baa`); desktop capture is cua-driver's now.

Moved from `docs/frictions.md`: "Desktop consent remains an OS boundary: actual ScreenCaptureKit capture can prompt despite positive preflight. The fork removes consent-capable routine checks and automatic onboarding; explicit setup owns permission requests. Development installs must use `--ignore-scripts` to avoid changing the native helper's signing identity. Post-migration semantic observation, visual capture, and image rendering are [verified on this host](../research/desktop-capture-verification-2026-09-21.md); fresh/revoked grants remain untested."
