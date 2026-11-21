---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
part-of: "[[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]]"
---
The supervision and reconcile tools are bb native tools, so they reach a thread whatever its provider. Shape: [[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]].

A `supervision` plugin in `~/dev/bb-plugins` registers `dispatch`, `integrate`, `retire`, `reconcile`, `reconcile_stop`, `reconcile_status`, `reconcile_resolve`, `reconcile_constrain`, `pickup`, `pickup_status`, `pickup_stop` with the same parameters and descriptions as [extensions/supervision](../../extensions/supervision/index.ts). Each `execute` runs a `bun` entry point in this repository with the calling thread's id (from the tool context, replacing `BB_thr_4vfx7djduu_ID` from the environment) and returns its JSON; add an entry point beside [main.ts](../../lib/reconcile/main.ts)'s `import.meta.main` where one is missing. Find this checkout and `bun` as the tracker plugin's settings do ([server.ts](../../../bb-plugins/tracker/server.ts)). `extensions/supervision` is deleted in the same change, so pi sessions get the bb tools instead (check they reach codemode's `tools`).

Done when: from a pi thread and from a codex or claude-code thread, `dispatch` starts a worker, `bb thread` shows it as the caller's child, and `integrate` lands it; `reconcile_status` answers from both.

## Result

done — Rebased onto `c041c416`, kept the Pi extension deleted, and preserved the owner-only `post-landing` verdict in the native tool. `mise run test`: 291 passed, 2 skipped, 0 failed. The companion plugin typecheck passed. Shared BB was untouched.

```yaml
commit:
  - be4ac179
  - checkout: /home/mlegls/dev/bb-plugins
    commit: 92feb0c
stories:
  - story: "Pi codemode: status, dispatch, child linkage, and integration"
    outcome: held
  - story: "Codex native: status, dispatch, child linkage, and integration"
    outcome: held
evidence:
  path: docs/attachments/supervision-tools-as-bb-native-tools/index.md
  visual: false
  shots: []
tests:
  - lib/dispatch.test.ts
  - lib/reconcile/campaigns.test.ts
  - lib/reconcile/pickup.test.ts
fixed:
  - The replay builds from a disposable copy of the companion plugin.
  - Native reconcile_resolve preserves the post-landing check, outcome, and evidence. The Bun entry point rejected a non-owner and queued the owner's verdict with the correct caller ID.
filed:
  - "[BB path-installed plugin enablement](docs/issues/bb-plugin-build-may-reenable-path-installed-plugin.md)"
caveats:
  - Land companion commit 92feb0c in canonical bb-plugins and enable it only after the installed Pi checkout drops extensions/supervision.
```

Evidence: [docs/attachments/supervision-tools-as-bb-native-tools/index.md](../attachments/supervision-tools-as-bb-native-tools/index.md)
