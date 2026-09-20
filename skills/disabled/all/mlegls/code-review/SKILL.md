---
name: code-review
description: "Use when reviewing changes, or asked to interrogate, stress-test, or tear apart code or a design."
---

Parallax. A change can fulfill its spec, fit its theory, and still be difficult
to understand. These are separate questions; agreement on one does not answer
the others.

1. Establish the artifact under review: a diff, worktree changes, named files,
   or a design. For a branch, pin the base and head; three-dot diff reviews
   changes since the merge-base. Inspect a nonempty scope before delegating.
2. Find the promise (request, spec, issue and discussion), the mapped theory,
   and relevant project conventions. Say which evidence is unavailable rather
   than inventing it or blocking every review on a formal spec.
3. Review the useful perspectives: promise, theory, and
   [reader load](references/reader-load.md). Separate contexts help where
   independence adds information. A small review does not need a panel;
   `variety` distinguishes independent judgments from assigned coverage.
4. Check findings against the source and intended behavior. Report concrete
   consequences, locations, and supporting evidence. Preserve disagreements
   that matter; no overall score needs to average them away.

For an adversarial review, make the intent and scope explicit and invite the
strongest challenge. A design's intent can itself be questioned without
silently changing the assignment. The parent adjudicates delegated findings
against the source and user context, not by vote.

`measure-reader-load` can resolve a substantive comprehension dispute. Otherwise
judgment is enough. A review with no findings is a valid result.
