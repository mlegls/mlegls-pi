# Idle pi cost inside zmx

On this 24-GiB Mac, 30 idle threads cost about **11.5–12.3 GiB of physical footprint**, including their MCP subprocesses. CPU is small: **0.15–0.21 of one core**. Restarting a text session reaches a responsive editor in roughly **1–3 seconds**.

Recommend **reaping after 15 minutes idle and unviewed**, but only when no unattended wake depends on the pi process. Until the registry owns wake-on-mail, keep waiting workers and parents resident. This is a recommendation, not an implemented policy switch.

## Results

[Post-turn samples](warm.json): restore a real session, complete one no-tools model turn, detach, settle 15 seconds, then sample for about 60 seconds. RSS is median (range), in MiB; CPU is cumulative process CPU time divided by sampled wall time, where 100% means one core.

| Cost per unviewed thread | Short session | Long session |
| --- | ---: | ---: |
| pi RSS | 118 (105–191) | 155 (84–274) |
| pi + zmx + MCP tree RSS | 219 (204–292) | 316 (184–456) |
| pi idle CPU | 0.50% | 0.71% |
| Whole-tree idle CPU | 0.50% | 0.71% |
| pi physical footprint, at end | 221.7 MiB | 248.4 MiB |
| pi physical footprint peak | 267.2 MiB | 292.6 MiB |
| zmx daemon physical footprint | 3.3 MiB | 3.4 MiB |
| MCP subprocess footprints, summed | 166.3 MiB | 167.5 MiB |
| Whole-tree physical footprints, summed | 391.3 MiB | 419.3 MiB |
| 30 × pi median RSS | 3.46 GiB | 4.53 GiB |
| 30 × whole-tree median RSS | 6.41 GiB | 9.26 GiB |
| 30 × whole-tree physical footprint | 11.46 GiB | 12.29 GiB |
| 30 × idle CPU | 14.9% of one core | 21.3% of one core |

The machine already had 10.9 GiB in swap at the start. Compression/eviction makes RSS move substantially without corresponding allocation changes. `vmmap -summary` physical footprint is the better budget here, not just resident pages. Summed per-process footprints/RSS are budgeting estimates, not a measurement of incremental system memory with 30 copies running. Shared native Cua service, existing browser, terminal app, auxiliary terminals and active tool/model work are outside these trees.

[Fresh resume trials](resume.json), three launches each, hot filesystem/package caches:

| `zmx attach <new-name> pi --session <copy>` → editor echoes typed draft | Short | Long |
| --- | ---: | ---: |
| Individual trials | 1.445, 1.457, 1.590 s | 1.758, 2.987, 1.335 s |
| Median | **1.457 s** | **1.758 s** |

This starts a new pi, not a reattach to a still-running pi. Timing excludes copying the input file and ends after the normal extension footer has appeared and a unique, unsubmitted draft has been rendered in response to typed input. The later actual model turns completed normally in 6.69 / 6.59 seconds; those network/model times are not resume latency.

[Image-heavy file, text-terminal control](image-file-text-terminal.json): a 53.5-MiB, 153-message, 34-image session resumed in **5.318 seconds**, with images displayed as placeholders. After settling, pi RSS was **81.5 MiB median (70.6–84.2)**, physical footprint **363.6 MiB** (peak 484.8); full tree footprint **534.2 MiB**, or **15.65 GiB for 30**. Idle tree CPU was 0.53% of one core. No model turn was submitted for this control.

## Inputs and method

Measured 2026-10-01, source revision `70540b62467b695d1bccc83f9b814025c2ec1f03`, macOS 15.6.1 / arm64, 14 logical CPUs, 24 GiB RAM. Installed pi **0.99.1** runs via the machine's Bun wrapper (**1.4.2**); zmx **0.8.1** uses its bundled libghostty-vt.

| Seed | Source session id | File size | Recorded history |
| --- | --- | ---: | --- |
| Short | `01a0dbcd-a454-7540-809e-dd39b779a770` | 51,680 bytes | 89 seconds; 7 messages, 2 assistant messages, no compaction |
| Long, text | `01a0f065-abaf-776c-bc8b-419cb9b312e4` | 5,820,026 bytes | 14.3 hours; 1,233 messages, 680 assistant messages, 11 compactions |
| Large image file | `01a0f0b5-8fcd-7529-b379-4e065ad96603` | 56,096,761 bytes | 6.7 hours; 153 messages, 72 assistant messages, no compaction |

Message totals include user, assistant, tool-result and system messages, not just user turns. JSON packets contain source SHA-256, header id, pid/ppid joins, per-process RSS and cumulative CPU samples, and footprint lines. The short post-turn model was `openai-codex/gpt-6-sol`; long was `anthropic/claude-opus-5-5`, restored from their seeds.

Normal machine configuration remained enabled: this package's eight configured extension entrypoints, machine-level extensions (including Orca/Herdr/workmux hooks), pi-anthropic-auth, pi-better-skills, and both configured MCP clients. The eagerly started per-pi children were `cua-driver`, `chrome-devtools-mcp`, and its `node` child. Host-specific pane variables were removed so the probes did not manipulate the spawning worker's pane or hooks. No extension-disable/offline flags were used.

Each source is copied to a temporary file with a fresh session id and measurement cwd; only copied spawn ownership and board subscriptions/cursors are neutralized. Entry ids, tree parent links, conversation payloads and compactions remain intact. Original source files are never opened for writing. The normal board timers still run, with a fresh mailbox and measurement-worktree scope.

A real 120×40 PTY runs zmx, with xterm device/cursor-query responses and `PI_IMAGE_PROTOCOL=none`. The zmx list's `pid` identifies **pi**, not the daemon; its parent is the zmx daemon. After detach, `clients=0` is checked, and all daemon descendants are joined by pid/ppid. Every trial is killed in `finally`; the isolated socket directories ended with no sessions.

These are restored histories followed by one real turn, not 14 hours of continuously running the same measured process. They establish retained-history cost and post-request idle cost, not an upper bound on tool/image/native-parser high-water memory. The long text session's last compaction keeps its active request much smaller than its complete saved transcript.

A discarded pilot inherited Ghostty image detection into a non-rendering PTY: the 53.5-MiB file emitted Kitty image data and did not reach the footer within 120 seconds, twice. That is not a valid Ghostty GUI timing; explicitly disabling image rendering produced the successful text-terminal control above. Actual Ghostty image decode/display and cold boot/catalog-download latency are not claimed.

## Policy

15 minutes is a grace-period choice, not an experimentally fitted optimum. A 1–3-second text reload (about 5 seconds for the large image file without display) is a reasonable occasional cost to release hundreds of MiB per unattended thread. CPU alone would not justify reaping. With 30 threads, memory does.

“Idle” must mean settled, with no model/tool/observer/subagent work in flight; “unviewed” must mean zero attached agent clients. Reset the deadline on work or view. Reaping should not restart the thread's automatic pi restart loop, and should stop its private MCP clients as well as pi. Leave auxiliary terminals alone.

The board poller and child-exit monitor currently live in pi. A parent waiting for children or a `needs-input` worker still needs those wakes despite being idle/unviewed. **Keep those resident until wake-on-mail exists outside pi**; don't introduce a blanket reap-on-view policy in this cutover. Follow-ups:
- [[projects/mlegls-pi/issues/idle-thread-reaping-needs-external-board-wakes]]
- [[projects/mlegls-pi/issues/per-thread-idle-mcp-client-cost]]

## Reproduce

Required target: this machine's installed pi/settings/extensions and saved local sessions. Prepared target: disposable sessions and zmx daemons owned by this worktree; no registry threads, existing session files, browser pages or app windows were changed. The completed post-turn runs used existing local provider authentication. No credentials are copied into artifacts. Without `--turn`, there is no submitted model request.

From the committed checkout, this exact entrypoint reproduces the main post-turn encounter (about three minutes); it creates, opens, measures and stops both TUIs:

```sh
mise x zmx@0.8.1 -- uv run --no-project python docs/attachments/measure-idle-pi-cost/measure.py \
  --small "$HOME/.pi/agent/sessions/--Users-mlegls-dev-mlegls-pi--/2026-09-26T03-41-22-389Z_01a0dbcd-a454-7540-809e-dd39b779a770.jsonl" \
  --large "$HOME/.pi/agent/sessions/--Users-mlegls-dev-mlegls-pi--/2026-09-30T03-39-50-063Z_01a0f065-abaf-776c-bc8b-419cb9b312e4.jsonl" \
  --trials 1 --turn --output /tmp/idle-pi-warm.json
```

For the three resume-only trials, omit `--turn` and use `--trials 3 --samples 3`. For the image-file control, replace `--large` with the local session filename containing the image seed id above; omit `--turn`. The private session transcripts are deliberately not committed; another machine can supply its own `--small` / `--large` files.

Checks: `bun-axi test` **167 passed, 2 skipped**; `bun-axi run typecheck` passed after installing the existing nested package's locked dependencies with `bun install --frozen-lockfile --cwd extensions/obsidian-tracker`. Initial missing Obsidian typings are already owned by [[projects/mlegls-pi/issues/root-setup-still-omits-obsidian-typecheck-dependencies]]; no source workaround was added. No new permanent acceptance tests or runtime policy code.

Tracker structural/link check still reports the same 20 historical dangling links as [[projects/mlegls-pi/issues/tracker-check-links-to-deleted-history]]; none targets this packet or its new issues. No historical link was edited or checker relaxed.
