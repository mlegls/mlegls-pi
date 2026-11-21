# Post-landing gates: offline first use

From this checkout, open the reconciler's review surface:

```sh
bun lib/reconcile/setup-fixture.ts new --post-landing
```

Wait for `Ready. Retained target:` and use that path as `ROOT`. The target is a disposable `/tmp/rc-setup-*` vault/Git repo owned by this invocation. Fake BB holds a prepared reviewer with a committed evidence packet and routes owner messages to `thr_solo`. No sign-in, live deploy, or registry is involved. The simulated ticket declares `deploy` and `smoke`, two observations of the target-triggered deploy.

Submit a review whose only deferred checks are the two declared gates:

````sh
bun lib/reconcile/setup-fixture.ts turn "$ROOT" 'blocked

```yaml
summary: Offline deployment review
stories: [{story: "Main deploy serves the candidate.", outcome: unobservable}]
evidence: {path: docs/attachments/review.md, visual: false, shots: []}
postLanding: [deploy, smoke]
```'
````

To try the pre-landing refusal first, replace the last YAML line with `postLanding: ["Read the landed deploy recipe"]`. Check `status` for the reviewer's repair message, then submit the declared IDs above.

Read status and the global issue with `bun lib/reconcile/setup-fixture.ts status "$ROOT"` and `bun lib/reconcile/setup-fixture.ts issue "$ROOT"`. The turn and verdict commands submit messages asynchronously. Wait for each corresponding status update before submitting the next verdict. The fixture `verdict` subcommand uses the real reconciler resolution queue as the fake run owner:

```sh
bun lib/reconcile/setup-fixture.ts verdict "$ROOT" '{"check":"deploy","outcome":"failed","evidence":"Fixture run 41: /ready returned 503 on the candidate deployment."}'
bun lib/reconcile/setup-fixture.ts verdict "$ROOT" '{"check":"deploy","outcome":"passed","evidence":"Fixture run 42 after repair: /ready returned 200."}'
bun lib/reconcile/setup-fixture.ts verdict "$ROOT" '{"check":"smoke","outcome":"passed","evidence":"Fixture run 42: /about showed the candidate version."}'
```

Stop the reconciler and remove the disposable target with `bun lib/reconcile/setup-fixture.ts stop "$ROOT"`.

## Implementation encounter

The undeclared recipe read drew a repair without leaving review. The declared IDs let the reviewed commit reach the owner checkout. The owner got both checks and the target SHA; the vault issue remained `stage: ticket`.

After the red `deploy` verdict, the owner's message contained `503`, the failing check and instructions to repair it and record the rerun. Status retained the failed verdict as `thr_solo`; the issue was still a ticket. Passing `deploy` alone left it a ticket until `smoke` passed. At close, the Result retained both `deploy` verdicts and the `smoke` verdict with their evidence and owner.

An offline PR-body probe with a seeded native issue identity rendered `Refs #23` while the gates were pending and `Closes #23` for the ordinary review. No live PR was created.
