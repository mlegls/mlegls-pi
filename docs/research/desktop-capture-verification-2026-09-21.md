# Desktop capture verification — 2026-09-21

With deliberate user authorization, exercised the migrated runtime through exec’s public `ui` API against a non-sensitive TextEdit window. No installation, signing, permission setup, or UI mutations were performed.

## Observations

- `ui.findRoots({app: "TextEdit"})` returned one exact-paired Untitled window, `@r1`, at 601 × 491 logical points.
- `ui.observe({root: "@r1", mode: "semantic"})` returned a 49-node outline with “sample text for astra”.
- `ui.observe({root: "@r1", mode: "visual"})` returned a 50-node outline and an actual screenshot. `show` rendered it successfully, visibly matching the semantic text. Metadata reported 1202 × 982 pixels at scale factor 2.
- Capture completed without an agent-side permission error or timeout. The user confirmed that macOS displayed no consent prompt.

## Disposition

Post-migration visual capture and exec image rendering are verified on this host with its current grants. This closes the live-capture verification gap, not the OS consent boundary. Fresh-install onboarding, revoked permissions, and re-signing were not tested. Keep explicit permission setup and `--ignore-scripts` installation guidance. No code change is needed for the successful capture path.
