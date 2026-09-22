---
stage: ticket
assignee: agent
---

Verify the Orca adapter against a running local Orca app and CLI using `docs/orca.md`’s acceptance sequence. The app/CLI became available during implementation; basic fork, worker, and reader checks passed on 1.4.206. See `docs/research/orca-integration-2026-09-21.md`.

Orca source at the inspected main revision routes Claude/Codex CLI launches through a special renderer-backed path; Pi uses the general terminal path. That path successfully surfaced sibling Pi tabs and identified them as Pi. Structured prompt delivery reports `provider: unsupported`, so receipt acceptance alone does not establish submission. Detailed status/hooks, session-history registration, restart, and image rendering remain unverified. This is an integration uncertainty, not an established failure.

Current acceptance uses the Orca lifecycle in docs/orca.md; archived board/workmux checks are not current steering evidence.

Check `/fork-tab` creates a visible sibling tab without switching or mutating the original Pi session. Check worker setup/launch and Orca messaging/ask/reply, plus visible reader success, compaction, structured submission, abort, and timeout.

If Pi lifecycle metadata is missing, prefer Orca’s Pi launch/hook configuration or a small upstream adapter change over reimplementing a session registry here. Remote hosts and automatic descendant lifecycle are outside the local adapter’s current scope.
