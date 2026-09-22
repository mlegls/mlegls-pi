---
stage: goal
assignee: human
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

three subscription pools (codex, anthropic, maybe grok) plus metered. constraint: anthropic worker share ≤50% so fable's interactive quota is never crowded; drain codex (and grok) to their weekly ceilings with worker traffic; metered deepseek and jev as overflow. the router takes pool slack as input: a role×model preference table filtered by slack at spawn, not a static roster.

research first: how pi or the providers expose rate-limit state (response headers, usage endpoints), and whether pi already tracks it.

then the table, from the current read of the models: fable 5.1 coordinator; astra hard problems as a control loop with hard metrics in its feedback (it is malleable to the user only, so close the loop with numbers); deepseek/grok hard implementer; luna easy implementer; grok for deletion, prune, simplify, and tests; deepseek for stance-prompted roles (research, review with a lens); sonnet/opus only for reasoning-heavy LLM-facing work and only while the anthropic pool has slack. rows for refactor, computer use, visual taste, test writing stay open until "[[projects/mlegls-pi/issues/orchestration-audits]]" fills them.

## answer

### pi capture (pi 0.85.1, dist inspected)
- core parses no rate-limit headers and calls no usage endpoint. grep `x-ratelimit|anthropic-ratelimit|x-codex|wham|five_hour|seven_day|api/oauth/usage` = 0 hits in dist; `retry-after`/`ratelimit` hits are HF llama ext, generic HTTP, error-retry only.
- only seam is extension event `after_provider_response` = `{status:number, headers:Record<string,string>}` (`core/extensions/types.d.ts:533`, emitted in `core/sdk.js` provider `onResponse`). headers present on every inference call, keys lowercased (fetch `Headers`); nothing persists them.
- local accounting: per-assistant `usage:{input,output,cacheRead,cacheWrite,cost}` in `~/.pi/agent/sessions/<slug>/<ts>_<id>.jsonl`, aggregated by `core/usage-totals.js#getUsageCostBreakdown` keyed `provider/model`. subscription models' `cost` is nominal (from models.json; luna pinned). no window/reset info.
- `~/.pi/agent/models.json`: `providers.<p>.modelOverrides[<modelId>]` carries `billing:"subscription"|"metered"` and `pool`. pi core never reads those keys (`core/model-config.js#ModelOverrideSchema` lacks them) so the router must parse the raw file. JSONC (comments; strip like pi). unlisted provider = metered by convention. current: codex={spark,5.5,luna,sol,terra,astra}, anthropic=all 14, xai={4.3,4.5,4.6}, deepseek=metered.

### codex pool (fresh source of truth)
- `GET https://chatgpt.com/backend-api/wham/usage`; headers `authorization: Bearer <access>` + `chatgpt-account-id: <accountId>` (both in `~/.pi/agent/auth.json` openai-codex). JSON: `plan_type`; `rate_limit.primary_window.{used_percent,limit_window_seconds,reset_at}`; `rate_limit.secondary_window.*`; `credits.{has_credits,unlimited,balance}`; `rate_limit_reached_type`.
- legacy in-band headers (still parsed by codex-rs as fallback): `x-codex-primary-{used-percent,window-minutes,reset-at}`, `x-codex-secondary-*`, `x-codex-credits-{has-credits,unlimited,balance}`, `x-codex-promo-message`, `x-codex-limit-name`; no longer emitted on the /responses WS handshake/stream, do not rely.
- pi: codex baseUrl already `https://chatgpt.com/backend-api`; headers reach `after_provider_response`; not parsed/persisted.

### anthropic pool
- in-band, every Messages response: `anthropic-ratelimit-unified-5h-utilization`, `-5h-status`, `-5h-remaining`, `-5h-reset` + `anthropic-ratelimit-unified-7d-*` counterparts (+ unified status/reset). free, no extra call; reaches `after_provider_response`; pi does not parse. (metered API-key `anthropic-ratelimit-requests-*`/`-tokens-*` are separate, not subscription slack.)
- out-of-band (what claude.ai / `/usage` shows): `GET https://api.anthropic.com/api/oauth/usage`, `authorization: Bearer sk-ant-oat...`, `anthropic-beta: oauth-2025-04-20`, needs `user:profile` scope. body: `five_hour.{utilization,resets_at}`, `seven_day.*`, `extra_usage.*`, `limits[]` (`kind: session|weekly_all|weekly_scoped`, scoped keyed `scope.model.display_name` e.g. "Fable", each `percent`/`is_active`/`resets_at`). undocumented; cache ≥60s.
- plan-limit caveat: pi anthropic OAuth draws plan limits only because `@gotgenes/pi-anthropic-auth` injects the Claude Code billing header/system prompt; unshaped third-party OAuth is billed as `extra_usage`. auth.json anthropic is `sk-ant-oat01` (Claude Code OAuth) so `/api/oauth/usage` is usable.

### xai pool
- API-key surface (metered credits, not weekly): `GET https://api.x.ai/v1/api-key` → `remaining_balance`,`spent_balance`,`total_granted`,`allowed_models`; `GET /v1/models` → `x-ratelimit-{limit,remaining,reset}-requests` + `-tokens`.
- OAuth/SuperGrok weekly pool (grok.com /usage): no documented endpoint. community probes `GET https://cli-chat-proxy.grok.com/v1/billing` and `?format=credits` (`authorization: Bearer`, `x-grok-client-version`, `x-grok-client-surface: grok-build`; monthly allowance + rolling weekly %), or `POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` (gRPC-web empty frame; returns `percentUsed`,`resetAt`). pi's xai = accounts.x.ai OAuth JWT against `api.x.ai/v1` (openai-responses); which surface answers for that token is unverified.
- fallback: not exposed = estimate from local token accounting (no reset = report tokens, not %).

### recommended lib/pool.ts interface (no implementation)
```ts
export type PoolId = "codex" | "anthropic" | "xai" | "metered";
export interface PoolSlack {
  pool: PoolId;
  source: "header" | "endpoint" | "local";
  usedPercent?: number;     // 0..100, provider-native when known
  windowSeconds?: number;   // provider window (5h/7d/weekly)
  resetsAt?: number;        // epoch ms
  remaining?: number;       // credits/balance where the surface reports $
  observedAt: number;       // epoch ms
  stale: boolean;
}
export interface PoolContext { access?: string; accountId?: string; baseUrl?: string; now: number; statePath?: string; }
export interface PoolReader { id: PoolId; read(ctx: PoolContext): Promise<PoolSlack | null>; }

export function loadModelPools(modelsJsonPath?: string): Promise<Map<string, { billing: "subscription" | "metered"; pool?: PoolId }>>;
export function captureProviderHeaders(evt: { status: number; headers: Record<string, string> }): void; // pi ext hook; parse + merge, throttle
export async function readPool(pool: PoolId, ctx: PoolContext): Promise<PoolSlack | null>;  // header cache -> endpoint poll (>=60s) -> local
export async function localUsage(pool: PoolId, since: number): Promise<{ tokens: number; cost: number }>; // session JSONL
```
- precedence per pool: in-band headers (free, fresh) -> usage endpoint (`/wham/usage`, `/api/oauth/usage`) on cold/stale -> local token accounting only when no provider figure exists.
- persist header snapshots to one `statePath` (XDG data dir), timestamped per pool; `stale` when older than the window or a poll throttle (codex 60s).
- router consumes `PoolSlack.usedPercent`: filter rows to `metered` always, `codex`/`xai` while `usedPercent < 100`, `anthropic` while `usedPercent < 50`.
- subscription slack is not derivable from local tokens alone (window/reset unknown) so local is last resort, tokens not %.

### sources
- codex: headroom `subscription/codex_rate_limits.py` + commit `8c00f71` (headers -> `/wham/usage`); Soju06/codex-lb `usage-refresh-policy/context.md`.
- anthropic: claude-code issues #41185 (`-unified-5h/7d-utilization`), #55333 (unified 5h status/remaining/reset); FullFran/claudeops-tui `oauth-usage-endpoint.md`; oh-my-claudecode #3576 + jonny/claude-code `services/api/usage.ts` (`limits[]`, `extra_usage`); openusage `providers/claude.md`.
- xai: openusage `providers/xai.md` (`/api-key`, `x-ratelimit-*`); quotas `providers/grok.rs` (`cli-chat-proxy/v1/billing`); OmniRoute `grokCliQuotaFetcher.ts` (gRPC-web); Hermes agent xai-oauth guide.

decisions:
- 2026-09-18: featherless is a pool too: per-model \`concurrency_cost\` against a plan-wide concurrency limit (two DeepSeek-V4.1-Flash workers at cost 4 each hit \`concurrency_limit_exceeded\`). the slack reader needs a concurrency dimension, not only a token window.
- 2026-09-18: operon's records have no pool dimension and no CPM (see [[projects/mlegls-pi/issues/archive/operon-adapter]]); the pool view is computed here and rendered into the vault, not stored in operon.

decisions:
- 2026-09-20: belongs to the [[routing]] project note (model × role table, pool slack, keymap); stays filed here because that's where lib/pool.ts and lib/route.ts land. the grill that remains is the table, in that note.

2026-09-22 state: lib/pool.ts currently exposes caller-supplied usage and effectiveCost; it is not the proposed provider-telemetry reader. lib/route.ts already owns catalog/stance selection, explicit assignee constraints and unavailable-provider admission. Reconcile the remaining quota policy and role choices against [[routing]] before implementing telemetry; do not replace the current router with the historical table above.
