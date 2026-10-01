# Independent CLI encounter

## Predictions before first use

Driver: `measure-idle-pi-cost-drive-5`, session `01a0f6fe-6d12-77be-89c4-cc7dcd0cbf03`. Tested revision: `8378ecd9cb04db4308f121ae10119606ef9b6ae6` (the implementation and tests were not read).

Persona: local maintainer deciding whether 30 unattended pi threads fit this 24-GiB Mac. Surface: documented benchmark CLI and its JSON report, not a native terminal-window journey.

1. **Idle short/long cost.** Running the exact documented post-turn command should complete both real authenticated turns, detach each disposable zmx session (`clients=0`), report pi and whole-process-tree RSS/CPU plus physical footprints, and stop all owned subprocesses. Expected scale: pi about 100–200 MiB median RSS; whole-tree footprint about 0.4 GiB; CPU below 2% of one core per thread. The long history should remain measurable, not fail to resume.
2. **Fresh resume latency.** The documented resume-only variant should produce three short and three long timings from new process launch to a responsive draft editor, roughly 1–3 seconds for text histories. A reporting command succeeding alone would not establish the timing endpoints; the packet should identify fresh process ownership and interactive readiness.
3. **Policy.** The report should let a maintainer extrapolate to ~30 threads and recommend either no reaping or a concrete timeout. Expect the 15-minute idle/unviewed recommendation, with waiting parents/workers explicitly exempt until external wakes exist, and no claim that a timer policy was implemented.

## Setup checked before opening product

- Local macOS 15.6.1/arm64; memory 25,769,803,776 bytes; swap already 11,043.75 MiB used.
- Worktree: `/Users/mlegls/dev/mlegls-pi__worktrees/measure-idle-pi-cost-drive-5`.
- Installed `pi` resolves to the local Bun wrapper; `mise`, `uv`, and `zmx@0.8.1` are available. No package installation or configuration change needed.
- Authentication: existing local provider credentials, exercised only through the authorized one-turn benchmark; no credential values inspected or copied.
- The documented short/long seeds exist, sizes 51,680 and 5,820,026 bytes. Pre-run SHA-256: `10cebf313bf18f060051a53a3f390cde30b2eed364864eb553c5dbf782ed0d3d` and `5da7ae04c35f3865c5a0f5304357a7194a4c6bfc9bb3a5b661aa5f66c6e6a10d`.
- Default zmx listing was empty. Inherited host selector names include TMUX/TMUX_PANE, Ghostty and worker variables; the documented entrypoint promises host-selector removal and isolated measurement socket directories. No inherited sessions or windows will be controlled. Ownership will be checked from the generated report and process readback.
- Target/seed: temporary copied sessions and private zmx daemons belonging to this worktree. Originals read-only. Entry point: the Reproduce command in [index.md](index.md), with output redirected to this worktree's scratch directory.

## Encounter log

Predictions above were recorded before invoking the benchmark. Results follow as observed.

### 1. Post-turn idle measurement — held

Ran the exact documented command with `--trials 1 --turn`; only `--output` changed to `$PWD/.wm/idle-cost-drive/warm.json`. Started 2026-10-01 18:26:00 +0800. Exit 0 after 183.9 seconds. [Raw report](drive-warm.json), [captured console](drive-warm-console.txt).

Both provider turns ended with `stopReason: stop`: short `openai-codex/gpt-6-sol` in 10.201 seconds, long `anthropic/claude-opus-5-5` in 4.933 seconds. These are not the restart timings. Reported extension child trees contain zmx → Bun/pi → cua-driver and chrome-devtools-mcp → node.

| Post-turn replay | Short | Long text |
| --- | ---: | ---: |
| Pi median RSS, MiB | 82.36 | 80.20 |
| Pi RSS range, MiB | 67.91–187.30 | 42.23–122.59 |
| Whole-tree median RSS, MiB | 179.48 | 178.23 |
| Whole-tree idle CPU, % of one core | 1.48 | 2.27 |
| Sampled wall-time window, seconds | 61.479 | 63.920 |
| Whole-tree physical footprint, MiB | 363.00 | 419.46 |
| 30 × whole-tree physical footprint, GiB | 10.63 | 12.29 |
| Fresh usable editor, seconds | 1.7165 | 1.5770 |

Derived RSS medians directly from reported process samples; CPU from the difference in summed cumulative process CPU over the first/last sample interval; footprint from the summed non-peak `vmmap` lines. These are replay observations, not corrections to the earlier measured run. Replay began with 12,208.75 MiB swap used in its report; this is a shared, already memory-pressured host.

Ownership joins: short name `idle-cost-59125-small-1`, daemon 60286, pi 60298, children 62422/62423/63687; long `idle-cost-59125-large-1`, daemon 23822, pi 23823. Each pi's reported parent is its named daemon. No registry-thread selector was used.

### 2. Fresh resume measurement — held

Ran the same documented seed command, omitting `--turn` and using `--trials 3 --samples 3 --output "$PWD/.wm/idle-cost-drive/resume.json"`. Started 18:29:36 +0800. Exit 0 after 238.5 seconds. [Raw report](drive-resume.json), [captured console](drive-resume-console.txt).

| Responsive-editor replay timings | Short | Long text |
| --- | ---: | ---: |
| Trials, seconds | 2.0550, 1.7818, 1.8032 | 2.6361, 2.6855, 4.0552 |
| Median, seconds | 1.8032 | 2.6855 |

Each of the six trials has a distinct zmx name, daemon pid and pi pid, with the corresponding process-parent join in the report. `warm_turn` is false. Footer and usable-editor times are separate fields; all usable times are later than footer times. The CLI reports the responsive-editor endpoint; this drive did not inspect the script or independently watch a native TUI. No native image-render or cold-start latency is established here. The additional image-heavy control was not rerun; the required large-session story used the documented long text seed.

### 3. Budget and policy — held

As a maintainer I can reproduce a per-thread retained-history cost, multiply by 30, and find a concrete recommendation in the index: 15 minutes idle and unviewed, only for quiescent threads with zero attached clients; leave waiting parents/workers resident until external wake-on-mail exists. The replay's 10.63–12.29 GiB process-footprint budget supports the same memory concern on a 24-GiB machine. The timeout is clearly identified as a choice, not a measured optimum. No timer/reaper implementation is promised by this ticket.

### Cleanup and source preservation

After both commands, both reports have empty `remaining_sessions`; their private scratch directories (`idle-cost-im831zdm` and `idle-cost-uyew6v84`) no longer exist. Independent `kill(pid, 0)` readback found **none of the 40 unique sampled pids running**. Default `zmx list` still reports no sessions. Both original seed SHA-256 values are exactly unchanged from setup. No browser, native app, server or tunnel was opened by this driver.

## Expectations and frictions

- **Met:** authorized command completes both real turns, reports costs for both restored histories, and leaves no measured process behind.
- **Not met numerically:** predicted 100–200 MiB median pi RSS and CPU below 2% per thread. Actual pi RSS medians were ~80 MiB; long idle CPU was 2.27%. This illustrates the report's existing warning about compressed/evicted RSS and the absence of a CPU bound, not a failure to measure.
- **Partly met:** fresh text resume normally lands in 1–3 seconds; one of six resume-only trials took 4.0552 seconds. The command remained usable and completed; these are not strict latency promises.
- **Met:** 30-thread budget remains multi-GiB, with a concrete, qualified policy recommendation and no runtime-policy change claimed.
- **Not met:** expected captured CLI progress to identify each completed trial. Warm console only retained the cleanup line; resume console retained cleanup plus a cut-off `e 2 usable...` line and the final trial pair. Reading JSON was the workaround. Filed [[projects/mlegls-pi/issues/idle-cost-benchmark-console-and-readiness-evidence]].
- **Friction:** the JSON packet has no explicit `clients=0` or typed-draft witness, so a user reading the evidence can see names, process joins and endpoint numbers but cannot independently replay the interactive endpoint from the packet alone. The same issue owns this evidence improvement. This driver trusts the documented CLI contract rather than claiming a visual observation.

## Replayable checks for the reviewer

1. **Authorized warm encounter and cleanup.** Run the Reproduce command from this worktree with a worktree-local output path. Accept: exit 0; exactly small/large trials; both warm turns `stop`; each pi parent joins its recorded daemon and the reported MCP children; samples span about 60 seconds after settlement; footprint commands succeed; `remaining_sessions` empty; none of the sampled pids still exists. Compare seed SHA-256 before and after; accept equality.
2. **Fresh-resume endpoint.** Run the documented three-trial variant. Accept: six unique trial names and pi/daemon pairs, no warm turn, finite positive usable timings later than footer timings. Independently observe the PTY readiness path: a unique unsubmitted draft appears after the normal footer, and the elapsed value starts at new zmx/pi launch, not reattach. Persist a minimal sanitized witness for that assertion and `clients=0` before idle sampling; this drive could not independently see those witnesses in JSON.
3. **Arithmetic.** For each warm trial, compute median pi RSS and tree RSS from `rss_kib`; compute CPU from last-minus-first cumulative CPU divided by last-minus-first elapsed time; sum non-peak footprint lines and multiply by 30/1024. Accept agreement with the replay table to rounding precision. Do not require agreement with an earlier RSS sample on a compressed-memory host.
4. **Captured-output integrity.** Redirect stdout/stderr as in this drive while running a two-trial and a six-trial encounter. Accept one intact label/trial progress line per completed trial, followed by cleanup, with no earlier text overwritten. This replay does not meet that acceptance.
5. **Policy interpretation.** Read Result/Policy using only the ticket and index. Accept: a concrete timeout recommendation, explicit settled/zero-client criteria, waiting-parent/worker exemption linked to external wake ownership, and no suggestion that this documentation enables a runtime reaper.

No tests or product repairs were made by this driver. This is CLI/report evidence (`visual: false`), not an acceptance of native rendered TUI appearance.

## Review

Reviewer: `measure-idle-pi-cost-review-6`, after the driver's log above (left as written).

- **Console progress (driver check 4): reproduced, cause found, fixed.** Ran `measure.py` with `> console.txt 2>&1`, two trials, `--samples 1`: console held only `no sessions found …` plus a cut-off `e 2 usable …`. The final `zmx list` (for `remaining_sessions`) let zmx write that line to the inherited stderr, and zmx writes with positional writes, so it overwrote the file from offset 0. `command()` now captures stderr (errors still surface through `CalledProcessError.stderr`). Replay of the same run: four intact progress lines, `rc=0`, `remaining_sessions` still `""`.
- **Endpoint witnesses (driver check 2): added to the JSON.** Each trial now has `footer_marker`, `probe_echoed` and `clients_after_detach`. The script already raised if the footer or probe never appeared or if `clients=0` failed, so these record that rather than add a new check; they are not independent visual observation. In the review replay all four trials report `clients_after_detach: 0` and the probe string; fresh-resume times were 2.66 / 2.33 / 1.83 / 1.98 seconds (small, large text, small, large text), consistent with 1–3 s.
- **Cleanup:** no `idle-cost` process remained after each run; both seed SHA-256 values equal the setup values above. A first review edit had a typo that crashed a trial; its `finally` killed the zmx session and leftover pi (confirmed gone).
- **Left as evidence, no automated test:** a disposable local measurement script needing real pi/zmx/auth guards no product behavior, so no suite test was added.
- Arithmetic (check 3) and policy reading (check 5) re-read against `warm.json` and `index.md`: unchanged and consistent.
