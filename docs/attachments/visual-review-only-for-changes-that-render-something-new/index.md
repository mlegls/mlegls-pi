# First use: review routing

Tested `db43a2242570aa86700668ee3d7c2c9b49b13f72` through the local replay CLI. The handoff uses a disposable Git repository and fake BB, seeds a ticket and visual evidence with Concept path settings, waits for the workers, and prints the launch recorded by the reconciler. No auth or shared deployment.

## Predictions before replay

- `recordings`: with visual evidence and only recordings and docs changed, expect a `reviewer` launch.
- `css`: with visual evidence and a CSS change, expect a `visual-reviewer` launch.
- Expect the join to include a visual reviewer only for the CSS case. A launch line alone won't establish which roles the join waited for.

## Results and replay checks

From the repository root:

```sh
bun docs/attachments/visual-review-only-for-changes-that-render-something-new/replay.ts recordings
bun docs/attachments/visual-review-only-for-changes-that-render-something-new/replay.ts css
```

| Case | Observable result | Prediction |
| --- | --- | --- |
| `recordings` | Exit 0; `launched solo-review-3 (review, reviewer)` after 28s | Met |
| `css` | Exit 0; `launched solo-review-3 (review, visual-reviewer)` after 29s | Met |

The join's role filter was unobservable: the CLI reports launches, not the join's required roles. To check that separately, observe the join's effective role selection for the same two inputs; accept `tidy` alone for recordings and `tidy` plus `visual-reviewer` for CSS. The replay also doesn't show what the ordinary reviewer opens.

The CLI entry points worked without extra setup. This was a routing check, with no rendered UI journey or screenshots.
