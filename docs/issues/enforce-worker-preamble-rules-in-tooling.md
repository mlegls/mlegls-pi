---
stage: "ticket"
assignee: "agent"
author: "session:thr_pgvjgcnn5h"
---
`agents/_common.md` still carries rules a tool could refuse at the point of use, with the instruction in the refusal, as `extensions/guard` already does for pkill/killall and git hook bypasses. Each rule below moves into tooling and its sentence leaves the preamble.

## tasks

- Missing status: the repair for a turn that ends without a status lives only in the reconciler (`lib/reconcile/reconcile.ts`, `repair(slug, c, "status", …)`), so a plain `dispatch` worker surfaces as `idle` to its parent. Send the same follow-up from the guard's `agent_end`, beside the foreign-commit repair, and drop the reconciler's copy if the guard's covers it.
- `docs/issues/` in a worker: the sparse checkout removes the directory. Refuse a worker's `read`, `grep` or shell access to that path with the `issues.ts text <slug>` line.
- `claimed-by` and closing the launched issue: export the launched issue to the worker (`PI_WM_ISSUE` in `spawnEnv`) and have `issues.ts` refuse a worker's `claimed-by` write or `close` on it, saying the reconciler closes it after target landing. Refiners write the supplied provisional claim on children; that stays allowed.
- Merging or pushing the canonical checkout: refuse a worker's `git push` of the target branch and `git merge`/`ab task finish` run in the canonical checkout.
- Browser guidance: the `mcp__chrome__*`/`mcp__cua__*` paragraph applies only when those servers are configured. Emit it from `extensions/system-prompt`'s tool catalog when the namespace is present, for workers and interactive sessions alike.
- The pkill/killall pattern matches inside quoted text: a `git commit -m` whose message contains the word followed by a space is refused. Match command position only, as `hookBypass` does per segment.

Done when: a worker that trips each rule gets a refusal or follow-up that states the alternative; `agents/_common.md` no longer states the `claimed-by`, close, merge, `docs/issues/` or browser-tool rules; `agents/roles/implement.md`, `drive.md` and `review.md` no longer repeat the close and merge rules.
