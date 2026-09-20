---
name: principles
description: "Use when a parent skill names a design or execution principle to consult."
---

# Principles

## Before writing logic

- Data structures first; scaffold before features; subtract before scaffolding.
- A well-known library over a from-scratch reimplementation, when one fits the project's constraints; name it in the spec or sketch so the choice is reviewed.
- Model the domain: state machine over scattered booleans, table or union over branches spread across files, module per concept not per phase. Tell: a feature adds one more branch, or a second boolean that must stay in sync.
- No precedent → 2–3 structurally distinct candidates side by side. A variant of the first doesn't count.
- New requirement → redesign as if it had been there on day one; deliver incrementally.
- Shared mutable state: name it; give each actor its own file/key/branch and merge at read time; serialize structurally only when one writer is a real invariant.
- Runs amid crashes and retries: twice; died at any point; converges? Else add reconciliation.

## While implementing

- Build the lever: one unit by hand, then the script, rerun on that unit and diff. Cited without a script in the diff = not applied.
- One change, one check, then the next. Commits stack as an argument: failing test then fix, subtraction then reshape.
- New internal API: migrate callers and delete the old one in the same wave.
- Planned migration: converge on the end state; scoped breakage over compatibility shims.
- Re-spec on friction. Tells, as a pattern: same workaround across unrelated code; each edge case its own branch; types needing escape hatches; "we need a lock" where nothing was shared; a simplification net-adding lines. Stop; don't continue the old plan while waiting.

  No:
  > Continue with the remaining steps of the plan; the extra helpers can be cleaned up in a follow-up.

  Yes:
  > Stopping: the plan called this a simplification but we're at +340/−120 and every call site needs an adapter. Constraints learned: X, Y. Proposed re-spec: Z. Continue?

- Bulk output, long files, screenshots → subagent; summary back.

## Testing

- Only behavior that survives a refactor: through the seam, never internals. A test that breaks when behavior didn't change is implementation-coupled; delete or move it up a seam.
- Expected values from an independent source of truth (known-good literal, worked example, the spec), never recomputed the way the code does.
- Few seams, as high as possible; the `tdd` skill for the loop itself.

## When debugging

- Reproduce; ask why to the root; no guard that silences the symptom; grep for the pattern and fix every instance; stuck → instrument.
- Fails after restart → state (config, cache, lock, serialized) before code.

## Before declaring done

- Prove it on the real artifact: run the path, read the value, diff the output. A delegate's diff, not its summary. Best proof is a script a reviewer reruns.

## Whenever you repeat an instruction

- Strongest rung: unrepresentable state → lint or banned API (`setup-lints`) → canonical helper → runtime check → text. One-off → memory; recurring → lint or skill; systemic → here.
