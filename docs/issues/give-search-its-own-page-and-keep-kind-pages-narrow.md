---
stage: "ticket"
assignee: "session:thr_w83czkuar9"
author: "session:thr_w83czkuar9"
claimed-by: "session:thr_w83czkuar9"
---
Search becomes its own destination, and a kind's page searches only that kind. Story: [[projects/concept/stories/plan]] (the 2026-10-24 Query notes).

The all-kinds Me list (`/?text=`) already exists and searches everything; it gains a name and ways in. Kind pages already narrow their menu to what narrows the kind (`querySelectionSuggestions(snapshot, query, kind)`, merged 2026-10-24).

shape:

- sidebar: **Search** first under Me, current on Me when the Query names no listed kind. Missions and Sessions are current for any Query of their kind.
- top bar: a Search control before the account. ⌘K / Ctrl-K anywhere opens Search and focuses its field.
- kind page: the bare kind token belongs to the page. The strip hides it (generalising `COLLECTIONS` in `me-layout.tsx`), × clears back to it, a commit that drops it keeps it, and the placeholder names the kind.
- escape entry: a draft naming another listed kind, or a state only another kind has, offers one entry "Search everything for “…”" in place of a filter. Choosing it opens Search with the draft alone.
- Map and Hub bars unchanged.

decisions:

- 2026-10-24: an escape entry, not a redirect or a plain block; the page is named Search (maintainer).
- 2026-10-24: ⌘K goes to the Search page rather than an overlay palette: one bar, one result list.

holes:

- canvas review of the kind-page strip, the escape entry, the sidebar entry and the top-bar control (`docs/design/screens.md`) before landing.
