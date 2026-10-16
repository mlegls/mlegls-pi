---
name: paper
description: "Use when a project keeps its GUI in Paper (paper.design), or the user points at a Paper selection or comments."
---

Paper is the medium for GUI changes, not chat. The project's Paper doc (concept: `docs/design/paper.md`) maps file, pages and artboards to surfaces and says how editions reach Paper; read it first.

- Agree a UI change on the artboard before code. The user edits the canvas or comments; you change the artboard. Implement from `get_jsx` and `get_computed_styles`.
- "Look at this" means `get_selection`. "Comments are in" means `list_comment_threads`. There is no reply tool: answer in chat, and resolve a thread once the design addresses it.
- `get_guide` explains the tools. Its taste rules (mood words, playful register, invented palettes, Swiss editorial type) yield to the project's design system: style with the file's tokens as `var(--token)`.
- After landing a change that departs from its artboard, update the artboard.

Observed limits, beyond what the tool descriptions say:

- Tokens are file-global fixed values. `calc()` is rejected, and a custom property set on a frame is silently dropped, so per-sheet theming means literal values or a whole-file `set_tokens` swap.
- A text node has one font family, and it isn't inherited from frames. A family token holding a list doesn't resolve at all.
- A childless `div` becomes a Rectangle, which can't take children later. When writing a shell to fill in later calls, give it a placeholder child.
