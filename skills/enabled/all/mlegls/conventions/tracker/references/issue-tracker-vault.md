# Issue tracker: vault

The [lifecycle contract](lifecycle.md) defines stage, readiness, assignment and completion.

Storage is Markdown under `docs/issues/` in the git common dir's main worktree, browsed as `~/obsidian/projects/<repo>`. The CLI resolves that single vault from linked or sparse worker worktrees; it never prefers a worker copy. Outside git, discovery walks upward for `docs/issues/` or `issues/` and omits git persistence.

```
docs/issues/<slug>.md           live
docs/issues/archive/<slug>.md   stage done, purpose fulfilled; after moving, run `bun "$PI_SKILL_DIR/scripts/issues.ts" check --fix docs/issues/archive/<slug>.md` with each moved issue's archived path as an argument
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

`bun $PI_SKILL_DIR/scripts/issues.ts frontier|mine|done|tree [slug] | snapshot [slug] | check [--fix [moved issue paths...]] | outline`. Scope explicitly selects deferred work too. Frontier uses whole-subtree readiness, eligibility, blockers and conservative claims; mine uses explicit human/user assignment including pre-spec shaping; done exposes live results for digestion. Tree shows own and effective stage. Outline reconciles the project vault note. `snapshot --json` (or query `--json`) provides schemaVersion, lifecycle issues and a separate legacy collection; rows expose ownStage, effectiveStage, ready, eligible, frontier, blockers, claims, selectors and done. Omitted ownStage is serialized as null, not valid stored YAML. JSON is a model projection; run `check` separately for diagnostics.

`check` also flags a spec or ticket whose effective stage is lower than its own (it names the child: refinement never lowers a node, so that child moves out of the tree), a `docs/frictions.md` beside a vault tracker, and a new uncommitted issue without `author`.

`check` is read-only: it reports dangling links and available archive/heading repairs, exiting nonzero for findings. `check --fix <moved issue paths...>` takes paths to archived issue files, relative to the current working directory or absolute, and only repairs links, and drops `blocked-by` links, whose targets are those files; other repairs remain reported. Without paths, `check --fix` applies all link repairs and drops every `blocked-by` link to a done issue (guards and live blockers stay). Each repair prints as `fixed`; other diagnostics still require review. Same-project vault links resolve against the canonical vault in the git common dir's main worktree. Other projects resolve through the vault.

Markdown file links are checked outside code alongside wikilinks: URI-decoded paths resolve from the containing file, with `#anchors` preserved but not checked. Repairs make repository-root-relative links file-relative, adjust outgoing links after an issue is archived, and point incoming links at archived issues. Scoped `--fix` includes outgoing links from the selected archived files. Unrepairable Markdown links are reported outside `issues/archive/`; archive repairs are still offered.

The CLI uses the skill-owned lock: `bun install --frozen-lockfile --cwd $PI_SKILL_DIR/scripts`; regressions: `bun test --cwd $PI_SKILL_DIR/scripts`.

Frontmatter is a strict YAML mapping. Relations are quoted vault-absolute issue wikilinks; blocked-by is a list of such links and quoted `"<tag>: <value>"` guards, which always count as open (see [lifecycle](lifecycle.md)). Every query rejects malformed YAML, duplicate keys/slugs, aliases, explicit tags, merge keys, invalid tracker fields and relation cycles before emitting results. Extra metadata is allowed; attachments/ is not scanned as issues. `check` preserves link/heading checks and flags resolved blockers and suspect claims.

### Semantic preflight

`issues.ts lint [slug] [--json]` refreshes Jev judgments for live issues in scope (including live done records). Unchanged input reuses the cache; `mine` and `frontier` only read it, reporting fresh, stale, missing or error. Their JSON rows carry advisory lint details; snapshot schema/readiness remains unchanged.

Findings give a suspected mismatch, probability, selected source quote and question to reconcile. No finding certifies correctness; findings never change stages or block dispatch. The display threshold is an uncalibrated majority judgment. Separate follow-up ideas and explicit evidence limits are not unfinished delivery by themselves; whether they are owned is its own finding. `unowned` asks for an incidental defect, friction, cost or evidence limit that links no issue, records no acceptance and is not said to be fixed in the change, and `journal` for a body accumulating dated work records where current state belongs. Both read only the issue's own text. `ab supervise` lists them over its subtree in its done message.

Context is the issue, immediate parent/children/prerequisites and directly linked Markdown evidence, with no network fetch or recursive crawl. At most ten documents are shown (12,000 characters for the issue, 4,000 for each other document); missing links and clipped context are marked. Cache fingerprints include full collected sources and the lint policy. This cannot discover unlinked superseding evidence or inspect current code.

Cache: `$XDG_CACHE_HOME/mlegls-pi/tracker-lint/` (default `~/.cache`), keyed by project and issue; deleting an entry forces another judgment. Jev credentials use the existing `lib/decide.ts` configuration. Failed refreshes preserve the last successful entry and exit nonzero; offline queries still expose stale/missing results. `orient` and `supervise` refresh at entry, not at every dispatch.

### Legacy projects

Issues retaining `next: grill | research | prototype | measure | simplify | implement | wait | done` remain readable/checkable and appear explicitly as legacy. They have no lifecycle readiness/frontier. Mixing next with stage is invalid; existing provenance and assignment metadata are preserved without certifying readiness. Reconcile bodies, code and results before assigning lifecycle metadata; no automatic translation.

## body

each stage adds to the body; nothing before it is thrown away, so an issue reads why → what → how.

```markdown
idea: what was noticed or wanted, with its source quoted verbatim (@thread:…, the story, the evidence).
rough is fine (`universal.md`'s tip on prose applies).

goal: the same prose, edited until it's decided: what we're doing, for which story, what it leaves out.
holes: bullets, each linking its resolution once it has one.

## shape                       (spec)
Shape Up's level: the elements and where each lives, sketched as `show-me` does (call tree,
file tree, diff, types, mermaid); rabbit holes already patched; what's out. enough that a
capable agent builds it without coming back, short of being the code.

## tasks                       (ticket, only when the shape doesn't already say what to do)
1. …

decisions:
- 2026-10-25: one line each, linking where it was made.

## result                      (done, per `pr`)
```

a spec's children are goal prose for their part, plus the shape that's theirs or a link to the parent's. when parallel children meet at a shared interface (one schema, many implementations), whoever splits the issue writes that interface as code and commits it first, so each child starts from it. a hole is its own issue when it's a session on its own or matters to more than one parent. a question is the same file with the question up top and `## answer` when it has one. preserve the distinction between what we chose and what we used to explore the choice.

a later finding or ruling edits the goal, shape or tasks in place and adds a decisions line; it doesn't append a dated section. state the current state; git is the history, `docs/attachments/` the evidence.

the reader is me later, or an agent who has to be me (`writing-skills`): say what to do and why, once. scope is what the goal says and done is the goal holding in its story, so there's nothing to fence: no permissions, prohibitions, when/then, or restated standing rules (testing, verification, the two-minute rule). name things as `concepts/`, paths and test names do, so the first grep lands.

an outsider (every fresh context, and me on an issue I wasn't in) understands an issue by following its links, recursively; that's what the vault is for. so every file mentioned is a real link: vault notes (issues, stories, concepts, attachments, guides) as vault-absolute wikilinks, repository files as relative links from the issue (`[prepare-cases-first.ts](../../packages/web/scripts/prepare-cases-first.ts)`), commits by hash, threads as `@thread:…`, the web by URL. every term is general technical vocabulary, or links on first use to its glossary entry (`concepts/`) or to where it arose in a clear context (the issue, attachment or guide that introduced it, with an anchor if it's deep). local jargon with neither gets plain words instead; a term several issues need and nothing explains earns a `concepts/` entry. restating what a linked script or doc already does is cut, not explained.

an issue is as long as its context differs from what the code and docs already say.

> No: "Acknowledge only persisted submissions; show a submission failure visibly. Reject empty symptoms. Reporting is signed-in only, not an anonymous sign-in-failure endpoint. No automatic conversation/page/screenshot capture. No report list, triage controls, `processed` editor, or GitHub integration. […] Run relevant Application tests, `bun test`, `bun run check` and the Application build. Record any unavailable external-service checks honestly."
> Yes: "a report button in the app shell, signed-in, symptom + optional detail, route and Profile attached. capture only; triage is [[…/capture-learner-and-tutor-friction-reports…]]."

## Global operations

Read contracts and metadata through the backend:

```text
bun "$PI_SKILL_DIR/scripts/issues.ts" text <slug>
bun "$PI_SKILL_DIR/scripts/issues.ts" fields <slug> [--json]
bun "$PI_SKILL_DIR/scripts/issues.ts" create <slug> --fields '<json>' --body-file <path|->
bun "$PI_SKILL_DIR/scripts/issues.ts" update <slug> [--fields '<json>'] [--body-file <path|->]
bun "$PI_SKILL_DIR/scripts/issues.ts" close <slug> [--summary <text>] [--evidence <repo-relative-path>]
bun "$PI_SKILL_DIR/scripts/issues.ts" remove <slug>
```

Fields use logical slugs for `part-of` and issue entries in `blocked-by`; guards stay opaque strings. The backend serializes vault links. Null in an update removes a key. Body input excludes YAML frontmatter and, when supplied (even empty), replaces the whole body; body-only update is allowed. Body paths resolve from the caller's cwd; `-` reads stdin. `text` returns the full contract; `fields` prints JSON with or without `--json`; `create` prints the resulting slug. Mutations succeed with exit 0, otherwise a diagnostic and nonzero exit.

Copyable create/update for an existing `example-parent` (`PI_SKILL_DIR` names this tracker skill; `PI_SESSION_ID` is your session; the supplied `CLAIM_TOKEN` is `reconcile:<root>/<refine-handle>` during refinement):

```sh
printf '%s\n' 'The child'\''s goal and shape.' | bun "$PI_SKILL_DIR/scripts/issues.ts" create example-child --fields "{\"stage\":\"ticket\",\"assignee\":\"agent:auto-routine\",\"author\":\"session:$PI_SESSION_ID\",\"part-of\":\"example-parent\",\"claimed-by\":\"$CLAIM_TOKEN\"}" --body-file -
printf '%s\n' 'The parent'\''s goal and shape, with its tasks.' | bun "$PI_SKILL_DIR/scripts/issues.ts" update example-parent --fields '{"stage":"ticket","priority":null}' --body-file -
```

Writes validate the resulting global tracker before publication and commit only touched canonical issue paths for persistence, never unrelated staged files. The commit runs in a detached persister outside the caller's process group: a write whose command timed out or was killed after the working-tree write still commits, so check `git log` on the issue before retrying. Persistence waits out an index lock a live Git holds and removes one only when it is over 30s old with no live holder, naming it on stderr. This is not permission to commit unrelated canonical files. `remove` is reserved for owned provisional children, not general triage. Archiving still uses the move and `check --fix` procedure above in the canonical vault; there is no archive verb.

## procedure

claim: write `claimed-by` through the tracker before anything else; read the current global contract before updating it.

A ticket's code, shared interface stubs, already-authorized tests and `docs/attachments/` evidence commit on its worker branch. Workers do not integrate or push the canonical checkout. Parent decisions, dependencies, child contracts and new friction go through the tracker immediately, not through the coordinator or a branch issue commit. A defect whose fix is evident and smaller than its issue would be is fixed in place (two-minute rule, [lifecycle](lifecycle.md)); other friction is filed outside the active execution subtree and linked from the report.

resolve: record the answer or satisfy recorded acceptance (including story verification) and actually land the code in its owner's target, then close with the result. Under a reconciler, workers supply their handoffs and leave closing to it after target landing. Collector-landed code remains pending in the landing ledger, visible as derived inflight, not globally done. Closing drops the claim and removes resolved dependent blockers. Leave the result live for review/digestion; move to `archive/` once it has fulfilled its enclosing purpose. a parent whose children are all done goes with them when its destination is met. commit message names the issue.

friction: `stage: idea`, immutable `author: session:<origin>`, the observation raw with its originating story and evidence. Priority follows observed impact; unknown impact stays unknown. Triage before execution.

join the messenger channel named for the parent's slug when your ticket shares an interface or files with a sibling in flight. reserve paths, say when you land. nothing there is reread; anything worth rereading goes in the issue.
