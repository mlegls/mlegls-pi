# Issue tracker: vault

The [lifecycle contract](lifecycle.md) defines stage, readiness, assignment and completion.

work is markdown under `docs/issues/`, browsed as `~/obsidian/projects/<repo>`. no service; publishing is writing the file.

```
docs/issues/<slug>.md           live
docs/issues/archive/<slug>.md   stage done, purpose fulfilled; obsidian rewrites links on move
docs/issues/attachments/        research, evidence, pasted images an issue links
```

filename is the identity and title; no H1. links are vault-absolute wikilinks `[[projects/<repo>/issues/<slug>]]`.

## frontmatter

```yaml
stage: idea | goal | spec | ticket | done
assignee: agent
author: session:<origin>
part-of: "[[projects/<repo>/issues/<parent>]]"
blocked-by: ["[[projects/<repo>/issues/<x>]]"]
claimed-by: session:<holder>
priority: 1 | 2 | 3 | 4
```

Omit stage only when all residual work is delegated to children; null is invalid. Priority and assignment do not inherit. Assignment accepts agent, human, user:<name>, session:<id>, agent:<existing stance>, model:<provider>/<model>:<effort>, or a comma-separated stance/model pair. Routing resolves model selectors. Historical unknown authors are omitted; provenance is immutable.

`bun $PI_SKILL_DIR/scripts/issues.ts frontier|mine|done|tree [slug] | snapshot [slug] | check | outline`. Scope explicitly selects deferred work too. Frontier uses whole-subtree readiness, eligibility, blockers and conservative claims; mine uses explicit human/user assignment including pre-spec shaping; done exposes live results for digestion. Tree shows own and effective stage. Outline reconciles the project vault note. `snapshot --json` (or query `--json`) provides schemaVersion, lifecycle issues and a separate legacy collection; rows expose ownStage, effectiveStage, ready, eligible, frontier, blockers, claims, selectors and done. Omitted ownStage is serialized as null, not valid stored YAML. JSON is a model projection; run `check` separately for diagnostics.

The CLI uses the skill-owned lock: `bun install --frozen-lockfile --cwd $PI_SKILL_DIR/scripts`; regressions: `bun test --cwd $PI_SKILL_DIR/scripts`.

Frontmatter is a strict YAML mapping. Relations are quoted vault-absolute issue wikilinks; blocked-by is a list. Every query rejects malformed YAML, duplicate keys/slugs, aliases, explicit tags, merge keys, invalid tracker fields and relation cycles before emitting results. Extra metadata is allowed; attachments/ is not scanned as issues. `check` preserves link/heading checks and flags resolved blockers and suspect claims.

### Semantic preflight

`issues.ts lint [slug] [--json]` refreshes Jev judgments for live issues in scope (including live done records). Unchanged input reuses the cache; `mine` and `frontier` only read it, reporting fresh, stale, missing or error. Their JSON rows carry advisory lint details; snapshot schema/readiness remains unchanged.

Findings give a suspected mismatch, probability, selected source quote and question to reconcile. No finding certifies correctness; findings never change stages or block dispatch. The display threshold is an uncalibrated majority judgment. Separate follow-up ideas and explicit evidence limits are not unfinished delivery by themselves.

Context is the issue, immediate parent/children/prerequisites and directly linked Markdown evidence, with no network fetch or recursive crawl. At most ten documents are shown (12,000 characters for the issue, 4,000 for each other document); missing links and clipped context are marked. Cache fingerprints include full collected sources and the lint policy. This cannot discover unlinked superseding evidence or inspect current code.

Cache: `$XDG_CACHE_HOME/mlegls-pi/tracker-lint/` (default `~/.cache`), keyed by project and issue; deleting an entry forces another judgment. Jev credentials use the existing `lib/decide.ts` configuration. Failed refreshes preserve the last successful entry and exit nonzero; offline queries still expose stale/missing results. `orient` and `supervise` refresh at entry, not at every dispatch.

### Legacy projects

Issues retaining `next: grill | research | prototype | measure | simplify | implement | wait | done` remain readable/checkable and appear explicitly as legacy. They have no lifecycle readiness/frontier. Mixing next with stage is invalid; existing provenance and assignment metadata are preserved without certifying readiness. Reconcile bodies, code and results before assigning lifecycle metadata; no automatic translation.

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

resolve: record the answer or land the code and satisfy its recorded acceptance (including story verification), `stage: done`, drop the claim and remove resolved dependent blockers. Leave the result live for review/digestion; move to `archive/` once it has fulfilled its enclosing purpose. a parent whose children are all done goes with them when its destination is met. commit message names the issue.

friction: `stage: idea`, immutable `author: session:<origin>`, the observation raw with its originating story and evidence. Priority follows observed impact; unknown impact stays unknown. Triage before execution.

join the messenger channel named for the parent's slug when your ticket shares an interface or files with a sibling in flight. reserve paths, say when you land. nothing there is reread; anything worth rereading goes in the issue.
