# Contexts map

`docs/README.md` exists only when a repository has more than one theory
context. It maps each context to its responsibility, code, and docs.

```markdown
| context | responsibility | code | docs |
|---|---|---|---|
| core | the portable engine | `packages/core/` | `docs/core/` |
| web | hosting and interface | `packages/web/` | `docs/web/` |

Web depends on Core through its public operations; Core never imports Web.
```

Each context has its own `theory.md` and `concepts/`. Stories, frictions, and
issues stay repository-wide. Two contexts that cross-link so much that
neither reads alone are one context.
