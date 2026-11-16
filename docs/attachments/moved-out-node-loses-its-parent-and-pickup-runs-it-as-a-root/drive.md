# Independent drive

Revision: d738d81a45b36409dac3436c0232dc6b5461cc7b. CLI journey; no rendered UI.

## Predictions before opening

1. Resolving the seeded child exception with move-out will change ownership to human while keeping its parent root and releasing its claim. Tracker validation will accept the parked tree.
2. Returning the goal to an agent will keep it parked until it is ready. Promoting it to ticket will resume child implementation in the existing root collector, without starting a separate root reconciler.

Setup required: fresh isolated local Git/vault sandbox, fake bb, persona thr_owner, no credentials or model calls. Entrypoint is the committed setup.ts. I will use only its printed sandbox paths and public resolve/tracker/status commands.

## Encounter

Setup printed owned checkout /tmp/rc-protocol-M4lExn/repo, persona thr_owner and fake bb authentication. Status confirmed running root, owner thr_owner, local target equal to that checkout, held child implementation into root, and owner exception “needs shaping”. No inherited deployment was used.

- Sent the documented resolve move-out command. The command returned before the tracker mutation became visible: an immediate fields/check still saw the old agent goal and lifecycle diagnostic. A subsequent status showed resolved child: move-out; fields then showed human, goal, part-of root, no claimed-by, and check returned ok. Prediction 1 met after resolution applied.
- Updated assignee to agent:shell. Status remained running with finished null, empty chains and moved.child “Authentication shaping”. Prediction 2's not-ready expectation met.
- Updated stage to ticket. Status logged moved back in: child, then launched child-implement-1 (implement, shell). The child chain had held false, worker child-implement-1, into root; moved was empty. The single status record still named root. Fields retained part-of root. Prediction 2 met: the original run resumed implementation, with no separate root observed.
- Created the printed stop file and waited for setup to exit successfully. Sandbox cleanup completed; no real bb thread, model call or server was started.

## Replayable checks

Use setup and the command sequence in [index.md](index.md). Before resolving, status must identify the printed checkout as local target and the held child exception. After resolve, wait until status records resolved child: move-out; then fields must retain part-of root, show human and omit claimed-by; check must return ok. After assigning agent:shell while stage is goal, status must retain moved.child and launch no child chain. After promotion to ticket, status must clear moved.child and show child-implement-1 with into root on the same root record.

## Friction and limits

One immediate read after resolve saw stale state; the CLI's silent return did not signal that application was pending. Waiting for the status log resolved this observation. No enduring failure established. No product repairs or tests were made. The fake bb surface establishes dispatch routing, not real agent execution or completion. Detached legacy-node pickup suppression was not independently driven; the required newly moved-out parent-preserving journey held.

