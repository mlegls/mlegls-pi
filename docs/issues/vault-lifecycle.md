---
tags: [task]
next: implement
claimed-by: frontier/0919/lifecycle
priority: 1
---

the tag list in the vault note [[workflows]] changed after the first real run of lib/vault.ts; the code follows it. read that list first; it is the spec.

- #question default lens is a direct answer (suggestion, or the answer when one-dimensional; ask only when stuck). stance words (grilling, devils-advocate, what-else) still override. fan-out parameter is `* a, b` not `×`.
- #discuss: the invoker writes nothing; `run()` returns them as `agenda`, and the vault skill prints them into the session. a pi command `/record` (extension in this package; see skills/pi) takes the session's conclusions per agenda item and writes each back as a `{>>fable: …<<}` under its bullet, or folds into the bullet text when the conclusion says so, dropping the tag. #to-spec is the same path with the spec-writing stance, and /record flips it to #implement when the spec reads complete.
- #do runs with tools: a forked worker (wm.spawn from: "summary" with the block as the prompt), not the tool-free complete(); it replaces the bullet with a link when it finishes.
- #triage: for a note, every untagged bullet under `## fleeting` becomes a proposal bullet under `## threads` (creating the section): `title #to-spec` or `#implement` with a two-line body, or `drop` / `merge into [[x]]`; the fleeting bullet is removed. one call, jev for the to-spec/implement/drop choice, a model for the title and body.
- #implement: from a thread, tickets in docs/issues/ of the project the note is for (the note's frontmatter `directory`/`repo`; mlegls-pi.md is this repo), `ticket:: [[projects/<p>/issues/<slug>]]` under the thread, workers dispatched. exit hook: when a ticket is archived (tracker `next: done`), collapse the thread to `- ~~title~~ → [[…/archive/<slug>]]` under `## done`. the hook can be a call the parent makes on merge (`vault.done(slug)`) rather than a watcher.
- lib/vault.ts sources ~/.config/secrets/api-keys.env itself if JEV_API_KEY is unset.

done: on ~/obsidian/mlegls-pi.md: a #question gets a direct answer; #triage on three fleeting bullets produces three thread proposals; #implement on one of them creates a ticket here and links it; `vault.done(slug)` moves it under done; a #discuss bullet comes out as agenda from `/skill:vault` and `/record` writes a conclusion back. leave the results in the note.
