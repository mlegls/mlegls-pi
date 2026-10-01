---
stage: done
assignee: agent
author: session:01a0f22b-ddd3-723c-a32c-b98b3da77205
---

Obsolete 2026-10-01: the exec and bash extensions were deleted in the pi 0.99 rebuild (`4b79baa`); the outer loop is codemode with pi's built-in bash.

During [[projects/arkhai-payments/issues/ledger-on-formance]] independent driving, a bash tool call ran `podman machine start; bun install --frozen-lockfile; FORMANCE_PORT=3168 bun run ledger:local > <setup-log> 2>&1`. It returned a still-running handle at 10 seconds. The setup log already reported ready, seeded approval and final balance at 11:57 UTC; an independent process listing at about 11:58 found no `ledger-local` or Podman compose/pull/up process. The original call's completion notification arrived only while stopping the VM during cleanup, reporting 662 seconds total. The product was usable throughout.

Owner: mlegls-pi bash execution/completion handling, with Podman machine API forwarding as a possible trigger. The root cause was not inspected or established. One hypothesis is a daemon inheriting the command's output descriptors, keeping collection open after the shell exits; distinguish this from merely delayed notification delivery before changing anything.

Workaround used: confirm committed setup had finished through its readiness/seed/balance log, then independently confirm checkout compose ownership and live API readiness. Stop only the VM started for this trial after its owned containers/services are stopped and no other containers remain. No output-descriptor or runtime configuration was changed.

[Packet](~/dev/arkhai/arkhai-payments/docs/attachments/ledger-on-formance/drive/index.md) records product setup and cleanup. Replay with a stopped existing Podman machine and separate `podman machine start`/product setup calls; compare shell exit time, forwarded child lifetimes and tool notification time. Avoid interpreting a long-lived collector alone as unfinished product setup.
