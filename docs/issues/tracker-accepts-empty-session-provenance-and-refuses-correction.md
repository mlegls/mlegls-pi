---
stage: "done"
assignee: "agent"
author: "session:01a1661a-bb76-7763-9c9f-43f21e4a4b41"
priority: 3
drive: "none"
---
While refining Concept's `check-in-drive-setup-lacks-conversation-and-retry-scenarios` on 2026-10-23, a tracker create command launched through the managed `process` tool expanded `$PI_SESSION_ID` to empty. The same variable printed `01a1661a-bb76-7763-9c9f-43f21e4a4b41` in the `bash` tool earlier in this session. The environment difference's cause is not established; this observation alone does not establish that it shares the PATH issue in [[projects/mlegls-pi/issues/managed-process-nested-shell-loses-mise-python-path]].

`issues.ts create decide-diagnosed-retry-checkpoints-under-material-centered-lessons` accepted `author: session:` and committed it (`26e20a37` in Concept). A subsequent `issues.ts fields` showed that exact empty-suffix value. Trying `issues.ts update ... --fields '{"author":"session:01a1661a-bb76-7763-9c9f-43f21e4a4b41"}'` failed with `author provenance is immutable`. The incorrect field cannot be repaired through the documented adapter. This affects real captured provenance, not just command output.

Workaround: use literal captured session IDs in managed commands, and record the correct provenance in the issue body without editing canonical tracker files directly. The Concept goal body carries that correction. No tracker implementation was changed.

The same mismatch recurred while refining Concept's [[projects/concept/issues/machine-translate-adopted-patches-into-the-learners-locale]] in @thread:thr_c4pvbhc7dn: `bash` printed `PI_SESSION_ID=01a17934-ede2-76e3-b242-96aa800e7990`, but managed process `create-translation-refinement-children` expanded it to empty for all four provisional children. `issues.ts fields` confirmed `author: session:` and the documented update again refused with `author provenance is immutable`. Since these were this refiner's own provisional children, removing them in reverse dependency order and recreating them with the literal captured ID repaired the records through the adapter. Parent, dependencies and supplied claims were preserved. This workaround is only applicable to owned provisional records; the environment cause remains unestablished.

Possible improvement, not an agreed design: reject empty identity suffixes before committing, and provide a deliberate way to correct accidental malformed provenance without weakening normal immutability. Investigate why process and bash expose different session variables before choosing an environment fix.

## shape

In [issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts): validation (the `author must be a nonempty provenance string` check, and `create`'s default from `PI_SESSION_ID`) rejects an author whose `<kind>:` prefix has an empty or whitespace-only suffix (`session:`, `user:`), so `create` fails before writing and `check`/queries report existing ones. Existing empty-suffix records in other projects are left for their owners; `check` names them. Test in `issues.test.ts`: `create` with `author: "session:"` and with `PI_SESSION_ID=""` both fail and write nothing. `drive: none`: the tests are the acceptance.

Out: a way to correct malformed provenance, and why managed processes see an empty `PI_SESSION_ID`; both are [[projects/mlegls-pi/issues/correct-malformed-author-provenance]].

decisions:
- 2026-11-02: split: rejecting the empty suffix needs no decision; a correction path does (@thread:thr_dwre28wvm6).

## Result

done

The change holds the ticket's acceptance on head `144b0788`. I repaired one defect and ran the tracker test file (30 pass).

The defect: the implementer put the empty-suffix rule in `parseFrontmatter`, which `load` runs on every file. In a scratch repo, one existing `author: session:` record made every query fail, including `check`. That would lock Concept's tracker, which holds such a record, and there is no correction path.

The rule now lives in an `emptyIdentity` helper in `issues.ts`:
- `create` refuses it, whether the author is explicit or comes from `PI_SESSION_ID`.
- `update` refuses it when setting a new author.
- `check` reports `<slug>: author session: names no identity` and exits 1.
- Other queries still load the record.

The ticket's `create` test still passes unchanged. In the scratch repo I confirmed that `check` names the bad record, `fields` still works on the good one, and `create` with `user:` or an empty `PI_SESSION_ID` fails.

I did not touch the other work merged into this branch (guard, checks, runtime, artboard, other tickets' attachments).

```yaml
commit: 144b0788 (on branch tracker-accepts-empty-session-provenance-and-refuses-correction-review-2)
stories:
  - story: create with an empty-suffix author fails and writes nothing
    outcome: held
  - story: create with empty or blank PI_SESSION_ID fails and writes nothing
    outcome: held
  - story: check names existing empty-suffix records while queries keep working
    outcome: held
evidence:
  path: docs/attachments/tracker-accepts-empty-session-provenance-and-refuses-correction/index.md
  visual: false
  shots: []
tests:
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
caveats:
  - Drive was skipped (drive: none). The ticket's issues.test.ts is the acceptance, run by the integration gate.
  - The check-names-existing-records behavior has no automated test; I verified it by hand in a scratch repo. proposed test: check reports an existing empty-suffix author while queries still load it (tracker validation, a behavior the ticket states).
  - No wall-time or cost trade-offs introduced.
```

Evidence: [docs/attachments/tracker-accepts-empty-session-provenance-and-refuses-correction/index.md](../attachments/tracker-accepts-empty-session-provenance-and-refuses-correction/index.md)
