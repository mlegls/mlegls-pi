---
stage: "ticket"
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
