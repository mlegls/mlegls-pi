# Workmux reattachment, September 26

The supervisor dropped its repository context when calling `children.turnEnd`. Workmux status is repository-scoped: read-only checks from mlegls-pi and Concept returned one and ten agents respectively. The supervisor now passes its cwd through to attachment.

A fresh attachment with no known pane/status entry previously had no way to report a missing target. The existing `workmux list --json` supplies the missing distinction. Do not infer an exit from `agents: []`: an open shell window also has no registered agent.

## Disposable live encounter

Created an empty temporary Git repository and a dedicated tmux session. Ran `workmux add reattach-probe -b -H -F -C --mode window --parent-session SESSION`: no hooks, file operations, pane commands or model calls. Queried status and list, killed only the newly created window, then queried again. The worktree remained on disk.

| State | Status agents | List target |
|---|---|---|
| Open shell window | `[]` | `is_open: true` |
| Window closed, worktree retained | `[]` | `is_open: false` |

From mlegls-pi, a new process called `children.turnEnd` with the fixture repository cwd and a five-second abort deadline. It returned `kind: closed`, `unreachable: true`, and `workmux target is not open: reattach-probe`. Workmux removal and dedicated-session shutdown both exited zero. The temporary repository/evidence directory was retained, not an active worker. [Exact selected command receipts](../attachments/wm-reattachment-2026-09-26.json).

## Scope

`bun test lib/wm-reattach.test.ts lib/wm.test.ts lib/children.test.ts lib/jobs/supervise.test.ts lib/dispatch.test.ts`: 15 passed. The attachment fixture distinguishes open, closed, absent, unavailable and malformed responses; the child adapter checks cwd forwarding. Poller command failures are logged/retried, not converted into worker death. Independent worker failures do not abort observation of other workers.

The live encounter closed a shell window, not a running Pi agent, and did not restart the shared daemon. An open target without registered agent state remains pending: absence of a report is not proof of exit. Existing board messages and cursors remain the first source of terminal turns. [Issue](../issues/wm-reattachment-loses-worker-repository.md).
