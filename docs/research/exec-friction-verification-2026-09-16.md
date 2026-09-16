# Exec friction verification — 2026-09-16

Scope: runtime, source/edit, board, and browser-tool reports from local development.
Checks use the public Kernel, importable board store, CLI, and isolated browser
sessions. Reported symptoms are distinguished from reproduced defects.

## Runtime and source

| Report | Finding and disposition |
| --- | --- |
| Repeated scratch declarations and capability shadowing | Verified against cell-local runtime `7c98fed`: scratch names can repeat, persistence uses `state`, API names are reserved at cell top level, nested shadowing does not poison later cells. Old persistent-REPL diagnostic patch discarded. |
| Cooked shell templates lose backslashes | Standard JavaScript cooking, not a custom scanner. Raw-first guidance is now in the tool description and README. Raw tags still interpolate expressions and obey template delimiters. |
| grep options in second position fail | Fixed; options may occupy the second argument when paths are omitted. |
| read/selection cannot compose into grep | Fixed; either selects files to search afresh, not a row-restricted search. |
| File contents used as a path flood the error | Reproduced an 80,000-character path error. Errors are now bounded with a path-versus-content hint. |
| Reading a directory gives no useful hint | Reproduced EISDIR, not ENOENT; now explicitly says to use find or read a file. |
| lines().map/join fail | Added map and plain-text join while preserving provenance for selection operations. |
| Blank-line insertion fails | Fixed: empty before/after insertion means one blank line. Empty replacements still require explicit deletion. |
| Range replacement duplicates the next line | No engine off-by-one reproduced. Ranges are inclusive; reported replacement included text outside its range. No fuzzy deduplication added. |
| Large source values truncate | 60,005-byte text and an 18,638-row, roughly 910KB patch retained all text/rows. Display limits do not truncate retained source. Larger line counts exposed the separate anchor-capacity defect below. |
| Large/repetitive files hang | Confirmed: one preferred anchor prefix had only 32,768 names and allocation retried forever when full. Duplicate lines also restarted collision search. Fixed with tracked occupancy, bounded scanning, and spill into other prefixes. Four-character global capacity is 1,048,576. Public-Kernel 950KB / 50,000 identical-line reads took 0.67–1.16s after the fix, under a 10s cancellation bound; restored anchors and disappeared-target stale rejection also passed. |
| Brace globs / node_modules searches fail | Brace globs work. Ignored trees are omitted from root discovery; explicitly naming the ignored tree in find paths enumerates it. |

Existing limitation: line-diff reconciliation cannot distinguish identities of
repeated identical rows after external changes. This was not changed by the
allocator fix; an old anchor may follow another text-identical row.

## Board

- Tag arrays already worked through exec, but the importable query/store path
  still threw `source.trim is not a function`. Both now accept arrays as AND.
- Compact reads omit data and bound body snippets; truncation is explicit.
  Results expose total matches so omitted older messages can be requested.
- Added `bun lib/board.ts` for other harnesses. Cursor-based waits require an
  offset captured before startup; default importable waits remain from-now.
- Reproduced spawn timing with a ticking poller and a controlled workmux command
  that published a report two seconds before returning. Early Worker registration
  preserves that report. A real local workmux integration run also passed.
- Reads/waits still do not acknowledge reports. Zero-limit reads return no
  messages; invalid numeric CLI bounds are rejected.

## Browser CLI (external dependency)

Initial verification used installed `chrome-devtools-axi@0.1.34`; the later
installation follow-up below replaces it with the pinned fork.

- **Confirmed:** scroll, numeric waits, and scripted selector actions send
  expressions/IIFEs where MCP requires callable functions. Actions can execute
  before the misleading `fn is not a function` error; do not blindly retry.
- Fix preserved in `patches/chrome-devtools-axi-scroll.patch`, based on upstream
  `d0834b6`; fork commit `da94d49`. Upstream PR:
  https://github.com/kunchenguid/chrome-devtools-axi/pull/142.
- Patched checkout: build and 631 existing tests passed. Real-browser smoke
  verified scroll down, numeric waits, selector click exactly once, fill with
  input/change events, and immediate/delayed selector waits. Sessions stopped.
- **Not reproduced:** newpage selected its new page in two fresh-session probes.
- A single installed-CLI eval that clicks and immediately reads text captured a
  220ms “Sending…” state. This provides text evidence without a CLI round trip;
  timed screenshot capture was not verified or added.

Do not apply the source patch directly to installed dist files.

### Installation follow-up

Global mise now pins `mlegls/chrome-devtools-axi#2386fcf0fc3e20f818f546db9aab019c1ad21edd`
(`0.1.34-mlegls.1`). This packaging commit builds the tested `da94d49` source and
includes dist on the separate `installable-callable-browser-scripts` fork branch;
the upstream PR stays source-only. The pin is tracked in system-config.

Build and all 631 upstream tests passed again. Smoke through the installed command
verified a 500px scroll, CLI numeric wait, selector click exactly once, fill, and
immediate/delayed selector waits. The isolated smoke session was stopped. A fresh
login shell resolves the fork; already-running processes keep their old PATH
until restarted, or can invoke `mise exec -- chrome-devtools-axi`.

## Final checks

- `PI_TEST_LOCAL_WM=1 bun test`: 132 passed, 0 failed, including real local
  workmux/exec spawning, waiting, and cleanup.
- The board cursor regression fixture runs in its own process; changing its
  process-global board path had initially contaminated a later integration test.
- `tsc --noEmit` still reports five errors in untouched files:
  `extensions/exa/index.test.ts` (fetch mock), `extensions/session/tmux.ts`
  (nullable subprocess streams), and `extensions/system-prompt/index.test.ts`
  (optional callable). The changed board query/service boundaries type-check.
