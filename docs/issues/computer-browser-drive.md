---
next: implement
---

concept's `packages/web/scripts/drive.ts` is `computer.run` plus a Playwright `UI` adapter plus three things run lacks. Lift those three, add the adapter in pi, and drive.ts becomes a loader, a persona sign-in, and two renderer calls.

into `lib/computer.ts`, none browser-specific:
- `walk(steps)`: a guide is a sequence of `{label, expect, budget?}`; run per step with history carried across; a step that never arrives is recorded and walked past, not a stop.
- two-judgment done: a step ends when the Choice says done and a Noul "the expected result is already showing" agrees ≥ 0.75, else wait; past the wait budget the Choice alone ends it and the ending is marked contested. Default policy for `run` too.
- `Candidate.replay?: string`: the adapter's source for the same action it took, so a recorded drive replays through the locator it drove with.

`lib/computer/browser.ts`: `UI` over a Playwright `Page`, Playwright loaded from the target repo by `createRequire` as lint/extract.ts loads TypeScript. observe = `ariaSnapshotJSON({mode:"ai"})` → actionable roles as `canPress`/`isTextInput`, landmark path in the description, tail of readable text as context; act = `getByRole(role, {name, exact})` click or fill with the re-mount retry (fill until the field holds it); `replay` = that locator as source.

renderers over `Event[]`, pure: `appeared(before, after)`, `sheet(trace)` contact sheet, `spec(trace)` the Playwright block skeleton with one comment per step and `// appeared:` candidates. `spec` is the browser adapter's.

hooks stay for what must survive interruption or belongs to the project: `onEvent` writing each event under `.drives/<story>/<stamp>/` as it lands; project state snapshots (a Convex query after a step) through the same hook. `beforeAction` unchanged.

then in concept: drive.ts → load the Drive file, persona sign-in leaving storage state, `walk` with the browser adapter, render. `verify-story` step 2 names `computer.walk`; step 5 gains the static traceability gaps (test file no story names; story row no recorded check names), no model call.

not: assertions from the driver (done stays a judgment, the reviewer asserts into the skeleton); running drives in the project's CI (recorded specs are what CI runs); a copy of the loop in the project.

done 2026-09-21: the three lifts, `lib/computer/browser.ts`, the renderers; concept's `scripts/drive.ts` is now `prepare`/`record`/`finish` around `computer.walk`. Smoke over a local page: fill by placeholder-less `getByRole`, press, `appeared: status: Signed by Ada`, a valid block with `drive.inputs` back-referenced. The showing noul reads the node tree alone at ~0.5 even when the condition plainly holds and the aria text at ~0.85, so each view's readable text now sits beside its nodes in the state; with it the smoke ran with no waits and no contested endings.

next: session.take-a-lesson and plan.start-a-plan re-driven through this path against the browser story environment (isolated deployment, packaged host, scripted provider), and the skeletons compared with the specs their reviewers accepted. `verify-story` step 2 to name the composition in drive.ts's header.
