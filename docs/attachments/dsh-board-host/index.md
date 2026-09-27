# dsh-board-host first-use verification

Revision: `b70ab5d`. Task-required environment: anonymous-local DSH Web, workspace rooted at this checkout, Hashline preset, isolated `dsh/.local/board-host-verify`, shared default board store (`~/.local/share/pi-board`), DeepSeek provider key from environment. Pi identity selectors were explicitly unset. Entry point: documented `dsh web` launch on loopback port 61503 (first run); setup `bun run --cwd dsh setup` completed successfully.

## Encounter

The server became ready and rendered DeepSeek Harness. I dismissed its internal-testing notice and reached the new-session surface; it showed the Hashline preset and Add workspace. Clicking Add workspace opened the native directory chooser even though the verifier patch was intended to replace that chooser with the browser picker. The chooser was rooted at the user's home, and I did not select a directory because it would cross the authorized checkout boundary. The isolated `ab computer --url` driver could not start: it resolves Playwright only from the current package and neither the root nor `dsh/` declares Playwright. I used the named `chrome-devtools-axi` session to observe the rendered UI instead, then stopped the browser bridge and Web process.

## Claims

- Pi/DSH exchange on a shared topic: **unobservable**; no DSH workspace/session created.
- Subscribed idle DSH wake on post: **unobservable**; no session available.
- Killing a subscribed child produces lifecycle event on its topic: **unobservable**; no session available.

No repair was made. The ticket's implementer report is prior evidence, not this fresh encounter. Setup was ready at `http://127.0.0.1:61503/` on this checkout; persona was anonymous local, not Cloud. No seed/session state existed in this worktree; provider key was supplied only by environment. The deployment was stopped after the encounter.

Rendered UI was seen, but no screenshot was captured, so this packet is incomplete for visual review. The required behavioral stories remain unobserved and this verification is blocked.
