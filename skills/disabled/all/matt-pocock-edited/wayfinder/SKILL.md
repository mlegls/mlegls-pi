---
name: wayfinder
description: "Use when planning work larger than one agent session."
disable-model-invocation: true
---

For a loose idea too big for one session, wrapped in fog: chart the way to the **destination** as a **shared map** of **decision tickets** (questions whose resolution is a decision, not build slices) on the issue tracker, and work them until the route is clear. Domain-agnostic: engineering, course content, whatever fits.

**Plan, don't do.** Each ticket resolves a decision; the map is done when nothing is left to decide before someone goes and does the thing. The pull to just do the work usually signals the edge of the map — time to hand off. An effort's **Notes** can override this and carry execution into the map.

**Refer by name.** In everything the human reads, call maps and tickets by their issue title, the id/URL riding inside the name as a link — never a bare `#42`.

## The map

A single issue labelled `wayfinder:map`; tickets are its child issues. The map is an **index**, not a store: a decision lives only in its ticket; the map gists and links. Open tickets are not listed — they're found by query. Where maps, children, blocking, and frontier queries physically live is tracker-specific: consult the tracker doc's "Wayfinding operations" section (if no tracker was provided, tell the user to run `/setup-tracker`, or default to the local-markdown tracker).

Map body:

```markdown
## Destination

<what reaching the end looks like: the spec, decision, or change. One or two lines; every session orients to it first.>

## Notes

<domain; skills every session should consult; standing preferences>

## Decisions so far

- [<closed ticket title>](link): <one-line gist of the answer>

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->
```

Ticket body, sized to one 100K-token session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

A session **claims** a ticket by assigning it to the dev driving the map, first, before any work — the assignee is the claim. Blocking uses the tracker's **native** dependency relationship (it renders the frontier visually; only trackers without one fall back to a body convention). The **frontier** = open, unblocked, unclaimed children. Answers are recorded on resolution, never in the body; assets are linked from the issue, not pasted in.

## Ticket types (`wayfinder:<type>` label)

Every ticket is **HITL** (worked with a live human — the agent never answers the human's side; a grilling agent answering its own questions has broken this) or **AFK**:

- **research** (AFK): surface a fact a decision waits on, via a subagent invoking the `research` skill.
- **prototype** (HITL): raise the discussion's fidelity with a cheap concrete artifact via the "prototype" skill, linked as an asset.
- **grilling** (HITL): conversation — the default. Always invoke the `grilling` and `architecture` skills.
- **task** (either): manual work that unblocks a decision (provision access, move data) — the one type that *does*; its answer records what was done and resulting facts later tickets depend on. AFK where the agent can; else a precise checklist for the human.

## Fog of war

Don't chart what you can't yet see. **Not yet specified** holds the dim view — suspected questions, areas to revisit — written as loosely as the view allows; resolving tickets graduates patches into fresh tickets. **Fog or ticket?** — can you state the question precisely *now* (not: answer it)? Sharp → ticket, even if blocked. Not sharp → fog; don't pre-slice it, one patch may become several tickets or none.

**Out of scope** is different: work beyond the destination, ruled out consciously — never fog, never graduates (returns only if the destination is redrawn, as a fresh effort). A mis-scoped existing ticket gets **closed** with one Out-of-scope line (gist + why, linking the closed ticket); it stays out of Decisions so far, which records only the route walked.

## Invocation

Two modes; either way **never resolve more than one ticket per session** (exception: research tickets).

**Chart the map** (invoked with a loose idea):

1. Name the destination — invoke `grilling` and `architecture`. It fixes the scope, so it's settled first.
2. Map the frontier: grill **breadth-first** across the whole space. If no fog surfaces (the journey fits one session), no map is needed — stop and ask the user.
3. Create the map (`wayfinder:map`): Destination and Notes filled, Decisions empty, fog sketched into Not yet specified.
4. Create the specifiable tickets as children, then wire blocking edges in a **second pass** (issues need ids first).
5. Fire a research subagent per `research` ticket, capturing findings on a throwaway `research/<name>` branch with a context pointer from the ticket.
6. Stop — charting is one session's work.

**Work through the map** (invoked with a map; ticket optional — without one, you pick, not the user):

1. Load the map, not every ticket body.
2. Choose the named ticket, else the first frontier ticket. **Claim it before any work.**
3. Resolve it, zooming into related/closed ticket bodies on demand and calling whatever skills `## Notes` names (in doubt: "grilling" + "architecture").
4. Post the answer as a resolution comment, close the issue, append a context pointer to Decisions so far.
5. Create newly-surfaced tickets (create-then-wire); graduate fog the answer sharpened, clearing it from Not yet specified; rule mis-scoped tickets out of scope; update or delete tickets the decision invalidated.

Expect concurrent sessions editing the tracker — the user may run unblocked tickets in parallel.
