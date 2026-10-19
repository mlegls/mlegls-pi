docs/attachments/condense-reflections-to-their-render-share/index.md (32 lines)
# Reflection render share — implementation first use

Base: `0320f59694747bbfe71681ed019767cead0a03ea`. This packet accompanies the implementation commit; independent driver/reviewer acceptance follows it.

## Prepared setup

Required product environment: a Pi session using OM, with the active session model's context window available; real memory workers use that session's configured model/authentication.

Prepared target: checkout-owned, offline library fixture in [first-use.ts](first-use.ts). It creates a fresh temporary records database, seeds 122 reflections and 140 observations, calls the real consolidation pipeline and compaction renderer, then deletes its database. Worker responses are scripted, not live model inference. No persona, credentials, deployment, or live-session writes. A 1M-window scripted worker is intentional: its window must not replace the session's window.

Runnable entry point from a checkout with the project's dependencies installed:

```sh
bun docs/attachments/condense-reflections-to-their-render-share/first-use.ts
```

Observed ready: this command completed successfully. Pass `1000000` as the positional argument for the large-window comparison. Reload/restart Pi to use modified extension code in a real session.

## Observations

- **200k session:** summary budget 25,000; reflection maximum 12,500; target 9,375. The 20,203-token pool triggers the condenser after the reflector runs. A scripted merge reduces 122 reflections to 3 (59 rendered-line tokens). The final compaction summary retains the original role and constraint reflections.
- **Backstop before condensation:** 47 reflections are omitted. Both old role and constraint reflections survive; newest ordinary reflections survive while the oldest ordinary reflection does not. Records remain in their original order and the complete projection remains in compaction details.
- **1M session:** summary budget 125,000; maximum 62,500; target 46,875. The same pool fits; only the reflector runs and no reflections are omitted.
- Explicit max-only, target-only, and combined overrides are printed by the entry point. Resolution occurs at use time so changing the session model also changes the defaults. Explicit values win independently.

`bun test extensions/context/om`: 4 passed, 0 failed. `bunx tsc --noEmit`: passed. No permanent tests added by the implementer; the ticket-authorized acceptance properties remain for review.

## Jev decision

Used the ticket's permitted fallback: preservation-floor matching, then newest-first, without any Jev call. The live [API reference](https://docs.typesafe.ai/api.md) requires a separate API key. This repository's `lib/decide.ts` likewise requires a credentialed Jev classifier (TypeSafe, OpenRouter, or Cloudflare); working compaction/memory-worker authentication does not imply any of those credentials. The renderer is synchronous (`lib/records/render.ts`). Compaction therefore must not depend on classifier authentication, SDK initialization, or an added network round trip. No inference latency is claimed or measured.

The preservation recognizer is deliberately conservative lexical matching of roles/identity, preferences/permissions, rules/constraints, blockers/waiting decisions, and architectural decisions/rationale, mirroring the condenser prompt. It is not a semantic classifier. As with any hard budget, protected records too large to fit can still be omitted; ordinary records are considered only after the protected set.
## Independent drive

See [first-use predictions, observations and replayable checks](drive.md). Both small- and large-window entry points completed successfully on `c1bced1e4e28a57d7e57d4c4cd45154e24792cb9`; offline library evidence, no rendered UI. Role/constraint preservation held; broader preservation wording remains for reviewer coverage.
