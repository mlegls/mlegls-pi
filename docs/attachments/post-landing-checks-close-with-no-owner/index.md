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

## Independent drive: predictions before use

- Submit a recipe read as deferred work. I expect to stay in review and get a correction to make before landing.
- Submit the two declared deployment gates. I expect the candidate on the target, the issue still open, and `thr_solo` told which target, revision and checks to verify.
- Report a red `deploy` verdict. I expect the issue to remain actionable and the owner to get the failed check, evidence and next action. A passing rerun should leave `smoke` pending; passing `smoke` should close the issue with the full verdict history.

## Independent drive: results

Tested `c9783a70` after `mise run setup`. The CLI reached `Ready. Retained target: /tmp/rc-setup-8TAO1n`; `issue` showed the seeded gates. The fake run owner needed no credentials. `stop` cleaned up the disposable target after the replay.

| Replay check | Observed |
| --- | --- |
| Submit the recipe read as a deferred check, then inspect `status`. Expect no landing and a direction to do candidate checks in review. | Met. Phase remained `review`; the reviewer was told to list declared IDs and keep checkout-runnable checks in review. |
| Submit `deploy` and `smoke`, then inspect `status` and `issue`. Expect a landed revision, both checks assigned to `thr_solo`, and an open ticket. | Met. The owner received both checks, the target `/tmp/rc-setup-8TAO1n/repo`, landed SHA `617a58075508daf2df1a285a8f8be7f5824aa785`, and verdict instructions. `issue` still showed `stage: ticket`. |
| Submit red `deploy`. Expect actionable repair and rerun instructions, durable failed evidence, and an open ticket. | Met. The owner's message named `deploy`, quoted the 503, and asked for a repair and rerun; status attributed the failed verdict to `thr_solo` and `issue` remained a ticket. |
| Submit green `deploy`, inspect the issue, then submit green `smoke` and inspect it again. Expect closure only after both pass, with the failed verdict retained. | Met. After green `deploy`, only `smoke` remained pending and the issue was open. After green `smoke`, the issue reached `stage: done` with all three verdicts, evidence and owner attribution in the Result. |

Friction: turns and verdicts apply asynchronously. `turn` prints an explicit warning; `verdict` exits silently, so `status` or `issue` is needed to confirm receipt. One fake-BB thread observation logged `ETXTBSY` and was deferred; landing followed and the replay needed no intervention.

## Implementation encounter

The undeclared recipe read drew a repair without leaving review. The declared IDs let the reviewed commit reach the owner checkout. The owner got both checks and the target SHA; the vault issue remained `stage: ticket`.

After the red `deploy` verdict, the owner's message contained `503`, the failing check and instructions to repair it and record the rerun. Status retained the failed verdict as `thr_solo`; the issue was still a ticket. Passing `deploy` alone left it a ticket until `smoke` passed. At close, the Result retained both `deploy` verdicts and the `smoke` verdict with their evidence and owner.

An offline PR-body probe with a seeded native issue identity rendered `Refs #23` while the gates were pending and `Closes #23` for the ordinary review. No live PR was created.

## Review replay

At `f906ccfd`, the fixture printed `Verdict queued` with the status command. To check that two submissions in one polling interval cannot lose the red verdict, pause the disposable reconciler PID (`SIGSTOP`) after the owner receives both gates. Submit failed `deploy`, then passed `smoke`, before resuming (`SIGCONT`). The second call refused with `A verdict for solo is already queued`; it did not replace the first. After resuming, the owner received `Replay 503` and the repair instruction. Passing `deploy` left `smoke` pending. Resubmitting `smoke` closed the issue with all three observations attributed to `thr_solo`. The fixture was stopped and removed.
