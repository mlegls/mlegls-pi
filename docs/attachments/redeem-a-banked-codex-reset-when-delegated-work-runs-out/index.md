# Drive a banked Codex reset

From the candidate checkout with `mise run setup` complete (Bun and the project dependencies installed):

```sh
bun docs/attachments/redeem-a-banked-codex-reset-when-delegated-work-runs-out/route.ts
bun docs/attachments/redeem-a-banked-codex-reset-when-delegated-work-runs-out/route.ts --native
bun docs/attachments/redeem-a-banked-codex-reset-when-delegated-work-runs-out/route.ts --interactive 0
```

The first command drives the registered Pi stance; `--native` selects at the BB worker launch boundary instead. Each run starts with its own scratch `CODEX_HOME`, `XDG_STATE_HOME`, quota-axi and `BB_CLI` stub. The scratch account has two available credits, listed in later-expiry-first order. WHAM requests stay inside the process, BB pushes go to the scratch log, and there are no live credentials, servers, or persistent fixture state. `ready: fixture Codex auth, quota-axi, WHAM and BB; external requests disabled` confirms the substitutes are in place.

The default readings are `1 0 0` for the same weekly window. At 1% the router reads banked credits and uses the route without consuming one. On the first 0%, the request should name `credit_id: "earlier"` and a nonempty `redeem_request_id`. The second 0% replays the pre-reset snapshot: the route should still be usable with no second POST. Look for one allocation log and one `bb push-notifications send` call. The interactive invocation should route to the fallback at 0% without a reset attempt or push.

The request keys come from [Codex's backend client](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/backend-client/src/client/rate_limit_resets.rs), called by `account/rateLimitResetCredit/consume`.
