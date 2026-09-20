---
name: code-review
description: "Use when reviewing changes, or asked to interrogate, stress-test, or tear apart code or a design."
---

Review the diff between `HEAD` and a fixed point on two axes — **Standards** (conforms to the repo's documented standards?) and **Spec** (faithfully implements the originating issue/spec?) — as parallel sub-agents, reported separately so neither axis masks the other (standards-clean code can build the wrong thing; spec-faithful code can break conventions).

The issue tracker should have been provided; if `docs/agents/issue-tracker.md` is missing, tell the user to run `/setup-tracker`.

1. **Pin the fixed point** (ask if unspecified). Diff via `git diff <fixed-point>...HEAD` (three-dot, against the merge-base); commits via `git log <fixed-point>..HEAD --oneline`. Confirm the ref resolves (`git rev-parse`) and the diff is non-empty before spawning anything.
2. **Find the spec**, in order: issue references in commit messages (fetched per `docs/agents/issue-tracker.md`); a path the user passed; a spec file under `docs/`, `specs/`, or `.scratch/` matching the branch; else ask. No spec → the Spec agent is skipped and the report says so.
3. **Find the standards sources**: anything documenting how code should be written (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, …). On top, the Standards axis always carries the **smell baseline** — Fowler's smells from _Refactoring_ ch.3: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest. A documented repo standard overrides the baseline; every smell is a labelled judgement call ("possible Feature Envy"), never a hard violation; skip anything tooling enforces.
4. **Spawn both sub-agents in parallel**, each given the diff command and commit list. Standards also gets the standards files and the baseline list, briefed to report documented-standard breaches (citing file + rule) and baseline smells (naming the smell, quoting the hunk), distinguishing hard violations from judgement calls, under 400 words. Spec also gets the spec, briefed to report missing/partial requirements, scope creep, and wrong-looking implementations, quoting the spec line for each, under 400 words.
5. **Aggregate** under `## Standards` and `## Spec`, verbatim or lightly cleaned — do NOT merge or rerank across axes; that's the masking the separation prevents. End with per-axis counts and each axis's worst issue; no single winner.

## Adversarial mode

For "interrogate", "adversarial review", "stress test this", "tear this apart", or another skill requesting design pressure (e.g. `revise-theory` on a sketch). Deltas:

1. Scope may be an artifact instead of a diff (a design sketch, named files); then skip step 1 and the Spec axis reviews against the stated intent.
2. State the intent in one paragraph before spawning; ask if unclear.
3. Add a Quality axis: `references/reviewer-prompt.md` filled with the intent, the scope, `references/rubric.md`, and `references/code-quality-review.md`, spawned read-only 2–4 times with the identical prompt on distinct models or tiers where the harness offers them. Model diversity is the signal, not assigned personas.
4. After the unmerged per-axis sections, apply `references/lead-judgment.md`: bucket every finding **Act on / Consider / Noted / Dismissed**, keep axis and model attribution, end with an agreement map. Do not auto-apply changes.
