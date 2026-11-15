---
stage: "ticket"
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
