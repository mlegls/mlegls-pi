# Landing a reconciled tree through a pull request

Use an owned GitHub repository with ordinary `gh` authentication, push access, a fetched default branch and working checks. The reconciler uses that repository's existing GitHub identity. GitHub requires a **different authorized person** to submit approval/changes-requested reviews; it prevents self-review. The merger acts outside the reconciler, using the repository’s ordinary authorization.

## Choose before starting

Commit `.pi/reconcile.json`:

```json
{"land":"pr-review"}
```

The choices are `local` (default when absent), `pr-merge` and `pr-review`. The reconcile tool accepts `land`; CLI equivalent:

```sh
bun lib/reconcile/main.ts start ROOT --owner mail/OWNER --budget 1 --land pr-merge --cwd /absolute/owner-checkout
bun lib/reconcile/main.ts status --cwd /absolute/owner-checkout
```

The captured mode survives restart. Starting without `--land` resumes the saved mode, not a subsequently changed project setting; explicitly requesting a different mode is refused. Restart via the same `start` command after a missing process. Do not use `stop` to simulate a crash: explicit stop retires resources and marks the run stopped.

## What waiting means

The tree's children land in collectors, then one root branch lands in run-owned PR staging. This can unlock the next sibling, **not** a dependent outside the tree. Global issues and their original reviewed evidence remain pending until the remote target really receives the code. Status includes `land`, `pr.url`, PR number/branch, repair/review receipts and exceptions. Workers are retired during an idle PR wait; the reconciler polls about once a minute.

Failing reported checks request a bounded repair. Base advancements and other people's branch pushes are merged into existing history, gated and normally pushed—never rebased or force-pushed. Live first use exposed GitHub's stale `baseRefOid`: the transport now observes the current base branch target before comparing fetched Git.

- **pr-merge:** after every reported check passes (no reported checks means immediate eligibility), the reconciler requests a head-guarded **merge commit**. Merge can run deployment workflows. Choosing this mode authorizes that consequence.
- **pr-review:** the reconciler never merges. A submitted review with unresolved inline threads can request a repair; individual ordinary PR comments do not. Repairs push gated changes and reply on every requested thread. Marker-only replies are not new human review requests. A later changes-requested submission after repair is an owner exception, not another automatic repair.

## Owner exceptions and completion

Inspect status before resolving. Closed-unmerged PRs are owner exceptions; issues stay open. Reopening and answering through the public resolution surface continues the same saved PR:

```sh
bun lib/reconcile/main.ts resolve ROOT ROOT '{"action":"answer","note":"Owner acknowledges; await human merge"}' --cwd /absolute/owner-checkout
```

A transient GitHub transport error (HTTP 5xx or a brief 404 on a just-pushed commit) also raises `PR observation/publication failed`; it never reads as passing or absent checks. Acknowledge it with the same `answer` resolution, with a note naming the transport error rather than a review state, and the reconciler re-observes the same saved PR (number, branch, repair and results unchanged).

For a repair needing another attempt use `retry` only after inspecting its saved request/budget; this is not permission to reset the tree or overwrite reviewed results. An acknowledged unresolved submitted review may still hold again; an exception does not prevent observing a subsequent human merge.

Only observed `MERGED` metadata plus fetched Git ancestry closes carried nodes, child-first, with their original result packets. The owner checkout is a best-effort mirror: fetch/fast-forward only if clean and on the captured base branch. Dirty, other-branch or divergent owners are left alone; they do not prevent remote-target completion.

## Rehearsal and evidence

[Combined join evidence](../attachments/land-reconciled-trees-through-pull-requests/index.md) and [owned live rehearsal](../attachments/rehearse-reconciled-github-pr-landings/index.md):

```sh
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-merge
bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-review
```

These commands mutate **only the explicitly supplied disposable scratch repo**, with isolated local tracker/board/registry state and deterministic shell workers. They are not a production-project launcher. The first command was driven through real Actions repair, merge, target closure and owner ff. The second pauses after live COMMENTED repair; resume it and merge from a separate operator shell to complete. In this 2026-10-14 scratch rehearsal the maintainer authorized same-account external merge and accepted approval/changes-requested policy on explicitly seeded evidence. Live target closure and zero reconciler merge requests were observed.
