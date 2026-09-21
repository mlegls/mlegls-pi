# Friction follow-up — 2026-09-21

## Type checking

Reproduced all four reported errors. `lib/session/tmux.ts` now asserts the streams guaranteed by its spawn configuration: stdout/stderr are always piped; stdin is piped exactly when input is supplied. No subprocess behavior changed. `extensions/system-prompt/index.test.ts` captures the checked handler in a constant before closing over it.

- `bunx tsc --noEmit`: passes.
- `env -u BB_THREAD_ID bun test`: 196 pass, 2 skip, 0 fail.
- `bun test` inside BB: 189 pass, 2 skip, 7 fail, all in board-dependent tests. BB disables the board host; tests currently inherit that environment.
- No story/theory files exist for these changes; existing session and system-prompt tests exercise the affected behavior.

## Upstream dependencies

Both PRs remain open; neither pin was changed.

- [pi-better-skills #4](https://github.com/edxeth/pi-better-skills/pull/4): maintainer requested reproduction. [Posted a standalone handler probe](https://github.com/edxeth/pi-better-skills/pull/4#issuecomment-5754256044), verified against the pinned fork with the marker present/absent. An unmarked raw exec read executes its dynamic command; marked output is left untouched. This is unwanted activation of raw inspection, not proof that an already-expanded simple command executes twice. Without project-shell trust, unmarked output is still rewritten with a skipped-command notice.
- [chrome-devtools-axi #142](https://github.com/kunchenguid/chrome-devtools-axi/pull/142): approved, but maintainer requires submission through `no-mistakes` with completed review/test/document attestation bound to the head commit. The CLI is not installed here. Did not install or run its AI-driven pipeline, fabricate attestation, or change the global browser installation. Next: coordinate tooling setup and run the actual gate.

Desktop capture, anchor identity, and host registration lifecycle were not changed.
