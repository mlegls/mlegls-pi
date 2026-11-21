---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
part-of: "[[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]]"
---
Worker rules hold whatever the provider, because integration checks the branch instead of the worker's tool calls. Shape: [[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]].

Integration ([dispatch.ts](../../lib/dispatch.ts) `integrate`, the reconciler's landing in [landing.ts](../../lib/reconcile/landing.ts)) runs the repository's commit hooks over the worker's commits since its base before merging, and refuses with the failing hook's output, returned to the worker as a follow-up the way the reconciler's repairs are. A commit made with `--no-verify` or a `core.hooksPath` override then fails the same as one made without the bypass. [guard](../../extensions/guard/index.ts)'s `hookBypass` refusal stays for pi workers, since it saves a round trip. Check the tracker is absent from every worker worktree (`excludeTracker` in [runtime.ts](../../lib/thread/runtime.ts)) so the `docs/issues/` read block isn't needed for other providers; if a provider can still read it, say so in the result.

Done when: a worker branch with a commit that fails a pre-commit hook, made with `--no-verify`, is refused at `integrate` and lands after the worker fixes it; a clean branch integrates as before.

## Result

done — Direct integration and reconciler landing both refused the bypassed commit, left the parent unchanged, and landed the rewritten history. All 21 affected tests passed; typechecking passed.

```yaml
commit: 55bdebe2
stories:
  - story: Reject --no-verify and worker-local core.hooksPath bypasses and return the hook output
    outcome: held
  - story: Land after the worker rewrites the offending commit
    outcome: held
  - story: Land a clean branch on the first attempt
    outcome: held
  - story: Exclude the tracker from the sparse worker filesystem
    outcome: held
  - story: Enforce hooks through the reconciler's landing path
    outcome: held
evidence:
  path: docs/attachments/check-worker-rules-at-integration/index.md
  visual: false
  shots: []
fixed:
  - Removed the duplicate hook exit status from the reconciler's repair diagnostic.
tests: []
filed: []
caveats:
  - Tracker files are absent from worker checkouts; providers with Git object access can still read them.
  - Reconciler landing was driven directly. The live provider and outer repair-message loop were not exercised.
  - Each incoming commit pays for its hooks again. The three-attempt fixture replay took about one second with a one-file shell hook.
  - Replay uses detached HEAD and prepared dependencies; branch-sensitive hooks and non-idempotent message rewrites can differ from the original commit.
```

Evidence: [docs/attachments/check-worker-rules-at-integration/index.md](../attachments/check-worker-rules-at-integration/index.md)
