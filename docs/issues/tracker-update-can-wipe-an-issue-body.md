---
stage: "done"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
---
On 2026-11-17, commits `0d59e4690` and `a2ae20e40` in concept, both titled "tracker: update …", deleted the whole body of `verify-full-5000-card-profile-opening` and `joined-5000-profile-practice-and-map-stay-loading`. Only the front matter survived. They came 7 seconds apart while the verify-full worker was "updating both issues without closing them", so an update given an empty or missing body most likely wrote it verbatim. The supervisor restored the bodies from the parent commits (`46467165b`). An update should refuse to replace a non-empty body with an empty one unless asked to explicitly.

The same window (2026-11-16 16:06Z–16:31Z) also emptied mlegls-pi's [[reconciler-refinement-base-omits-retained-partial-implementation]] in `8ac9dcf6`, unnoticed until the 2026-11-19 efficiency audit (@thread:thr_ivvhpy2bsb) restored it from `647161aa`. The empty concept bodies left a handler unable to resolve the 5,000-card blocker (@thread:thr_pgvpie4f2v).

## tasks

1. `issues.ts update` (`skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`): refuse a `--body-file` that is empty or whitespace-only when the issue's current body is non-empty, with an error naming the slug; an explicit `--allow-empty-body` permits it.
2. Done when: tests show an empty and a whitespace-only body file refused over a non-empty body, the flag allowing it, and a non-empty replacement still written.

## Result

done. All four stories held. The vault checks the current body under its write lock, before writing either fields or body. All 32 tests in `issues.test.ts` passed; no repairs were needed.

```yaml
commit: 7cb6953a
stories:
  - {story: "Zero-byte file is refused and the original body survives", outcome: held}
  - {story: "Whitespace-only file is refused and the original body survives", outcome: held}
  - {story: "Non-empty replacement is written", outcome: held}
  - {story: "--allow-empty-body clears the body and preserves front matter", outcome: held}
evidence:
  path: docs/attachments/tracker-update-can-wipe-an-issue-body/index.md
  visual: false
  shots: []
tests:
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
filed: []
caveats:
  - "The driver exercised the local vault. On GitHub, an unforced blank update reads one tracker snapshot to check the body; that read and the subsequent update are separate operations."
```

Evidence: [docs/attachments/tracker-update-can-wipe-an-issue-body/index.md](../attachments/tracker-update-can-wipe-an-issue-body/index.md)
