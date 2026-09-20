---
name: vault
description: Act on changed Obsidian supertagged bullets and write results back.
---

Call `run()` from `lib/vault.ts` in the mlegls-pi package (with exec, `await show(await vault.run())`; otherwise `bun ~/dev/mlegls-pi/lib/vault.ts`). It reads root notes under ~/obsidian, workflows.md at call time, and a per-note stamp at ~/.local/state/mlegls-pi/vault.json; the first run considers all root notes. To restrict an invocation, use `run({notes:["mlegls-pi.md"]})` or pass filenames to the CLI; other notes remain pending. Summarize the returned `written` entries (comments, inline results, new-note links), and list every `declined` entry with its reason. Do not perform extra note edits outside the library.

Print every returned `agenda` item into the session without writing a comment: #discuss is discussion, #to-spec is discussion with a spec-writing stance. `/record [note.md]` writes session conclusions using `vault.record`; leave unresolved items pending. Explicit `notes` scans those notes even when stamped.
