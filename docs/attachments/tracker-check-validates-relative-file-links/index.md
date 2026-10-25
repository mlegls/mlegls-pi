# Independent CLI encounter

Tested revision: `d934b4b5672294273a9db8f439ff790bc61983f1`.

## Setup and predictions (recorded before first use)

CLI-only, no authentication, server or browser. Entry point: this checkout's `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts check`. No inherited deployment selectors used. Real repository scans are read-only; repairs use an owned temporary non-git vault, `/tmp/tracker-drive-hiej7eh8`. Setup finished before invocation. The local CLI responded with usage, establishing its readiness.

Predictions:

1. A missing relative Markdown target in a live issue will be reported, while a valid URI-encoded path and unchecked heading will not. **Met.**
2. A repository-root-relative target will offer a file-relative repair; `check` alone will not apply it. **Met:** the subsequent scoped fix still offered that repair.
3. Archived outgoing and incoming links will offer repairs. Scoped fix changes only links involving the named archived file. **Met.**
4. Fenced/inline code, URLs, absolute targets and anchor-only links will be ignored; unrepairable archive links will not be reported. **Met.**
5. Read-only scans of both repositories report findings and representative unresolved targets without applying repairs. **Met.** No `--fix` was used on either repository.

## Driven claims and replayable checks

Set `CLI` to the absolute path of the entry point above. In a fresh temporary directory create `docs/issues/archive/` and `docs/attachments/`. Create `docs/attachments/hello world.md` containing `hello`. Create live issue `docs/issues/live.md` with frontmatter `stage: idea` and the following body:

```markdown
[root](docs/attachments/hello%20world.md#not-a-heading)
[incoming](old.md)
[missing](missing.md)
[valid](../attachments/hello%20world.md#unchecked)
[web](https://example.com/no)
[absolute](/no)
[anchor](#no)
```

Also include an inline-code Markdown link to `no-inline.md` and a fenced-code Markdown link to `no-fenced.md`. Create `docs/issues/archive/old.md` with frontmatter `stage: done`, `[outgoing](../attachments/hello%20world.md#keep)` and `[ignored missing](absent.md)`.

From that directory:

- `bun "$CLI" check`: one dangling-link finding (`issues/live.md: [missing](missing.md) does not exist`) and three repair offers. No ignored target appeared. **Held.**
- `bun "$CLI" check --fix docs/issues/archive/old.md`: incoming target became `archive/old.md`; outgoing became `../../attachments/hello%20world.md#keep`. The root-relative target stayed unchanged and was reported as needing a matching moved path. **Held.**
- `bun "$CLI" check --fix`: root-relative target became `../attachments/hello%20world.md#not-a-heading`. **Held.**
- `bun "$CLI" check`: only the deliberately missing live target remained. **Held.** All four invocations returned 1 because that finding remained. Reading both final Markdown files confirmed the rewrites, URI encoding and anchors survived, and ignored text remained unchanged.

Acceptable replay result is precisely these three rewrites and the one remaining live dangling-link finding; no missing-heading diagnostic, code-link diagnostic or unrepairable archive diagnostic.

## Repository scans

Commands: from this checkout and then `/home/mlegls/dev/mmon/concept`, run `bun "$CLI" check` with the same absolute checkout-owned CLI. Both completed with exit 1. Counts are diagnostic lines, not unique targets, and include the canonical global issue vault plus the scanned docs. These are pre-fix findings, not claims that every proposed repair was applied.

| Scan | All findings/repair lines | Markdown repair offers | Markdown missing targets without repair | Other repair offers | Other findings |
| --- | ---: | ---: | ---: | ---: | ---: |
| this repository | 435 | 223 | 22 | 0 | 190 |
| mmon/concept | 1119 | 897 | 87 | 3 | 132 |

Markdown missing targets were counted by `](` plus `does not exist`; Markdown repair offers exclude wikilink (`[[`) offers. The remaining counts include wikilink and lifecycle diagnostics, so these are not directly comparable with the ticket's earlier raw-link inventory.

Representative unrepaired Markdown findings:

- This repo: `guide/cua-background.md` links `../../extensions/exec/cua-runtime.test.ts`, `../../extensions/exec/fixtures/cua-direct-textedit.json`, and `../computer.md`; all are reported missing.
- This repo: `attachments/rehearse-github-tracked-reconcile/drive.md` links `../../../issues/native-rehearsal-single-page-capacity-prevents-replay.md`, reported missing.
- Concept: `design/markdown/content/lesson.md` links image `media/zhuangzi.jpg`, reported missing.
- Concept: `attachments/fold-the-overhaul-into-the-design-recipes/index.md` links `ranked.webp`, `alternatives.webp`, `compound.webp`, `keys.webp`, and `list.webp`, all reported missing.

## Frictions and limits

No new unresolved tooling friction encountered. Expected dangling links in real repositories are the inventory requested by this ticket, not newly discovered runtime defects. Diagnostic output distinguishes repairable links and still-unresolved links clearly. This was a nonvisual CLI journey; no screenshots. No source, diffs, tests or existing fixtures were inspected, and no test runner was used. Temporary vault removed after final inspection; no services were started.
