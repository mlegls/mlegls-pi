---
stage: spec
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
blocked-by: ["[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]"]
---

PTC bindings for the two things agents currently leave the harness for.

Shell as a first-class primitive inside programs: a `$` template (zx / Bun shell style) that runs through dsh's sandbox and approval policy and returns `{stdout, stderr, code}`, so moving to TS doesn't give up bash fluency (pipes, one-liners).

Intensional edits. Edit tools are extensional: every site is listed. The intention is usually a rule ("rename X and fix call sites", "wrap every handler matching P"), which is why models drift to custom Python scripts for edits. Add edits by transform next to anchor edits: ast-grep patterns/rewrites, and a function over anchored lines, applied as one batch with a combined result. Check what `ctx.tools` allows for arguments; functions can't cross the binding boundary, so a line transform is either computed in the program and submitted as anchor edits, or passed as source.

Done when one program can grep, transform matching sites across several files and run the tests, with each nested call visible as its own `tool/ptc-dispatch` entry.

**Verification:** [[projects/mlegls-pi/issues/dsh-ptc-shell-and-transform-edits/attachments/index]] records the fresh setup/readiness and unobservable required behaviors; the prior ignored diagnostic plugin/log were unavailable in this checkout.
