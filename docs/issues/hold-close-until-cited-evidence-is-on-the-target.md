---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_chd6gnjgbs"
---
goal: the reconciler doesn't close an issue whose cited evidence isn't on the target. Maintainer, 2026-11-08 (@thread:thr_chd6gnjgbs).

Observed in concept: done issues cited packets that existed only on worker branches (drive, recovery or earlier implement branches), never landed: session-closing-summary, seed-mission-quiet, staging-session-final-frame-left-text-under-rail, make-staged-decline-send-requirements-explicit, check-that-a-first-map-appears-within-minutes and others, restored by hand on concept main (55065ebf4, c3d9503d4, e31cbce4d). `evidencePacket` in [checks.ts](../../lib/reconcile/checks.ts) checks the handoff's index and shots at the worker's HEAD, but nothing checks the tracker body's attachment links, and nothing checks again at the target.

## shape

In `closeAtTarget` ([completion.ts](../../lib/reconcile/completion.ts)), before `tracker.close`, resolve against the target ref (`git cat-file -e <target>:<path>`): the result's evidence path and shots, and every relative link and `[[projects/<this>/attachments/…]]` wikilink under `docs/attachments/` in the issue's tracker body. A missing one keeps the node unclosed and raises an exception naming each missing path and the branch commits that have it (`git log --all -1 -- <path>`), so the handler can carry them over or rewrite the link. Links that already resolved before this landing aren't the node's to fix: only paths the node's own branches added or the body gained during the node's run count, so another node's stale links never block a close.

Done when a reconciler test lands a node whose body links a packet committed only on its drive branch and sees the close held with that path named, and one whose links all resolve on the target closes as before.

## Result

done

The implementation holds up; the missing piece was the test the ticket names as its done-when. The change had none: its only test edit was one added `f.commit` line in the existing case. The driver's "held" outcomes came from that case passing, so they were unsupported.

I added `a close holds on a cited packet that exists only on a drive branch…` to `lib/reconcile/completion.test.ts`. It covers three things:
- **Drive-only packet:** the body links a packet committed only on a never-landed drive branch. `closeAtTarget` calls `holdEvidence` with text naming the path and the drive commit, and the issue stays `ticket`.
- **Stale link:** a second node whose body has a missing link that predates its scope, with no branch of the node adding it, closes normally.
- **Landed packet:** once the drive branch merges to the target, the held node closes.

Bypassing `targetEvidenceFailure` in `closeAtTarget` makes the new test fail. `bun test lib/reconcile` gives 48 pass, 0 fail in about 162 s. `mise run test:affected` doesn't exist in this repo, so I ran that whole directory instead. I appended the review to the driver's packet.

```yaml
commit: f73972fb
stories:
  - story: A drive-only cited packet holds closing with the missing path named
    outcome: held
  - story: Citations resolving on the target allow closing
    outcome: held
evidence:
  path: docs/attachments/hold-close-until-cited-evidence-is-on-the-target/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/completion.test.ts
caveats:
  - "Added the ticket-mandated test myself, with no separate maintainer approval; it is a second fixture case, about 1.8 s."
  - "The unrelated merged commits in the diff (OM fallback, landing-cleanup, memory log) are other tickets' work and were not reviewed here."
  - "No driver-filed frictions were linked, so none to triage."
```

Evidence: [docs/attachments/hold-close-until-cited-evidence-is-on-the-target/index.md](../attachments/hold-close-until-cited-evidence-is-on-the-target/index.md)
