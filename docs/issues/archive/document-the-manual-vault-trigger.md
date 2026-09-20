---
next: done
priority: 2
---

Vault workflows are manually invoked while their write-back semantics settle; the repo should say so and show the command, so that the choice reads as a decision rather than an unimplemented watcher. Done when `docs/vault-invocation.md` has that paragraph and the CLI invocation; no runtime changes.

From the `mlegls-pi` thread "Document the manual vault trigger"; the loop and the watcher's reuse of this entrypoint are in the vault note `Vault invocation loop`.
