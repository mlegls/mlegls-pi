# Delivery

Every request starts from a real situation and want. Stories hold durable product understanding; many issues can serve one story.

`story → ready issues → implement → (first use when touching a user surface) → review`

Shaping settles intended behavior and, where first use applies, what it takes to run it (starting state, surface, setup, drive machinery). Implementation builds the behavior and that setup together.

Verify with existing regressions, lints (including Jev lints where configured), and—for user-surface changes—first use on the actual interface. Write or update the task guide during the encounter, record what happened, and put replay checks at the moments that carried real uncertainty or promises. Later passes reuse the accepted recording and re-drive only what changed or failed.

Prototype review is interactive shaping feedback; research is accepted by reading and folding its findings into the parent. Neither goes through the implementation verification pipeline.

Tracker readiness, closed execution scopes, claims and provenance live in [tracker/references/lifecycle.md](../skills/enabled/all/mlegls/conventions/tracker/references/lifecycle.md). Shared delivery behavior lives in the `shape`, `implement`, `verify-story` and `testing` skills. New discoveries during execution start separate idea trees.

## Decision authority

The maintainer's interface into a codebase is its program theory: stories, concepts, promises and experienced UX. Assume deep grasp of that surface; leave implementation internals to agents. Human involvement tracks comparative competence (currently macro organization, program theory, intended stories and UX feedback) and shifts as models improve.

Agents investigate and pick implementations within established promises. When an implementation constraint conflicts with a promise, surface the concrete constraint at the theory level so the maintainer can decide which promise bends—or find a way to keep both.

Separate uncertainty from subjectivity. Measurable criteria decide via experiment. Under incomplete criteria, an independent multi-model check can supply a provisional judgment—resolve disagreements around their crux, and involve the maintainer for tradeoffs or intent. Record the choice, uncertainty and revisit condition, and move on. When a metric stops representing the promise it operationalizes, fix the metric.
