# First-use CLI verification

## Predictions recorded before use

1. The supplied encounter should ignore missing wikilinks in indented code (four spaces or a tab at document start or after a blank line). **Met** in the independent CLI encounter below.
2. A missing wikilink in a list continuation should remain a diagnostic; the supplied encounter should report only `missing-list-continuation` and exit 1. **Met**.
3. Regression test coverage is a reviewer/integrator concern, not observable through this user encounter.

## Setup

Tested revision: `5606bb3ed02f5341ce6c2293e50fdf20ee9f40cd`.
CLI deployment in this driver worktree; no authentication. Parent reports `mise run setup` complete. Entry point exists: `bun docs/attachments/tracker-indented-code/try.ts`. Implementer handoff specifies an automatically cleaned, driver-owned temporary vault seeded with indented code and list-continuation wikilinks. No shared service or inherited deployment selector was used.

For the independent encounter I created `/tmp/tracker-drive-2.ZAzrr6`, outside git, with `issues/example.md` (stage idea, author session:driver) and `examples.md`. This is an exclusively driver-owned local vault. Readiness was established by successfully executing the supplied entry point, then the checker against this vault. Removed the independent vault after use.

## Actions and observations

- Ran `bun docs/attachments/tracker-indented-code/try.ts`. Exit **1**, exactly one finding: `examples.md: [[missing-list-continuation]] does not exist`.
- Independently authored this Markdown document (not implementation/test inspection):

```text
    [[missing-start-spaces]]

Paragraph.

\t[[missing-tab]]

    [[missing-blank-spaces]]

- List item
    [[missing-list-continuation]]

[[missing-prose]]
```

Here `\t` represents one literal tab. From the temporary vault, ran `bun <driver-worktree>/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts check`.
- Exit **1**, exactly two findings: `examples.md: [[missing-list-continuation]] does not exist` and `examples.md: [[missing-prose]] does not exist`. No code-block links appeared.

## Outcomes and replayable checks

- **Held:** four-space code at document start is ignored. Replay the document above; accept no `missing-start-spaces` finding.
- **Held:** tab and four-space code following blank lines are ignored. Replay above; accept no `missing-tab` or `missing-blank-spaces` findings.
- **Held:** indented list continuation remains checked. Replay above; accept a `missing-list-continuation` finding and nonzero exit.
- **Held:** ordinary prose stays checked (a prediction formed before authoring the independent encounter). Accept a `missing-prose` finding.
- Suite coverage was not inspected or run: this is a product CLI encounter, not test acceptance. Reviewer/integrator owns that gate.

## Frictions and limits

No user-facing friction observed. Nonvisual CLI journey; no screenshots. No servers started; no external resources retained. Implementation, tests and supplied runner source were not read.
