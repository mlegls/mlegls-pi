# Relative Markdown file-link checking

Read-only first use on 2026-10-25, using this branch's `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts check`. Both repositories were readable and the command completed with exit 1 (findings), not a setup failure. No `check --fix` was run against either repository.

| Checkout | Findings | Markdown repairs available | Unrepairable Markdown findings outside archive | Other findings |
| --- | ---: | ---: | ---: | ---: |
| `/home/mlegls/dev/mmon/concept` | 1,119 | 897 | 87 | 135 |
| `/home/mlegls/dev/mlegls-pi` | 435 | 223 | 22 | 190 |

Counts are emitted diagnostics, not total link occurrences: repeated identical repairs in one file are deduplicated. The concept output also has 3 wikilink repairs, included in Other findings; this repository has none. Unrepairable archived Markdown links are deliberately omitted by the checker. These are current checkout observations, not a reproduction of the ticket's older 862-link census. Revisions observed immediately after the run: concept `60282c9c74c6df5e600934b45b32e8b0878914c1`, mlegls-pi `fec6c30071f1520a153c9af8ed8c7a71762f5865`; canonical issue data is live and can change independently.

Full output: [concept](mmon-concept-check.txt), [mlegls-pi](mlegls-pi-check.txt).

## What's left without a mechanical repair

- concept `docs/design/markdown/content/lesson.md`: `media/zhuangzi.jpg` does not exist.
- concept `docs/attachments/fold-the-overhaul-into-the-design-recipes/index.md`: `ranked.webp`, `alternatives.webp`, and other image destinations do not exist.
- concept `docs/attachments/draw-session-map-and-graph-diff-node-marks/index.md`: `~/dev/mlegls-pi/docs/issues/bound-artboard-frame-capture-concurrency.md` is not a file-relative link and does not resolve.
- mlegls-pi `docs/guide/cua-background.md`: `../../extensions/exec/cua-runtime.test.ts`, `../../extensions/exec/fixtures/cua-direct-textedit.json`, and `../computer.md` do not resolve.
- mlegls-pi `docs/attachments/rehearse-github-tracked-reconcile/drive.md`: `../../../issues/native-rehearsal-single-page-capacity-prevents-replay.md` does not resolve through any of the three repairs.

## First-use setup for a fresh driver

CLI-only; no deployment, authentication, secrets, seed, or resident process. Use a checkout containing this commit. The tracker reads canonical issues, while code documentation comes from the current checkout. The original scan deliberately ran with each canonical checkout as cwd. From the implementing checkout, this directly opens the check surface:

```sh
bun skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts check
```

To repeat the exact read-only repository scans, set `CLI` to the absolute path of this checkout's script and run `(cd /home/mlegls/dev/mmon/concept && bun "$CLI" check)` and `(cd /home/mlegls/dev/mlegls-pi && bun "$CLI" check)`. Do not add `--fix` to those scans before landing.

The four authorized regression scenarios prepare isolated temporary projects and exercise root-relative repair, archived-source repair, archived-target repair, scoped fixing, read-only behavior, and unrepaired dangling links. They are runnable without external state from this checkout:

```sh
TRACKER_CLI="$PWD/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts" bun test skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
```

Observed: 29 pass, 0 fail, 699 assertions. Explicit `TRACKER_CLI` overrides the reconciler's inherited base-version pin; otherwise the test harness intentionally runs the pinned tracker rather than branch code. Temporary fixture directories are removed by the tests. No browser or server was started.
