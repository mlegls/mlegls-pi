---
name: pr
description: "Use when writing a PR body, or the result of a done ticket."
metadata:
  credits:
    skill: pr
    author: Matt Pocock
    url: "https://github.com/mattpocock/skills/blob/main/skills/in-progress/pr/SKILL.md"
---

```markdown
<summary: the smallest `show-me` view of what changed. for a ticket, a diff against its shape>

## Evidence

**Before:** <screenshot/recording/output/failing test>
**After:** <the same, now>

## Danger

**Door:** <one-way or two-way>. <what can't be walked back, if anything>
**Blast radius:** <one word>. <what could break beyond the change>
```

screenshots or recordings when the change is visible, else execution: the exact test or command that failed and now passes. name what couldn't be checked. skip preambles; use the project's `concepts/` vocabulary.
