---
stage: done
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
priority: 2
---

Find out whether zmx's reattach redraw is acceptable with pi attached, in Ghostty. pi draws differentially in the main screen rather than the alternate screen, which is the harder case for state replay. `mise use zmx` (or `nix shell nixpkgs#zmx`) for a one-off.

Run pi in a zmx session and get some scrollback, detach, reattach, then resize while attached and while detached. Compare the screen and native scrollback against pi run directly. Same for one alt-screen tool (lazygit or nvim) as a control.

The answer decides [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]]'s main area. If the redraw is good, the fork can close surfaces and reattach on every thread switch. If not, it keeps an LRU of live offscreen surfaces and reattaches only on a cache miss.

## Result

**Reattach is acceptable for the observed pi main-screen workload. Prefer closing surfaces and reattaching on thread switches; this run found no rendering reason for an offscreen-surface LRU.** This is a correctness observation, not a switch-latency measurement or a guarantee for every TUI.

Observed on macOS 15.6.1, Ghostty 1.3.1, pi 0.99.1, zmx 0.8.1 (one-off Nix shell; embedded ghostty-vt 1.3.2-dev), and nvim 0.12.4. Separate Ghostty processes displayed a synthetic 90-row pi session, offline without a model request, and a 150-line nvim file.

## Evidence

Artifacts and runnable fixtures: [packet index](../attachments/check-zmx-reattach-with-pi/README.md).

| Encounter | Observation |
| --- | --- |
| Pi direct vs zmx, before detach | Same visible ROW-077…090, end marker, warning, editor and footer. |
| Pi detach → fresh Ghostty reattach, same size | Session stayed alive with zero clients, then one client. Same visible screen; `pi-before.vt` and `pi-reattached.vt` are byte-identical (35,167 bytes). |
| Pi native scrollback | Direct and reattached screenshots both expose the specimen heading and ROW-001…010, not just the current viewport. Direct additionally has its login-shell preamble. |
| Pi resize while attached | At approximately 720×500 points, direct and zmx both show ROW-082…090 with matching wrapping and intact editor/footer. |
| Pi resize between detach and reattach | New 506×377-point surface shows correctly wrapped ROW-088…090, end marker and editor/footer. All 90 distinct row labels remain in each resized VT snapshot. The PTY receives the new dimensions on attach, not while it has no client. |
| Pi differential update after reattach | A local `!printf 'LIVE-AFTER-REATTACH\n'` command rendered its command/output and left the editor intact. |
| Nvim alternate-screen control | Initial direct/zmx screens match. Attached and detached-size-change captures show intact text, wrapping and status line. A controlled same-size reattach at 506×377 points matches direct visually and preserves the VT snapshot byte-for-byte. |

## Limits

The first nvim baseline and later reattach had different cursor positions (1 vs 147), so that pair is not treated as a preservation test; intervening input was not controlled. The final controlled pair is the preservation evidence. Native alternate-screen scrollback was not separately verified.

Cua's background scroll delivery was marked unverifiable; the resulting pi screenshots establish visible early-history content, not precise wheel behavior or preservation of the user's scroll offset. No streaming model response, large tool output, repeated rapid switches, selection/search state, or replay latency was measured. These limits are accepted for this prototype's redraw decision.

## Danger

**Door:** two-way. Documentation and fixtures only; no application or repository configuration changed.
**Blast radius:** local. All owned zmx sessions and Ghostty instances were stopped; the existing Ghostty process and unrelated zmx sessions were left alone.
