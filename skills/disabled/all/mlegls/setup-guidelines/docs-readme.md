# Docs

This file is the source of truth for documentation roles and paths. Paths are
repository-relative. A mapped path may name a file, an indexed directory's
`README.md`, or a collection directory.

## documents

| role | scope | path |
|---|---|---|
| stories | repository | `{STORIES_PATH}` |
| glossary | `{CONTEXT}` | `{GLOSSARY_PATH}` |
| theory | `{CONTEXT}` | `{THEORY_PATH}` |
| architecture | `{CONTEXT}` | `{ARCHITECTURE_PATH}` |
| ADRs | `{CONTEXT}` | `{ADRS_PATH}` |
| hypotheses | `{CONTEXT}` | `{HYPOTHESES_PATH}` |

For multiple contexts, repeat context-scoped rows. Add repository-scoped ADR or
hypothesis rows only when those collections exist. Map paths before creating
their files or directories; documents are created on first write.

## contexts

| context | responsibility |
|---|---|
| `{CONTEXT}` | `{RESPONSIBILITY}` |

## relationships

{How multiple contexts communicate or share concepts. Omit for one context.}
