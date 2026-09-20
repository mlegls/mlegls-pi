# Rejection memory

`.out-of-scope/<concept>.md` preserves why a feature was rejected. One concept
can collect several requests; a later request should find the prior reasoning
without requiring the maintainer to remember it.

```markdown
# User-facing themes

The product exposes build-time palette configuration, not a runtime theme
switcher. Runtime theming belongs to embedding applications.

## Prior requests

- [Theme switcher](issue-url)
```

The reason can include examples or code where useful. A temporary lack of time
is a deferral, not a product rejection. Already-implemented features and bug
closures do not belong here.

During triage, surface a matching decision for the maintainer to confirm or
reopen. Append later requests to the existing account. When the decision
changes, update or remove it; historical issues retain their own history.
A substantial architectural decision can live in an ADR with a link here
rather than a duplicate explanation.
