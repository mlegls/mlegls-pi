# Thread list summaries: implementation first use

Revision: worker commit containing this packet (base `a52c3e82d1987b71c13dedc6c81df55b94a9c249`). Nonvisual CLI journey; fresh driver acceptance remains separate.

## Setup and entry point

Required environment: local Bun CLI, no authentication. Prepared target: this worker-owned checkout; `mise run setup` completed before implementation. No service is required. The committed fixture creates isolated temporary registry/board/zmx selectors, seeds three inactive threads and a multiline blocked report/reason, invokes the real CLI, and removes its state on exit. No agents or servers are launched.

From the checkout root:

```sh
bun docs/attachments/thread-list-blocked-reason-spills-rows/first-use.ts
bun docs/attachments/thread-list-blocked-reason-spills-rows/first-use.ts --json
```

## Observed

- Text invocation exited 0 and printed three physical lines for three threads. The indented child had both `report=blocked:` and `blocked=archive:` on its own line; each summary ended in `…`. Whitespace was collapsed to spaces, with each summary bounded to 160 characters including the ellipsis.
- JSON invocation exited 0 and retained the full multiline reason and report body, including the trailing whitespace. Only text row formatting is changed.
- `bun test lib/thread/cli.test.ts`: two tests passed, including the ticket-authorized multiline row formatter regression and the existing fork regression.
- `bun run typecheck`: passed.

The fixture is seeded formatting state, not a live archive conflict reproduction. It exercises `thread ls` against the actual registry and board without changing host state.
