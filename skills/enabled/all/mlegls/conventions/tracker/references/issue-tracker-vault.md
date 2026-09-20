# Issue tracker: vault

work is markdown under `docs/issues/`, browsed as `~/obsidian/projects/<repo>`. no service; publishing is writing the file.

```
docs/issues/<slug>.md           live
docs/issues/archive/<slug>.md   done; obsidian rewrites links on move
docs/issues/attachments/        research, evidence, pasted images an issue links
```

filename is the identity and title; no H1. links are vault-absolute wikilinks `[[projects/<repo>/issues/<slug>]]`.

## frontmatter

```yaml
next: grill | research | prototype | measure | simplify | implement | wait | done
part-of: "[[projects/<repo>/issues/<parent>]]"
blocked-by: ["[[projects/<repo>/issues/<x>]]"]
claimed-by: <session name>
priority: 1 | 2 | 3                                # roots; children inherit the nearest
```

`next` is the kind of session this issue needs now. grill: decide with me. research: search the web or the machine. prototype: build and iterate with me; the iteration replaces the backbrief. measure: an experiment; needs a harness designed first. simplify: a friction, linking the concept or path where it happened; the concept's backlinks are the theme. implement: shaped enough to code. wait: nothing anyone can do yet. an issue with open children is carried by them.

`blocked-by` is what the *next* step waits on, not everything the issue will ever wait on. when `next` changes, ask again. implementing A may wait on B while deciding A doesn't; so A is `grill` and unblocked until it's `implement`.

derived, never stored: agent frontier = research/implement/simplify, unblocked, unclaimed. mine = grill/prototype/measure, unblocked, by priority then transitive unblocks. `bun $PI_SKILL_DIR/scripts/issues.ts frontier|mine|tree [slug] | check`; `[slug]` scopes to a subtree. `tracker/Tracker` and `tracker/Graph` at the vault root show the same across projects.

The CLI uses the skill-owned dependency lock: once after installation or update, `bun install --frozen-lockfile --cwd $PI_SKILL_DIR/scripts`; regressions: `bun test --cwd $PI_SKILL_DIR/scripts`.

Issue frontmatter is a YAML mapping with required `next`. Relations use quoted vault-absolute issue wikilinks; `blocked-by` is a list (inline, wrapped or block style; absent or `[]` means none). Optional fields must have the shown types; `claimed-by` is nonempty. Extra metadata is allowed. Every query rejects malformed YAML, duplicate keys, aliases, explicit tags, merge keys and invalid tracker fields with a filename before emitting results. `attachments/` is not scanned as issues.

## body

```markdown
what done looks like, and where this came from (what was noticed, what was decided under).

substeps: links to child issues in order, what runs in parallel. omit when `tree` says it.

holes: bullets, each linking its resolution once it has one. a hole is its own issue when it's a session on its own or matters to more than one parent.

decisions: one dated line each, linking the question when it had one.

shape: structures, flows, where each new thing lives; a fat-marker sketch, types, or an exact interface where one was settled.
```

preserve the distinction between what we chose and what we used to explore the choice.

sections as the resolution earns them. a question is the same file with the question up top and `## answer` when it has one.

the reader is me later, or an agent who has to be me. state the current state; git is the history. name things as `concepts/`, paths and test names do, so the first grep lands. an issue is as long as its context differs from what the code and docs already say.

> No: "Acknowledge only persisted submissions; show a submission failure visibly. Reject empty symptoms. Reporting is signed-in only, not an anonymous sign-in-failure endpoint. No automatic conversation/page/screenshot capture. No report list, triage controls, `processed` editor, or GitHub integration. […] Run relevant Application tests, `bun test`, `bun run check` and the Application build. Record any unavailable external-service checks honestly."
> Yes: "a report button in the app shell, signed-in, symptom + optional detail, route and Profile attached. capture only; triage is [[…/capture-learner-and-tutor-friction-reports…]]."

## procedure

claim: `claimed-by` before anything else; sessions share the directory, so read before editing.

a ticket is a `wt` worktree on a branch named for its slug; `wt merge` when its stories drive. commit implementation changes in the ticket’s worktree as you go. commit the claim in the canonical checkout before branching. shared tracker changes—parent decisions, dependencies, new tickets—belong in the canonical checkout; workers report these to the coordinator. the ticket’s completion and archival ride its implementation branch.

resolve: write the answer or land the code, `next: done`, drop the claim, a dated decision line in the parent, remove from every dependent's `blocked-by`, move to `archive/`. a parent whose children are all done goes with them when its destination is met. commit message names the issue.

friction: `next: simplify`, the observation raw, without reading other frictions first.

join the messenger channel named for the parent's slug when your ticket shares an interface or files with a sibling in flight. reserve paths, say when you land. nothing there is reread; anything worth rereading goes in the issue.
