---
stage: idea
author: "session:01a0ead1-2def-7706-8306-bd2656bf63f2"
---

While driving Common Concept's 2026-09-28 Hub documents design review (a Lavish artifact, entry `lavish-axi docs/issues/attachments/2026-09-28-hub-document-design-review/review.html --reopen`) on 2026-09-29 with `chrome-devtools-axi` session `bring-hub-patch-and-release-pages-into-the-design-system-drive`:

- `eval "document.querySelector('iframe').contentDocument…"` on the Lavish session page returned null (the artifact iframe is cross-origin/sandboxed), so the review's DOM couldn't be measured from the page the maintainer sees. The snapshot does traverse the iframe, and `fill`/`click` on its refs worked (dispositions queued and removed).
- `newpage http://127.0.0.1:4387/artifact/<session>/index.html` (the iframe's URL without its query) rendered "Artifact load expired": the load token is single-use.
- `eval "document.body.innerText"` output was clipped mid-string ("… (12045 chars omitted, 20045 total) …") inside the JSON result, which also broke JSON parsing (raw control characters). Workaround: slice in 6000-char chunks and parse with `strict=False`.

Workaround for the first two: `--no-open` on the entry (so the maintainer's browser isn't opened), drive interactions in the Lavish session page, and open the same file over `file://` for DOM reads and measurements. Relative links in the artifact to `../../<issue>.md` resolve to `http://127.0.0.1:4387/<issue>.md` and 404 under Lavish, while they work over `file://` and in Obsidian.

Possible improvements (not established): a driver-facing way to read the artifact DOM in the session page, or a documented `file://` equivalence; an `eval --out FILE` that writes the full result.
