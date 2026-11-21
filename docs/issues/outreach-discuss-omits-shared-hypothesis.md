---
stage: "done"
author: "session:thr_swr7jtjcxn"
assignee: "agent:auto-routine"
---
In [[projects/mlegls-pi/stories/manage-outreach-conversations]], select Pat and Charlie in the demo Candidates view, click Discuss 2 and submit a prompt. Both records link to Busy operators, but the draft, message and thread header listed only the people. Observed by @thread:thr_swr7jtjcxn at c4e1c1b.

## tasks

Land the reviewed `bb-plugins` branch `tracker-outreach` through `fb98bae` with [[projects/mlegls-pi/issues/tracker-outreach-panel-for-project-vaults]]. The [review replay](../attachments/tracker-outreach-panel-for-project-vaults/index.md#review-replay) verified two people and one shared hypothesis in all three places.

## Result

done. I made no repairs: all three stories hold at `bb-plugins` `fb98bae`.

- **The fix:** `c4e1c1b..fb98bae` changes only `tracker/outreach-page.tsx`. **Discuss** now attaches the selected people plus each hypothesis they link to, with duplicates removed, so Pat and Charlie share one **Busy operators** chip. When there are several attachments, the dialog heading says "N records" instead of "N people".
- **Evidence:** both screenshots match the driver's log. The draft shows three chips, and the sent message plus the **Outreach 3** panel show all three records once each.
- **Typecheck:** `bunx tsc --noEmit` in `tracker/` passes at `fb98bae`. There are no affected tests to run.
- **One small mismatch left alone:** the thread-header panel names person records from their slug (`Charlie candidate · person`), while the chips use the real name (`Charlie Candidate`). That label comes from the earlier commit `c20a38b`, not this fix. Changing it would add a commit to a branch that's being landed "through `fb98bae`" and would need another round on the shared tracker install, so I only noted it.

I added my review to the end of the driver's log (`eac175e1`).

```yaml
commit: eac175e1
stories:
  - story: Discuss 2 opens a draft with both people and one shared hypothesis
    outcome: held
  - story: The sent message retains all three attachments
    outcome: held
  - story: The thread header gives access to all three records
    outcome: held
evidence:
  path: docs/attachments/outreach-discuss-omits-shared-hypothesis/index.md
  visual: true
  shots:
    - docs/attachments/outreach-discuss-omits-shared-hypothesis/draft.jpg
    - docs/attachments/outreach-discuss-omits-shared-hypothesis/thread.jpg
tests: []
filed: []
caveats:
  - "nit, not fixed: ThreadOutreachPanel (tracker/outreach-page.tsx:40, from c20a38b) labels person records from their slug (title(item.slug)), so the header panel reads 'Charlie candidate' while the chips read 'Charlie Candidate'. The fix is to look up the person's name from the outreach snapshot."
  - "The driver's disposable demo project (proj_gmt75bhesh) and its two threads remain."
```

Evidence: [docs/attachments/outreach-discuss-omits-shared-hypothesis/index.md](../attachments/outreach-discuss-omits-shared-hypothesis/index.md)
