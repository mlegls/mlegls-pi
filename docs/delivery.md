# Delivery

Locate the real situation and want behind a request; preserve its origin. Stories are durable product understanding, not one document per issue. In this repository, existing task docs can supply that context; add small linked stories when a distinct purpose needs one rather than inventing a retrospective catalog.

Story → spec/tickets → implementation → first use (guide + recording) → reviewed replay → acceptance.

Planning settles intended behavior and makes first use possible: starting state, surface, setup and any missing drive machinery. It does not write an assertion inventory. The implementation supplies that setup along with the behavior.

Run existing regressions and project lints, including Jev lints where configured. For first use, operate the actual interface—pi session, terminal, CLI or library as appropriate. Write the task guide just before or during the encounter and record what was done. Review actions, screenshots and state for questions, failures and promises relied on; place checks at those moments in the replay. Later passes reuse the accepted recording and re-drive changed or failing portions. Keep guide and recording synchronized.

Prototype review is interactive feedback, not the implementation verification pipeline. Research is accepted by considering its findings. Incorporate either naturally into the parent; no receipt prose is required. Prototype artifacts may remain useful implementation references after their issues are archived.

The intended tracker lifecycle is idea → goal → spec → ticket → done → archived. Ticket denotes an executable scope, irrespective of size or activity; done means a result is available for review or digestion, archived means it has fulfilled its purpose. Review may be autonomous. Parents derive readiness from their least-refined child: an idea prevents autonomous dispatch at its ancestors, not at ready siblings. Newly discovered uncertainty must be resolved within the scope or deliberately moved outside it. Record author/session provenance separately from current ownership.

The tracker currently uses `next`; the lifecycle fields, rollup and done/archive distinction are not yet implemented. Follow the current tracker adapter until its schema and queries migrate together. Shared skills define delivery behavior now: `plan`, `implement`, `verify-story` and `testing`.
