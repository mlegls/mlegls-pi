---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# Redeem a banked codex reset when delegated work runs out

`lib/allocation.ts` counts banked resets listed by hand in `allocation.json` and tells the maintainer to redeem one, through `osascript`, which does nothing on the Beelink where delegated work runs. The listed resets had expired in October while three real ones sat unused (fixed by hand in 201de3e0); on 2026-11-23 the codex weekly window was projected empty at 17:10Z, two days before its 11-25 reset. The maintainer asked "is it already set up to auto reset when it runs out?" (2026-11-23 efficiency audit, @thread:thr_vrgtjptnu2).

The ChatGPT backend that codex uses already owns this: `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` (`credits[]` with `id`, `status`, `expires_at`, `reset_type: codex_rate_limits`) and `POST /wham/rate-limit-reset-credits/consume` (codex's app-server method `account/rateLimitResetCredit/consume`; `/wham/usage` reports `rate_limit_reset_credits.available_count`). Auth: `~/.codex/auth.json` access token plus `chatgpt-account-id`.

## tasks

1. Read banked resets from that endpoint (or quota-axi, if it exposes them) instead of `allocation.json`'s `resets`; drop the field.
2. When a codex window that bounds delegated work reaches 0% and work is waiting on it, consume the reset that expires first, once per window, and log it; take the consume body from codex's app-server (`codex app-server` or its source).
3. Replace the `osascript` notice with `bb` push notification, so it reaches the maintainer from either host.
4. Done when: a fixture response with two credits drives `gate()` and a consume call with the earliest-expiring id at 0%, and none above it.

## Result

done. All four stories still hold on `5d81d126`. I re-ran the three recipe commands after my repairs and got the driver's results again: a read-only GET at 1%, a GET plus one POST at the first 0% naming the `earlier` credit with a nonempty request ID, and only a GET at the repeated 0%. Each delegated run printed one log line and made one push call. `--interactive 0` went to `zai` with no WHAM requests. `tsc --noEmit` is clean. The project has no `test:affected` task and no tests cover these files, so the recipe replay is the only check.

I made two repairs:
- **`pi/`-prefixed worker routes were going ungated** (`6aedff31`, `lib/worker-execution.ts:44`). The change gated `pi/<provider>/<model>` routes by the outer name `pi`, which `allocation.json` doesn't list, so they always passed. The base gated them by the inner provider, and that's restored. No agent uses such a route today.
- **`docs/dispatch.md:87` described the old mechanism** (`866c5d09`): the `allocation.json` `resets` list and the desktop notice. It now describes reading credits from WHAM, redeeming once per window, and the BB push.

The driver's one friction (Pi prints `openai`, native BB prints `codex`) is just each provider's own name for the same `codex` quota. I accepted it rather than filing it. This change filed no tracker frictions. The tracker files in the diff came from the merge of main.

```yaml
commit: 5d81d126
stories:
  - {story: Read banked credits from WHAM without consuming above zero, outcome: held}
  - {story: Redeem the earliest-expiring credit once per exhausted delegated window, outcome: held}
  - {story: Log redemption and invoke BB push, outcome: held}
  - {story: Fall back without redeeming when interactive work exhausts its window, outcome: held}
evidence:
  path: docs/attachments/redeem-a-banked-codex-reset-when-delegated-work-runs-out/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "6aedff31 workerExecution gates pi/<provider>/<model> routes by the inner provider again (the change passed the outer pi, so they went ungated)"
  - "866c5d09 docs/dispatch.md no longer describes allocation.json resets or the osascript notice"
caveats:
  - "caveat: a codex route below its live share but above 0% now reads WHAM credits on every route check, including interactive user turns: one GET per turn, with a 5 s timeout, where gate() used to be synchronous."
  - "caveat: a retry after an exhaustion error on a codex route forces a fresh quota-axi reading instead of the 60 s cache, which can add up to 30 s."
  - "Once per window holds even on failure: if a consume returns anything other than code=reset, its claim file stays, so that window is never retried with another credit. The failure is pushed to the maintainer instead."
  - "The fixture saw the BB push call; nobody saw it delivered to a device. No live credits were spent, and nothing is left running."
```

Evidence: [docs/attachments/redeem-a-banked-codex-reset-when-delegated-work-runs-out/index.md](../attachments/redeem-a-banked-codex-reset-when-delegated-work-runs-out/index.md)
