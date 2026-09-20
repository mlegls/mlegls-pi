---
name: introduce
description: "Use when an idea, problem, or request is not yet in the tracker or docs."
disable-model-invocation: true
argument-hint: "the idea, problem, or request"
---

Find where the new request belongs: in the existing code and theory, stories,
and nearby tracker work. Often there is already a good name for it, or an
answer that makes the proposed implementation unnecessary.

Confirm the approach before substantial work, and the proposed content before
writing shared records (`grilling`). A briefing can be short without skipping
that confirmation.

- Existing item: `/advance` it.
- Clear, local change: brief the user and implement within the request.
- Unsettled decision: `grilling`, `research`, or `prototype`, according to what
  would resolve it.
- Work that needs to survive several sessions: a spec for settled work, a map
  for open questions and the tickets they unblock.

The project's tracker docs describe maps, holes, and their frontier. A map
records the destination and decisions without pretending the whole route is
known. Draft enough to make the next useful move possible; publish after
confirmation.

If the request exposes a flaw in the theory, `architecture` and
`revise-theory` are available. New code alone is not evidence of a new theory.
