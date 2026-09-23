# Orchestration audit — 2026-09-23

Scope: the concept supervision campaign of 2026-09-23 (root Paseo agent `b821a60b` in `~/dev/mmon/concept`, started 02:03Z), read at about 07:15Z. 101 Pi sessions under `~/.pi/agent/sessions` (root, 6 sub-supervisors, ~95 workers), the Paseo agent list, and the concept repo's branches. Costs are Pi's per-message `usage.cost`; subscription models are list-price estimates. Tool calls are classified by regex over exec code, so counts are approximate.

## Spend

| role | sessions | cost |
|---|---|---|
| root (opus 5.5) | 1 | $23.5 |
| sub-supervisors (gpt-6-sol) | 6 | $100.8 |
| implementers, opus `technical` | 22 | $90 |
| implementers, sol/luna | 31 | $32 |
| verifiers luna/sol/opus | 31 | $24 |
| shaping (sol) | 6 | $5 |

Coordination (root + sub-supervisors) is ~49% of ~$252. Supervisor cost is mostly cache reads, not model price: sup-applets read 113M cached tokens at $0.2/M, ~$22.6 of its $27. Opus 5.5 and sol have the same cache-read price, so a model swap alone doesn't cut it; fewer LLM turns over less context does.

## Routing

No session used `compile`. The `supervise` stance landed at 02:50Z (`7e1b88e`) and `compile` at 03:19Z (`53d3fe7`). Sub-supervisors launched 02:32–03:18Z under the old roster; Jev picked `auto` (p 0.73; its choice set had neither stance): gpt-6-sol high, "decompose into tracker children and supervise them". They behaved as design owners: sup-quizzes wrote new child issues, every supervisor read 700–940 KB of code. After `compile` existed nothing picked it; sup-materials routed 15 leaves to `auto`. `supervise` had no operating point in `routing.md` (fixed in `710bee5`/`869e6a7`). Campaign-start prompts said "start with `realize`", a skill that no longer existed; sup-locale launched verifiers under `auto-routine` ("start with `implement`"). About 50 workers were titled `undefined/…`: `dispatch` accepted a missing `run` because `RegExp.test(undefined)` tests the string "undefined" (fixed in `72b58e9`).

## Leaves: implement → verify-story

The shape is right: supervisors dispatch a fresh verifier per leaf, node-locally.

`jev-axi` was used 0 times. `computer.run/step/walk` appears in 9 of 31 verifiers, meaningfully in ~4 (verify-hub-zh 18 calls, verify-real-language 9). The two biggest browser verifications (applet-runtime-verify, playground-materials-first-use) tried `computer.run` once, hit `TypeError: Cannot use 'in' operator to search for 'list_apps'` (no `ui`, and `ui:'browser'`), and fell back to ~200 hand-driven `chrome-devtools-axi` calls each (error message fixed in `2bb8d20`). The `verify` stance's "prefer chrome-devtools-axi when a browser CLI is needed" invites that fallback.

Verifier median is ~90 calls (25–438), not a few log/state/contact-sheet reads. Cheap on luna, but wall-clock.

9/31 verifiers ended blocked, almost all environment: Vite `strictPort` 4401 across worktrees, `401 BadAdminKey` from sibling local deployments, provider key then gemini geo-403, schema drift in a shared deployment, a harness that couldn't reach the precondition.

## Tests

Verifiers wrote encounter-grounded replays: small specs plus docs and screenshots (e.g. a 68-line `closed-document.audit.spec.ts`).

Supervisors commissioned implementer tests in about a dozen assignments, against `implement`'s "no new permanent acceptance tests": "Add focused tests for format attribution, invalid grader, captured-key shape and completion guard", "lightweight use-based tests", "Add focused regression using public operations". Tests are 25–30% of every supervisor branch diff (applets 1854/6998 lines, quizzes 1978/6800, materials 1277/4824). Titles are behavioral and in domain language, not enterprise larp in style, but decomposition-derived in origin: "invalid Problems are rejected", "sequence and seeded shuffle walk the supplied Problems once".

## Localization

The root received 420 messages: 5 terminal reports, 34 "Acknowledged…", averaging 470 chars. It sent 137 down and produced 317 narrations (~65/hour, ~850 chars each) while the human was away, at the level of "stale valid Documents re-attest at v3 from the owner's fenced source without an upload grant". Under Paseo every `send` wakes the recipient; the board's non-waking progress tags (still described in `agents/_common.md`) were lost in the migration.

Supervisors did review-type work: 700–940 KB of file reads each; sup-quizzes made 303 reads and 266 `git show/diff` calls, mostly of sibling branches' applet runtime and Playground interface; 21–57 test/check runs each. The root inspected an upstream package itself and approved UI copy. Materials had ~5 verifier rounds over overlapping journeys plus a queued "fresh audit" inside a hacking campaign.

## Escalation

To the human: 4 early questions (drop numpy/sympy, provider key, model defaults twice), all answered within ~20 minutes. 5 pending after 03:27: Clerk cleanup, whether a shaping session is still running on main, the callable-program port, durable `query` receipts, the upstream Base UI issue. Sub-supervisors → root: ~55 question-shaped messages, nearly all settled by the root under delegated authority.

A concurrent shaping run on main (six `shape-specs` workers ~04:40Z) reshaped tickets under five live campaigns; each reconciled on rebase.

## Outcome

Independent campaigns worked: Python finished in 1.1h, verified, scc delta 0; convex landed ~15 small slices on main. Fresh verifiers found real defects: recovered tutor text dated at the Unix epoch, a resumed-reply bug (`b515ede6`), a 5-minute stream-deletion limit, a geo-blocked default model, Base UI's hardcoded `aria-label`, the Send gap after the legacy Quiz drawer went.

Coupled campaigns did not: applets, quizzes and locale depend on materials' Playground interface; applets was based on an early slice, quizzes blocked on it, the root relayed cherry-picks. After 4.5h none of those four branches was on main. The tree split by ticket lineage rather than code seams. ~5–7 issues reached done per branch.

## Paseo parentage

Checked in the desktop bundle's `@getpaseo/server`. `parent` is the `paseo.parent-agent-id` label: UI tree, archive cascade and ownership checks. Waking the parent (`notifyOnFinish`) applies only to agents created through Paseo's MCP `create_agent` tool; SDK-created children never wake it. The campaign's wakes all came from `send` and resolved exec handles.
