---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a1cdb0-4d22-72bc-8778-94e6b358a046"
---
When a reviewer repairs a foreign checkout, its handoff can name the foreign commit bare (`commit: [3aeaaff5, 602606f]`) instead of as `{checkout, commits}`. The foreign-commit check then reports "has no verifiable loaded checkout" every tick, and no resolve action can supply the missing checkout: `retry` re-reads the same handoff. On attention-inbox-in-the-bb-tracker the supervisor merged the bb-plugins branch, still could not get past the hold, and closed the issue by hand after `reconcile_stop`.

Either the review prompt should require `{checkout, commits}` for any commit outside the target repository, or the check should find a bare foreign commit in the repositories the run's constraints and child handoffs already name (here, /home/mlegls/dev/bb-plugins appeared in the child's handoff).

Promoted to a ticket by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby): both auditors cite @thread:thr_dfgkcug6jp#msg=2072 (reconcile_stop and a hand close on attention-inbox-in-the-bb-tracker) and the two delayed identical holds after it (#msg=2076). The check itself ([[projects/mlegls-pi/issues/verify-foreign-repository-commits-are-installed-before-closing]]) stays as it is.

## tasks

1. Review and implement handoff guidance (`agents/_common.md` or the review prompt): "For commits outside this repository, report `commit: { checkout: /absolute/loaded/checkout, commits: […] }`." The handoff parser refuses a bare foreign SHA at report time, so the worker fixes it in the same turn.
2. For a hold already raised on a bare SHA, the check also searches the repositories the run's constraints and child handoffs name; a resolve action can supply the checkout, after which the ancestry check reruns.
3. Done when: replaying the attention-inbox handoff (`commit: [3aeaaff5, 602606f]`, bb-plugins merged) completes without `reconcile_stop`, and a foreign commit absent from the loaded checkout still holds.

## Result

done

All four stories hold at head `76f64087`, including the explicit retry recovery the driver couldn't observe. I found no defects in the change and made no code repairs.

I drove the retry in a scratch test (deleted afterwards) on an in-process reconciler with a disposable repository. It had a landed root, a bare foreign commit on a side branch, and a "foreign implementation not installed" exception.
- **Relative checkout:** `retry` with a relative checkout was refused and the exception stayed pending.
- **Absolute checkout, commit not installed:** `retry` with an absolute checkout was saved and the ancestry check reran. The hold stayed, with "not installed in loaded checkout".
- **After installing the commit:** I fast-forwarded the repository's HEAD to the commit. The next pass closed the issue and cleared the exception.
- **No worker, no stop:** the worker counter stayed 0 and there was no `reconcile_stop`.

I ran `bun test lib/report.test.ts lib/reconcile/{completion,exceptions,constraints,retry,resume}.test.ts extensions`, and it passes. One earlier run failed `constraints.test.ts` ("a mid-implement constraint reaches drive and review first prompts"). It passed alone and on rerun, so I treated it as a load flake.

I closed the driver's friction issue `foreign-hold-drive-runtime-lacks-checkout-resolution-argument` as a reload boundary. The inherited session runtime predated the change, and `extensions/supervision/index.ts` declares `checkout` at this head. I appended a Review section to the driver's packet and committed it.

```yaml
commit: 76f64087
stories:
  - story: Bare foreign commit handoff is rejected with actionable checkout guidance; qualified handoff is accepted.
    outcome: held
  - story: Historical attention-inbox handoff completes after child handoff identifies loaded bb-plugins, without reconcile_stop.
    outcome: held
  - story: Foreign commit absent from loaded HEAD holds until installed.
    outcome: held
  - story: Explicit retry resolution supplies checkout and reruns ancestry verification.
    outcome: held
evidence:
  path: docs/attachments/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - No tests were added; the retry drive was a scratch test, now deleted. Same-turn guard correction was exercised only through a fake ExtensionAPI, not a live provider turn.
  - "Fallback discovery takes any absolute path in constraints and handoffs as a candidate repository. A linked worktree of a foreign repo whose branch HEAD contains the commit would pass ancestry even though that repo's main HEAD lacks it. The ticket asks for this widening; I left it unchanged. Constraint-only discovery was not driven; the historical replay found its checkout through a child handoff."
  - The report-time check treats any 7+ character hex-looking token in `commit`, `commits`, `fixed` or `commit:` lines as a commit. A 7+ digit number or a word like "defaced" in `fixed` would be refused as a foreign commit. This regex was already used at close time, and the refusal now comes a turn earlier.
  - "Cost: the foreign-commit check adds one `git rev-parse` per candidate checkout per tick on held results. I did not measure it."
```

Evidence: [docs/attachments/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout/index.md](../attachments/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout/index.md)
