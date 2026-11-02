# Independent CLI drive

## Predictions recorded before product use

- Explicit ARTBOARD_CONCURRENCY=3 will successfully capture eight delayed panels, in roughly three batches; unset configuration will use six, roughly two batches.
- A story selector appearing after 2200ms will be captured with wait:0 rather than failing before its appearance.
- Missing story and file selectors will fail with frame name, story/file identifier and underlying error.
- Zero concurrency will be rejected clearly.

Setup: checkout-owned committed mocked Storybook-shaped HTTP fixture, no auth or seed. CLI is the user surface; no rendered UI journey is required to observe scheduling and diagnostics. Dependency path is module resolution only, not a reused service. Historical host overload is not recreated.

## Observations (2026-11-02)

Tested revision: `af8ccdb0151f4cb0c13248fc1ee128ae6c346535`.

Started the documented Bun HTTP fixture from this checkout; it allocated port 46061. `curl --fail` returned HTTP success before capture. No inherited service was used. Used the documented ARTBOARD_PLAYWRIGHT dependency path. Stopped the fixture after all five CLI encounters.

Reproduction: follow index.md setup with the allocated port. Run the documented canvas.ts command with ARTBOARD_CONCURRENCY=3 and layout.json, then unset concurrency and repeat to a different output directory. Run missing-story.json, missing-file.json and layout.json with concurrency 0 separately, expecting failures.

| Claim / prediction | Action and observation | Outcome |
| --- | --- | --- |
| Configurable pool and default | Eight captures with concurrency 3 exited 0 in 7.728s; unset exited 0 in 5.371s. Both generated canvas.html files contained eight occurrences of `Panel ready after 2200ms`. Relative timing is consistent with three versus two batches; exact simultaneous browser-page counts were not instrumented. | met |
| Delayed selector readiness | The documented wait:0 delayed-panel layout succeeded in both runs, preserving all eight panel contents. | met |
| Named story failure | missing-story.json exited 1 after 30.924s: `Missing story panel (missing-panel): waitForSelector: Timeout 30000ms exceeded.` Locator `.absent` was identified. | met |
| Named file failure | missing-file.json exited 1 after 0.649s: `Missing file panel (iframe.html): evaluate: Error: No element matches .absent`. | met |
| Invalid configuration | concurrency 0 exited 1 in 0.024s: `ARTBOARD_CONCURRENCY must be a positive integer`. | met |

## Frictions and checks

No unresolved usability friction encountered. Bun prints source excerpts and nested causes below the useful named errors; the first diagnostic still gives the needed frame identity. This was runner output, not an implementation inspection.

Replayable checks:
- Repeat both successful commands: accept only exit 0, eight reported captures, and eight ready-panel content occurrences in each generated canvas. Timing should reflect bounded batches rather than treating absolute milliseconds as a contract.
- Repeat missing-story and missing-file commands: accept only exit 1 with both the friendly frame name and source identifier alongside the actual selector error.
- Repeat concurrency 0: accept only a nonzero exit and the positive-integer diagnostic.

This is a CLI/serialized-output encounter, not a rendered UI review (`visual: false`, no shots). No tests, source, diffs or fixture contents were inspected. The historical 22/80-frame real Storybook shared-host-load incident is not recreated; these claims were exercised against the explicitly prepared mocked fixture only. No services remain running.
