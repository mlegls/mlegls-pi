# Delivery

Locate the real situation and want behind a request; preserve its origin. Stories are durable product understanding, not one document per issue. In this repository, existing task docs can supply that context; add small linked stories when a distinct purpose needs one rather than inventing a retrospective catalog.

Story → spec/tickets → implementation → first use (guide + recording) → reviewed replay → acceptance.

Planning settles intended behavior and makes first use possible: starting state, surface, setup and any missing drive machinery. It does not write an assertion inventory. The implementation supplies that setup along with the behavior.

Run existing regressions and project lints, including Jev lints where configured. For first use, operate the actual interface—pi session, terminal, CLI or library as appropriate. Write the task guide just before or during the encounter and record what was done. Review actions, screenshots and state for questions, failures and promises relied on; place checks at those moments in the replay. Later passes reuse the accepted recording and re-drive changed or failing portions. Keep guide and recording synchronized.

Prototype review is interactive feedback, not the implementation verification pipeline. Research is accepted by considering its findings. Incorporate either naturally into the parent; no receipt prose is required. Prototype artifacts may remain useful implementation references after their issues are archived.

The [agreed tracker lifecycle](../skills/enabled/all/mlegls/conventions/tracker/references/lifecycle.md) defines readiness rollup, closed execution scopes, optional stage transitions, result digestion, author provenance, assignment eligibility and live claims. New discoveries during execution start separate idea trees.

The tracker currently uses `next`; follow the current adapter until schema, queries and views migrate together. The lifecycle reference records the replacement and remaining migration decisions. Shared skills define delivery behavior now: `plan`, `implement`, `verify-story` and `testing`.

## Decision authority

The maintainer’s interface into the codebase is its program theory: stories, concepts, promises and experienced UX. Assume deep understanding of that interface, not implementation internals. Human involvement follows comparative competence, currently especially macro organization, program theory, intended stories and UX feedback; this boundary can change with agent capabilities. Difficulty or unsettled architecture alone is not a reason to ask the maintainer.

Agents investigate and choose implementations within the established promises. If opaque implementation constraints make a promise unviable or reveal conflicting promises, teach the concrete constraint at the theory surface, then seek a decision about those promises. Preserve the opportunity for the maintainer to find a solution that keeps them.

Distinguish uncertainty from subjectivity. Where an agreed measurable criterion determines the choice, experiments and the criterion decide. Where a choice must be made under incomplete criteria, a frontier-model oracle panel can supply a provisional judgment: seek independent views, resolve disagreements around their crux, and involve the maintainer for relevant intent, tradeoffs or mediation. Consensus does not verify empirical claims. This is a consultation pattern, not an implemented oracle tool.

Clarifying desiderata and their relative importance can be a separate issue where the maintainer contributes. Operationalizing them can later make the choice measurable; resulting evidence may overturn the provisional decision. Record the choice, rationale, uncertainty and revisit condition. Do not hold the original execution scope open indefinitely for perfect criteria. A metric has only its agreed authority: failure to represent the intended promise calls for revising the operationalization.
