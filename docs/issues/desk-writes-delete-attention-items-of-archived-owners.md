---
stage: "done"
assignee: "agent"
priority: 2
author: "session:01a1e11e-1e93-773b-9956-3d4ce13ef0d8"
---

# Desk writes delete unanswered attention items whose owner thread is archived

`lib/desk.ts` filters `ATTENTION.md` items through `alive` on every desk write: an item whose owner thread is archived or missing is dropped. Lines in `ROLES.md` should go that way; an attention item is a question to the maintainer that is still open whoever asked it. The `attention` skill asks the asking thread to re-file its still-needed items under a live thread before archiving, but nothing enforces it, and any later `ab desk` write from any session deletes them silently.

Observed: the 11-15 daily report (@thread:thr_nhksph4izj#msg=1009) found three unsettled items missing and restored them: publishing ncept-pi, the production Clerk switch, and reading the free-trial spec. The production Clerk switch blocks the priority-1 joined-5000 tree. `desk/` is untracked, so which write dropped them isn't recoverable; the code path is the only one that removes items without an explicit `clear`. Found by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby).

## tasks

1. Keep the existing cleanup for `ROLES.md` lines.
2. An attention item whose owner is gone is reassigned to the project's live supervisor when there is one (the pickup owner, else the thread in `ROLES.md` holding the supervisor role), keeping the original owner in its body; otherwise it stays with an `owner gone` marker until removed explicitly.
3. Done when: a desk test with an archived-owner attention item and an archived-owner role line keeps the item (reassigned or marked) and drops the role line.

## Result

done

```yaml
commit: f54ae1cb
stories:
  - story: Desk acceptance test retains archived-owner attention, recovers ownership, and removes archived-owner roles
    outcome: held
evidence:
  path: docs/attachments/desk-writes-delete-attention-items-of-archived-owners/index.md
  visual: false
  shots: []
tests:
  - lib/desk.test.ts
fixed:
  - "2977f60c: the `ab desk` usage text and the shape and supervise skills said every write cleans attention items of archived owners. They now describe the new behavior."
caveats:
  - "lib/desk.test.ts packs five scenarios into one test case. I read its assertions and they cover the ticket's cases: pickup owner, supervisor-role fallback, `owner gone` marker, `Previous owner` kept, role row dropped, repeat clean unchanged, explicit removal. The scenarios don't report separately when one fails."
  - "An `owner gone` item stays until someone removes it. It moves to the supervisor on a later desk write once one is live."
  - "A reassigned item isn't checked against items with the same title under the new owner. This is an edge case and I left it."
```

I re-ran `bun test lib/desk.test.ts` at the review head: 1 pass, 0 fail, 34 assertions. I appended a review section to the driver's packet. I filed no issues and found no tracker frictions to settle.

Evidence: [docs/attachments/desk-writes-delete-attention-items-of-archived-owners/index.md](../attachments/desk-writes-delete-attention-items-of-archived-owners/index.md)
