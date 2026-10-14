# Quoted read verification

## Predictions recorded before first use

1. A quoted single path containing spaces returns contents rather than ENOENT with literal quotes: **not met** in this session's live codemode tool.
2. An existing unquoted literal path containing spaces returns that file rather than splitting: **met**.
3. Supplied developer entry point completes successfully: **met**. Whether it proves codemode and direct behavior was not independently established; no source or tests were inspected.

## Setup and revision

Tested revision: `f90bdd0797b28b1be2fd561201c501bcd29f04c1`.
Local committed checkout: `/Users/mlegls/dev/mlegls-pi__worktrees/codemode-read-does-not-honor-quoted-space-containing-paths-drive-2`. No server, ports, authentication or external deployment. `mise run setup` was reported finished. Supplied entry: `bun test lib/outline-read/read.test.ts`; its fixtures are created/removed by the runner. Readiness observed: Bun started and completed successfully. Manual fixture was created by the driver at `.wm/quoted-read-drive/a b.md` with one line, `Quoted-path driver sentinel 2026-10-14`, and removed afterwards.

## Encounter and checks

- Ran supplied entry point. Observed 1 pass, 0 fail, 2 expect calls. Case named `quoted space-containing paths resolve, and existing unquoted literals win over splitting` passed. No repository-wide checks run.
- Called live codemode `tools.read({path: '\".wm/quoted-read-drive/a b.md\"'})`. Observed ENOENT accessing the checkout path followed by `/\".wm/quoted-read-drive/a b.md\"`; quotes were retained. **Quoted codemode story failed on the encountered surface.**
- Called `tools.read({path: '.wm/quoted-read-drive/a b.md'})`. Observed one-line file and exact sentinel. **Existing unquoted literal story held through codemode.**
- Direct standalone read: **unobservable** through the provided entry point except for the passing runner's summary; no separate direct tool surface was supplied.

Replay: create a one-line file with a space in its name, call the two read arguments above from a fresh checkout-loaded runtime, and require identical sentinel content with no errors. Then invoke the standalone read tool with the quoted argument and require the same result. This distinguishes committed-library behavior from a possibly stale loaded extension.

## Friction and limits

The setup entry point reached a test runner, not a fresh direct/codemode runtime. The live tool advertised quoting yet rejected it. A loaded-extension discrepancy is a hypothesis only; no implementation was inspected. The existing owning [ticket](../../issues/codemode-read-does-not-honor-quoted-space-containing-paths.md) has this observation and packet link; no duplicate issue filed. Reviewer should establish both fresh surfaces before acceptance.

Nonvisual CLI/tool encounter; no screenshots or services started.
