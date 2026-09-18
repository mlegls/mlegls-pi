---
next: prototype
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
blocked-by: ["[[projects/mlegls-pi/issues/decide-primitive]]"]
---

everything that enters context from outside — fs, shell output, web, board — is chunked by kind, each chunk jev-scored against the conversation tail ("does the session need this to proceed"), kept chunks rendered, dropped chunks listed as a one-line index with anchor and p. `show.raw` overrides; `pull(anchor)` pages a dropped chunk in. demand paging with a visible page table.

`show()` is the chokepoint for exec values; the board's followUp injection is the other. the filter is middleware on both. chunkers are the plugin surface: files → symbols/sections (outline-read already has these and anchors), diffs → hunks, test/build output → failure blocks, logs → error clusters, board messages → paragraphs and `data` fields, web → sections, shell → blocks.

on the push side the useful operation is classification, not filtering: incoming worker reports tagged {clean, needs-merge, needs-decision, respawn}; only needs-decision wakes the coordinator. that classifier belongs to "[[projects/mlegls-pi/issues/supervision-join-script]]".

done: parent reads go through the filter by default, every dropped chunk is logged with whether it was later pulled, and "[[projects/mlegls-pi/issues/reranker-eval]]" says the threshold's expected miss rate.

holes:
- the query. conversation tail as-is (last user message, ticket, assistant's last text) or a maintained task statement; try as-is first.
- diffs are not filter-shaped; every hunk is relevant. see "[[projects/mlegls-pi/issues/skim-and-triage]]".
