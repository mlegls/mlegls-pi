# Independent empty-journal drive

## Predictions before opening the product

Revision: `fea1ca7`. Persona: mlegls with existing Pi Anthropic OAuth. Surface: Pi public session/RPC, not rendered UI. Deployment must be a newly created disposable local session owned by this checkout; the inherited temp path is an implementer encounter, not permission to modify it. Seed: synthetic child-alpha issue, job and ledger. Entry: `bun docs/attachments/supervisor-hibernation-empty-journal/drive.ts`.

From the ticket and `extensions/memory/README.md`, before launching:

1. Selecting `memory.journal: false` should cause one hibernation to persist an empty summary, zero journal blocks, `operation: empty-journal`, and `trigger: hibernate`, without a checkpoint-model call or native summary.
2. A previous journal should not survive in active context, though append-only history should retain it. Originals should remain available through `ab memory recall`.
3. The next wake in the same session should reread the child issue, job and ledger and report the artifact-based state, rather than depend on a journal.
4. The latest user-message entry and every following tool/assistant entry should survive as one verbatim suffix, with a recorded starting ID and size; this is not a fresh context.
5. Default H selection and session/branch cancellation should stay intact. A single first-use encounter may not expose these; mark them unobservable unless the supplied surface supports a concrete drive.

Expected actions: run the committed launch recipe, wait for it to finish, inspect the public-session results and durable session metadata, record any confusing or missing surface, and stop anything launched. Predictions will be marked after observation. No implementation, diff, test or fixture inspection.

## Session log

- `pi auth check --provider anthropic --json --no-refresh` returned `ready`, auth type `oauth`. No credential values collected.
- Launched the committed entry point from this checkout. It allocated `/var/folders/jx/w79f2km515l0h8lvdh8n8j_w0000gn/T/supervisor-hibernation-empty-journal-hFMasi`, a new checkout-owned synthetic local project/session, rather than reusing the implementer's inherited target.
- Launch process reported three completed agent turns (`agent_end (end)`, `agent_settled`) followed by `compaction_start`. The auth and real session surface are reachable; setup/encounter remains in progress.
- No browser, server, container or tunnel started by the collector. The recipe's child process is scoped to its disposable project.
