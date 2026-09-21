---
tags: [task]
next: done
priority: 1
---

the bridge described in the vault note [[directing multi-agent work]]: a pi skill I invoke in a session after editing notes, which finds supertagged blocks and acts on them per [[workflows]], writing results back into the notes. until obsidian triggers it directly, this is the whole "control plane"; the invoker is the part that later becomes a palette command or watcher, so keep it a library call with a thin skill.

- `lib/vault.ts`: `changed()` = notes under ~/obsidian (root only, not project symlinks) modified since a stamp file; `blocks(note)` = supertagged bullets with their subtree, plus the thread state: the last {>>…<<} under a bullet, and whether it's the user's (plain) or a model's (prefixed `name: `). `act(block)` per tag; `writeBack` inserts comments nested under the bullet or replaces the bullet per the tag's rule, guarded by content match like lib/augment.ts.
- tags and their rules are read from workflows.md's tag list at call time (the `- #tag - what to do` bullets); the code knows only the syntax and the write-back forms. handle now: #question (lens comment; a lens parameter in the bullet like `grilling`, `devils-advocate`, `what-else`, or `× fable, grok` for fan-out overrides the default grilling), #do (fulfill; replace the bullet with a link to a new note, or inline if small), #align (comment). #retro, #to-spec, #implement: comment "not handled yet". an open thread (last comment is the user's) on a #question bullet is answered as a reply.
- lib/route.ts: drop the keymap parser; `route(workflow, block)` returns (model, effort) only; the lens is explicit. lib/augment.ts becomes the palette-side caller of the same act().
- skill `vault` in skills/enabled/all/mlegls/ (find where the others live): one paragraph, calls the library, summarizes what it wrote, and lists blocks it declined.

done: editing a vault note to add a #question bullet and a #do bullet, then `/skill:vault` in a session, yields a comment under the first and a link under the second, with nothing else in the notes changed; a second run with no edits does nothing.

## decisions

- 2026-09-20: `lib/vault.ts` owns block/thread parsing, act, guarded write-back, and run. `lib/augment.ts` delegates to the same act/writeBack seam and reexports its old bullet helpers. `route(workflow, block)` returns only model/effort, reading the current routing prose and catalog rather than vanished keymap/selection/pool headings.
- 2026-09-20: Workflow rules are loaded from workflows.md on each act. Declaration bullets (`- #tag - rule`) and fenced examples are not invocations. Question lenses load the existing skill bodies; explicit × aliases use the first catalog model/effort pair for each name, with one model-prefixed comment per answer. Plain-last-comment threads reopen; model-last-comment threads are declined. Unsupported configured tags receive `vault: not handled yet`.
- 2026-09-20: Stamp is a per-note mtime map at ~/.local/state/mlegls-pi/vault.json. First unscoped run considers all root markdown files, never symlinks or subdirectories. `run({notes:["mlegls-pi.md"]})` limits writes without consuming other notes. New result notes are stamped too. Errors leave the source pending; semantic declines are reported and stamped until another edit. Run serially; this is not a watcher/locking protocol.
- 2026-09-20: #do uses the existing tool-free pi completion for written artifacts: validated inline text or an exclusively-created new note and replacement link. Requests requiring external actions are declined, not represented as completed work. Nested tagged subtrees are handled bottom-up; a tagged ancestor is declined rather than replacing another invocation.

## signals

- Live Jev route returned deepseek/deepseek-flash, low. Added one #question and one #do to ~/obsidian/mlegls-pi.md fleeting; `bun lib/vault.ts mlegls-pi.md` wrote one DeepSeek comment and replaced #do with "Vault invocation loop" (dogfood note, since deleted), creating ~/obsidian/Vault invocation loop.md. Results remain there. Returned 2 written, 0 declined.
- Immediate identical invocation returned 0 written, 0 declined. Hash comparison across all pre-existing root markdown notes: exactly mlegls-pi.md changed; its original content remained a byte-identical prefix. Exactly one new root note: Vault invocation loop.md.
- Disposable Bun signal passed declaration/fence exclusion, plain-user/model-last thread classification, deferred-tag comment, stale-block refusal, inline replacement, and two-model comment insertion. Removed the signal script; no permanent tests added. Live fan-out and the Obsidian palette/skill UI were not exercised; the library/CLI path was.

## frictions

- Observed: ~/obsidian/augment.md is absent. Read lib/augment.ts and the archived augment-comment ticket for the write-back/palette contract; no substitute vault note edited.
- Observed exec ergonomics: combined large reads plus board output hit the 16 KiB show cap and omitted later material. Workaround: smaller separate reads and board fields:meta. Wanted: later values still visible or an explicit per-value budget.
- Observed exec ergonomics: a large double-quoted write() payload contained unescaped JSON quotes and failed cell parsing before disk; backslashes also needed a second JS escaping layer. Workaround: write(path, [double-quoted lines].join("\n")), with explicitly escaped quotes/backslashes. This avoids backtick/${ interpolation but not nested-language quoting; no new payload API proposed here.
- Deferred: stamp updates and read/write guards assume a serial invoker. Concurrent invocations/editor changes outside the selected block can race or consume an edit not seen in the initial snapshot; a watcher would need coordination.
- Deferred: #do artifacts are model-generated prose, not verified implementation documentation. The live result describes a content-only loop although this implementation also has an mtime stamp; left the requested result untouched.
- Install: after merge, rerun ~/.config/system-config/scripts/agents-apply.sh to expose the new enabled vault skill to the harness.
