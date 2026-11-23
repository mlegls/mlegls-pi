# First-use drive

## Predictions before running

- Registered Pi stance and native BB launch: at 1% with two available credits, keep Codex and send no consume request. At the first 0% with delegated demand, send one consume request for the earlier expiry with a nonempty request ID, and keep Codex usable. At the repeated 0% in the same window, send no second consume request.
- On redemption, see one allocation log and one BB push invocation.
- Interactive use at 0% falls back without consuming or sending a push.

## Encounter at `2a9ba3f8`

`mise run setup` completed with no dependency changes. All three [recipe commands](index.md) printed the expected readiness line (scratch auth, quota, WHAM and BB; external requests disabled) and exited 0.

| Expectation | Action and observation | Result |
| --- | --- | --- |
| Read banked credits and spend none above zero | Run the default recipe and repeat with `--native`. At 1% the request list contained only a GET to the WHAM credits endpoint. Routing stayed on `openai` in Pi and `codex` in native BB. | Met on both |
| At zero with delegated demand, redeem the earliest credit | At the first 0% each route stayed the same and the request list showed one GET and one POST to `/backend-api/wham/rate-limit-reset-credits/consume`. Both bodies named `credit_id: earlier` and had a nonempty `redeem_request_id`. | Met on both |
| Don't redeem again in that window | At the second 0% each route stayed the same; each request list had a GET and no POST. | Met on both |
| Log and push once | Each delegated run printed one `allocation: Redeemed a banked Codex reset` line and one `push-notifications send` invocation naming the earlier credit and the weekly window. | Met at the BB command boundary |
| Interactive exhaustion doesn't spend delegated credits | Run with `--interactive 0`. It selected `zai` with an empty request list and no allocation log or push. | Met |

## Replay checks

- Run the default recipe and `--native` in separate invocations. Compare the request lists in order: GET only, GET plus one POST naming `earlier` and a nonempty request ID, GET only. Check the route is stable over all three readings and count a single log and a single BB push invocation per run.
- Run `--interactive 0`; accept fallback `zai`, zero WHAM requests and zero pushes.

No blocking friction. Pi labels its route `openai`, whereas native BB labels it `codex`; compare routes within each run. The supplied fixture observes the BB invocation, not delivery to a device. No live credits were spent and no services were left running.
