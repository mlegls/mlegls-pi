# Implementation first use

Tested implementation: 3ecce201.

The exact historical handoff closes using the child's named loaded checkout. A
foreign commit not reachable from the loaded HEAD continues to hold. Supplying
a checkout with a resolution reruns that check without launching a new worker.

## Setup

Local library/CLI surface; no server, browser, account or secrets. Run from the
implementation checkout with its existing Bun dependencies. Real repositories
were read-only: mlegls-pi contains local commit
3aeaaff5ad0281106446be681feee070435b76ef; /home/mlegls/dev/bb-plugins HEAD
5c89fe1 contains foreign commit 602606f5648bb68d981d0e205daaf1bef8cf4283.

Tracker writes and recovery merges used disposable repositories made by
[protocolFixture](../../../lib/reconcile/protocol-fixture.ts). Each was removed
afterward. No live reconciler state or global ticket was edited.

## Report surface

Runnable entry point from the checkout:

~~~sh
bun --eval 'import {parse} from "./lib/report.ts"; console.log(parse("done\n\n" + "\u0060\u0060\u0060yaml\ncommit: [3aeaaff5, 602606f]\n\u0060\u0060\u0060", process.cwd()).handoffError)'
~~~

Observed: bare foreign 602606f is refused, with the required
commit: { checkout: /absolute/loaded/checkout, commits: […] } shape.
The same report using /home/mlegls/dev/bb-plugins and commits: [602606f]
has no handoff error.

The guard's registered agent_end callback was invoked with the bare report
and worker environment enabled. It queued one followUp correction; invoking
it again without a new input queued nothing. This exercised the extension
callback through a fake ExtensionAPI, without a provider conversation.

## Historical completion replay

This replays the historical commit list against the real repositories and
closes only a disposable tracker issue:

~~~sh
bun --eval '
import { protocolFixture } from "./lib/reconcile/protocol-fixture.ts";
import { closeAtTarget, reviewedResult } from "./lib/reconcile/completion.ts";
const cwd = process.cwd(), f = protocolFixture();
try {
  f.create("attention");
  f.state.cwd = cwd;
  f.state.landed.attention = { into: cwd, head: f.git(cwd, "rev-parse", "HEAD"), at: new Date().toISOString() };
  f.state.results.attention = reviewedResult(null, { commit: ["3aeaaff5", "602606f"] }, "done");
  const context = { state: f.state, tracker: f.tracker, pathOf: p => p, locked: async fn => fn(), save: () => f.save(f.state) };
  try { closeAtTarget(context); } catch (error) { console.log(String(error)); }
  f.state.results.child = reviewedResult("attention", { setup: { checkout: "/home/mlegls/dev/bb-plugins" } }, "child handoff");
  closeAtTarget(context);
  console.log(f.tracker.fields("attention").stage);
} finally { f.close(); }
'
~~~

Observed: first call reports no verifiable loaded checkout. After the child
handoff names bb-plugins, the issue becomes done. No resolve or stop is needed.
The replay deliberately bypasses report admission to represent a saved legacy
handoff.

## Held-result recovery

An in-process reconciler used the existing protocol fixture, budget 0 and fake
bb owner. Its saved root had a target-reaching landing, a bare foreign commit,
and an owner exception with reason "foreign implementation not installed".
The foreign commit was on a worker branch of a disposable loaded repository,
absent from that loaded repository's HEAD.

Queued resolution:

~~~json
{"action":"retry","checkout":"/absolute/disposable/loaded"}
~~~

Observed:

- The loaded checkout was saved in foreignCheckouts.root.
- Completion raised "not installed in loaded checkout"; the issue stayed ticket.
- After fast-forwarding the loaded checkout to the foreign commit, the next
  pass closed the issue and removed the exception.
- The run's worker counter stayed 0. No reconcile_stop was called.

The real tool entry point for an existing hold is:

~~~js
tools.reconcile_resolve({
  issue: "<run root>", node: "<held node>", action: "retry",
  checkout: "/absolute/loaded/checkout"
})
~~~

## Existing checks

- bun test lib/report.test.ts lib/reconcile/completion.test.ts lib/reconcile/exceptions.test.ts lib/reconcile/landing-cleanup.test.ts: 31 passed.
- bun test extensions/guard lib/report.test.ts: 19 passed.
- bun run typecheck: passed.

No permanent tests were added by the implementer. A fresh driver/reviewer owns
acceptance and regression encoding.
