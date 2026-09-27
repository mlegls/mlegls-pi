---
stage: ticket
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
---

First end-to-end dsh plugin: the hashline `read`/`write`/`edit` from `lib/outline-read/` (the ones `ab read`/`ab edit` use) registered as dsh tools, with the default fs tools removed, running under PTC. Done when `dsh web --patch $PWD/dsh/cordis.yml` starts with these tools and the stock fs tools absent, and one `run_code` program reads a file, computes an edit from the returned anchors, and applies it.

- `read` returns structured lines (`{n, hash, text}[]` or equivalent) so a program can compute edits from anchors without the model copying them. Typed returns: see dsh's `.agents/notes/implemented/feature/2026-06-15-ptc.md` and later notes.
- Hashes already enforce read-before-write staleness, so `tool-fs`, `tool-str-replace-editor` and `fs-observation-policy` go (`ctx.tools.restrict()` or leaving them out of the overlay).
- Settle and record in [[projects/mlegls-pi/issues/dsh-port]]: which dsh runs the overlay (the `bunx` 0.1.5 build, a newer npm rc, or the local clone built at 477b4f4; the docs describe the clone), how `dsh/` resolves `@deepseek-ai/*` packages, whether `dsh/` is a bun workspace, how plugins import `lib/`, and the pinned version. The later tickets build on this layout.
- Report friction with Cordis/PTC as you find it (tool schema, result shaping, HMR); later tickets read the report.

## Result

The npm 0.1.7-rc.2 overlay starts Web with the hashline preset. A real `run_code`
program read structured lines, computed a hunk from the returned anchor, and
applied it; the visible registry was exactly `read`, `edit`, `write`, `run_code`.
Layout decisions are recorded in [[projects/mlegls-pi/issues/dsh-port]];
setup and the program are in `dsh/README.md`.

[Fresh supervised Web encounter and evidence](../attachments/dsh-hashline-tools-spike/index.md): the model read `beta`, applied an anchor-derived `gamma` edit in one PTC program, and reread `alpha\ngamma\n`. Trajectory shows `run_code` and nested `read`/`edit`/`read`; screenshots are included for visual review. The verifier configured an isolated DeepSeek API-key route and disabled two ancillary request-extension contributors after their preparation failed; the failure cause remains unisolated ([[projects/mlegls-pi/issues/dsh-web-deepseek-extension-preparation-fails]]).

Friction owners: [[projects/mlegls-pi/issues/dsh-preset-relative-plugin-loading]], [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]], and [[projects/mlegls-pi/issues/dsh-web-deepseek-extension-preparation-fails]].
