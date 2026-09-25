---
stage: done
assignee: agent
author: session:2026-09-24T07-18-35-016Z_01a0d247-c907-7064-88fb-f3f745a1ab42
---

Replace the pinned `mlegls/pi-better-skills` fork (`a87cfcc`) with the upstream release that includes explicit tool-result ownership. Done when an exec raw read of a SKILL.md with a dynamic block stays raw and `loadSkill()` still expands it once. Obsolete if [[projects/mlegls-pi/issues/pi-better-skills-ownership-pr]] ends without upstream support.

2026-09-25: PR #4 shipped in v1.3.7. Switched the global pi package pin to upstream `fe87a7885ce15b3f0ccf7b34704cebbd3f3ea5b7`, removed the fork and local fallback patch. The upstream ownership test passes (9/9); a local `loadSkill()` probe kept a raw SKILL.md untouched, expanded the explicit load, and ran its command once even after `content()`.
