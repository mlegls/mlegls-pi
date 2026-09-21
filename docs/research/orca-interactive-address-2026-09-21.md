# Interactive Orca address verification — 2026-09-21

Scope: automatic address creation, display-command output, agent context, and reload reuse in `extensions/orca/index.ts`.

Invoked the extension’s registered startup, before-agent-start, and `/orca-address` handlers with a minimal Pi UI adapter and the live Orca CLI in an unbound interactive terminal. Startup created `run:run_99975b9f49e5`; the footer callback, command message, and appended system prompt all carried that exact address. Repeated startup kept the same address without creating another Run. The Run remains bound to the interactive terminal.

`bun test`: 201 passed, 1 skipped, 0 failed. Targeted TypeScript checking passed after removing the unsupported `session_switch` registration; Pi uses `session_start` for reload/session initialization.

Not driven: actual TUI rendering/copy selection, new-tab/fork startup, native worker startup, cross-session message delivery, or incoming-mail notification. Worker discovery and pre-enrollment protection remain subject to the native identity limitation recorded in `docs/frictions.md`.
