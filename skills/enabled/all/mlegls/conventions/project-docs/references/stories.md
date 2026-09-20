# Stories

A story is something a user would say. The argument for it is the sequence
of affordances that fulfils it, the steps those decompose into, and the tests
of those steps composed back into the sequence: `testing`'s derivation,
recorded. The sequence proofs together are the story's. `simplify` writes
them, to fix the behavior a refactor preserves; `implement` runs them.

`docs/stories/<id>.md` holds one want and its children. The root has an H2
and a stable ID; children are list items with dotted IDs and inherit the
frontmatter and the actor; a child is a narrower want from the same state,
or a sequence someone noticed. A want that starts from a later state is its
own file.

```markdown
---
persona: newUser
kind: process
sequence: test/sequences/learn.test.ts
---

## `learn` As a new user, I want to say what I want to learn and start.

Sign up → new [[projects/<repo>/concepts/Session]] → say it → the tutor
proposes a [[projects/<repo>/concepts/Mission]], a
[[projects/<repo>/concepts/Confirmation]] → accept → the lesson opens.
Right at the end: Me shows the Mission, the lesson is attached to its
Nodes, and the tutor's first turn is about the target, not a re-ask.
`test/sequences/learn.test.ts` walks it; driven in the browser 2025-08-30.
The Hub route has only been walked over fixtures.

```
signUp    Account entry → Principal; initializeProfile
say       admitTurn → Work → Harness
propose   propose_mission{statement, graphDiff} → Confirmation
accept    acceptConfirmation → Mission record, View; handoff to a new Session   ? handoff
Me        browseProfile → Mission card
```

- `learn.read` I want to read what the tutor wrote at my own pace while we
  keep talking. Material opens beside the conversation; driven with `learn`.
- `learn.proposed` I want the tutor to suggest cards after a lesson, and to
  say no. Not implemented.
```

`persona` is the state the sequence starts from, named as the harness
exports it (`newUser`, `learner`, `author`, `maintainer`, …): the fixture
the earlier sequences derive, cached by the harness (a snapshot where the
state serializes), so the prerequisite lives in code but is not rerun. A
state is a persona when more than one story starts from it; a state one
story needs is that story's own setup. The role is in the sentence. `kind`
is what the story is owed: `process`, every user of that persona does it,
its sequence always runs and is walked by hand before a release; `feature`,
occasional, sequence test only; `report`, someone noticed it, with `noticed:
<date>` and the prose opening with how, deletable once the cause is
structural. `sequence` is the test file that walks it, one per story, one test per
chain named as the chain, children in the same file; absent means unwalked.
`scripts/stories.ts` lists and checks them. No status field: no `sequence`
is unwalked, "not implemented" is a sentence.

The argument is prose in the vocabulary: the sequence as concept links, the
join stated, then what walks it. After the prose, the program steps as a
block: one line per step, the verb the harness would call, the Operation
and Core call it decomposes into, and `?` at the end where the verb does not
exist yet. Each line is a test's name; a `?` is what to add. A child with
steps of its own carries its own block. A story cites its sequence test; a
step's test is the concept's, cited from its note. A claim with no argument
is agreed and unimplemented; a sequence nobody has walked says so.

The block as the user reads it is a guide, `docs/guide/<task>.md`, `for:` the
persona, in the words on the screen, covering only what works; the story
cites the guide that walks it, and states where the guide departs from the
block, which is the story's status. What the guide does not say and no step
test checks yet, the failure injections and the assertions, is a checks note
under the block, one bullet per step with its observation; that note is what
`simplify` turns into step tests. `verify-story` is the persona following the
guide. A guide no story cites is an affordance without a want; a story with
no guide is unimplemented or cannot be explained; a block step with no guide
line is internal or a `?`.

A bug is a story once someone noticed it, told from how they noticed: what
slowed down, which sequence of actions; not a property named in advance. "I
want each Profile separate from other accounts" is nobody's thought; it is
the last assertion of "I want a scratch Profile", that Main is still as it
was. Anticipated divergence goes in a sequence the user performs ("I
accepted on my phone after editing on my laptop"), not in a story of its
own.

Step tests are named as the user's step: `can create a Mission from a new
Profile`; the sequence test as the chain. What each asserts is `testing`'s.
