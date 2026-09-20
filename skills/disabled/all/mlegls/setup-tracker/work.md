# Work

A map is a destination with an incomplete route. It holds open questions and
implementation tickets, and indexes decisions as they resolve. A spec records
settled intent. A ticket is a verifiable unit of implementation.

## Holes

A hole is a question worth carrying across sessions, with a way to answer it:

- `research`: inspect local facts or primary sources.
- `prototype`: make the question runnable or visible.
- `grilling`: resolve a choice or understanding with the user.
- `task`: perform work that supplies the missing fact or prerequisite.

Its body is `## Question` and `Fill by:` with the concrete investigation,
experiment, conversation, or action. Remote trackers use `wayfinder:<method>`;
local files use `Type: <method>`.

Parentage says where the answer belongs; blocking says what cannot proceed
without it. A question the implementer can settle within the agreed scope is a
child of that ticket, not a blocker of it. A research question waiting on
another result is still research. Unsharpened thoughts can remain in map Notes
until there is a question worth assigning.

Existing `deferred` holes can be sharpened this way when revisited: give them a
fill method and real prerequisites, move implementation-owned questions under
their tickets, or return unformed thoughts to Notes.

## Confirmation

Tracker history becomes source material for later sessions. Show proposed
records and changes and get confirmation before writing (`grilling`), including
claims, comments, and state changes. Approval can cover a presented batch or an
explicit unattended publication policy; choosing a general goal is not approval
to publish whatever emerges.

## Frontier

The frontier is open, unclaimed work whose prerequisites are satisfied. A map
limits the scope to its children; project-wide work includes open holes and
agent-ready tickets. A requested fill method filters the result.

Readiness means the work is specified well enough for its next actor. It does
not mean its dependencies have landed. A closed blocker is a useful tracker
signal; its resolution must actually supply what the dependent needs.

Claim work before changing it, using the tracker adapter's convention. Claims
coordinate people and sessions; an account assignee is not an exclusive lock
between agents using that account. Recheck the live item before writing.

The answer lives on the hole. Resolving it also updates dependent work and adds
a linked gist to the map. Tickets resolve with their implementation evidence.
Use titles as links in human-facing summaries so the work is recognizable.

## Map body

```markdown
## Destination

What done looks like.

## Notes

Context, useful pointers, standing preferences, and thoughts not yet sharpened
into actionable questions.

## Decisions so far

- [Decision title](link): the answer in one line.

## Out of scope

What has been ruled out, and why when useful.
```

Maps carry `wayfinder:map` remotely. Open work comes from the frontier query,
not a second manually maintained backlog in the map body.
