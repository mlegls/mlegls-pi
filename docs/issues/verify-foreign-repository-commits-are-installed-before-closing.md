---
stage: "done"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
The [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]] ticket closed as done while its implementation (`876e860`, `04a1ca0`) sat only on a `~/dev/pi-processes` branch; pi loads that checkout's `local-integration`, so the fix never ran until the efficiency audit of 2026-11-12 (@thread:thr_879y94y97m) merged it (`ad8a5e3`). The reviewer had warned that landing the mlegls-pi branch wouldn't land it (@thread:thr_dfgkcug6jp#msg=394).

decisions:
- 2026-11-12: before closing a ticket whose implementation lives in another repository, verify the configured checkout contains its reviewed implementation commit (maintainer, approving the audit's proposal).

## tasks
1. In reconcile's completion step ([lib/reconcile/completion.ts](../../lib/reconcile/completion.ts)), when a handoff names commits in another repository, check they are ancestors of the checkout pi or the project actually loads (for pi packages, the `source` in `~/.pi/agent/settings.json`); otherwise raise an exception instead of closing.
2. A test beside [lib/reconcile/completion.test.ts](../../lib/reconcile/completion.test.ts).

Done when: a handoff whose foreign commits aren't in the loaded checkout raises an exception, and one whose commits are closes as before.

## Result

done — no repairs needed.

I read the diff against the ticket and checked the loaded-checkout lookup against the real `~/.pi/agent/settings.json`. `../../dev/pi-processes` there resolves to `~/dev/pi-processes`, so the 2026-11-12 case would have been held.

`bun test lib/reconcile` passes: 49 tests across 21 files, 0 failures. That includes the new foreign-commit case in `lib/reconcile/completion.test.ts`, which starts from a worker branch that has the commit while the configured source's HEAD doesn't. It checks that:
- closing throws and the ticket stays at `ticket`;
- with `holdForeignCommit` set (the reconciler wires it to raise an exception), the hold repeats on later passes and survives a restore from saved state;
- after a fast-forward into the loaded checkout, the ticket closes.

The diff also touches `docs/issues/a-name-is-an-agent-with-its-soul-skills-and-life.md`, which comes in through two tracker-sync commits and isn't part of this change.

```yaml
stories:
  - story: Foreign commits absent from the configured loaded checkout hold completion
    outcome: held
  - story: Foreign commits present in the configured loaded checkout permit completion
    outcome: held
evidence:
  path: docs/attachments/verify-foreign-repository-commits-are-installed-before-closing/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/completion.test.ts
caveats:
  - "Commit ids are found by scanning the handoff's commit declarations, `fixed` and `commit:` report lines for `\\b[0-9a-f]{7,40}\\b`. A 7+ character all-hex word (e.g. \"defaced\") or a 7+ digit number in `fixed` is read as a foreign commit and raises a spurious hold. I left it because it holds rather than closing wrongly."
  - "Verification is fixture-backed. No live reconciler closure was run."
```

Evidence: [docs/attachments/verify-foreign-repository-commits-are-installed-before-closing/index.md](../attachments/verify-foreign-repository-commits-are-installed-before-closing/index.md)
