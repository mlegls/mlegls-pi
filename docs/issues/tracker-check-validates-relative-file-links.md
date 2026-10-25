---
stage: "ticket"
assignee: "agent:auto-routine"
priority: 2
author: "session:thr_97xxb6d8ii"
---
"an "outsider" (which every fresh context is, and which i am for issues i wasn't deeply involved in) should be able to thoroughly understand what an issue is about just by recursively following its links. this is part of the point of having it obsidian-format. so file links should be real links" (maintainer, 2026-10-25, @thread:thr_97xxb6d8ii)

[issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts) `check` validates wikilinks only. In mmon/concept, 862 of the 2,280 relative Markdown links under `docs/` don't resolve from their file (2026-10-25). Most are written relative to the repository root (`[x](docs/attachments/y/index.md)` from `docs/issues/`), and archiving an issue moves it one directory down, which breaks file-relative links that were right. `close --evidence` wrote the root-relative form too, until 5a718867.

bb's Markdown opener, [Obsidian at Home](https://github.com/classicrob/obsidian-at-home), falls back to the workspace root, so root-relative links open there; Obsidian proper resolves from the vault (`~/obsidian`), where they don't. File-relative links work in both, so that's the form `check` keeps.

## shape

`checkLinks` already walks `docs/` and the issues and masks code (`maskMarkdownCode`). It also reads `[label](target)` links whose target isn't a URL (`scheme:`), an in-page `#anchor` or absolute, and resolves the target (without its `#anchor`, URI-decoded) from the file's directory. One that doesn't resolve is a finding, with a repair when one is mechanical:

- resolves from the repository root (the directory holding `docs/`) → rewrite file-relative;
- the file is under `issues/archive/` and the target resolves from the directory it was archived from → rewrite with the extra `../`;
- the target is an issue file that has since moved into `archive/` → point at the archived file, as `moved()` does for wikilinks.

Repairs follow the existing `check --fix [moved issue paths...]` rules: with paths, only repairs involving those moved files apply; without, all do. Findings without a repair are reported for files outside `issues/archive/` only, so `check` stays usable while the archive keeps its old links (about 400 of the 862 are mechanical). `#anchor` headings aren't checked for Markdown links.

## tasks

1. Add Markdown-link checking and the three repairs to `checkLinks`, with a test per repair and one for a reported dangling link, in [issues.test.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts).
2. Document it beside the wikilink checks in [issue-tracker-vault.md](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-vault.md).
3. Report what `check` finds in mmon/concept and this repository (counts, and a sample of what's left unrepaired); running `check --fix` there is for after this lands.

## Verification evidence

[Independent CLI encounter](../attachments/tracker-check-validates-relative-file-links/index.md): all driven claims held; includes isolated repair replay and read-only inventories of both repositories.
