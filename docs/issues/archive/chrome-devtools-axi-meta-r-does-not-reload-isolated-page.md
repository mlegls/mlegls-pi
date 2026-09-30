---
stage: done
assignee: agent
author: session:01a0edc9-1bff-7022-b9c1-205dc61d1bea
---

Tool owner: `chrome-devtools-axi` (its repository has no accessible vault tracker here). During independent first use of [[projects/concept/issues/warm-only-the-next-editions-needed-assets]], in named isolated Chrome session `warm-only-the-next-editions-needed-assets-drive`, `chrome-devtools-axi press 'Meta+R'` returned a normal page snapshot, but the document did not reload: the `concept-visit` cookie was absent after deletion on `Path=/ncept` and the retained `concept-edition` still held the old visit/current on the next eval. A second `Meta+R` also left the page's performance resource list and cookie unchanged. Workaround: `chrome-devtools-axi eval '() => { location.reload(); return "reloading" }'` followed by a fresh snapshot; this issued a navigation and promoted the retained ready candidate on the new visit.

Check whether `press` promises browser-level reload shortcuts in isolated macOS Chrome and whether it should report an undelivered key chord. The observed failure does not establish a general inability to press keys or navigate. Evidence: [[projects/concept/attachments/warm-only-the-next-editions-needed-assets/drive|drive log]].

disposition, 2026-09-30: reproduced on a minimal page (a `window` marker survives `press Meta+R`) and filed upstream as https://github.com/kunchenguid/chrome-devtools-axi/issues/159.
