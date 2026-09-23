ab read PATH[:SEL]...

Prints `N abcd│text` rows. `abcd` is the line's anchor: copy it into ab edit.
Anchors are unique across files and survive edits to other lines.

Selectors:
  src/a.ts            whole file up to $AB_OUTLINE_OVER lines (300), else its outline
  src/a.ts:50-80      lines 50..80 (inclusive)
  src/a.ts:50+30      30 lines from 50
  src/a.ts:50-        50 to the end
  src/a.ts:5-9,40-60  several ranges
  src/a.ts:all        whole file regardless of size
  src/a.ts:outline    definitions/headings with bodies elided as ⋯ start-end

Images are attached to the result (same as ab view).
