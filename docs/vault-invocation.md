# Vault invocation

Vault workflows stay explicitly invoked for now, while their write-back semantics settle: each run is a case the operator sees and can inspect, so the schema and write-back bugs a watcher would make ambient surface against one note at a time, and an unchanged note left inert is what keeps a repeat run safe. The watcher, when the semantics do settle, is a new caller of this same entrypoint rather than a second implementation. From the repo:

```sh
bun ~/dev/mlegls-pi/lib/vault.ts                # every note changed since the last run's stamp
bun ~/dev/mlegls-pi/lib/vault.ts mlegls-pi.md   # restrict to named notes
```
