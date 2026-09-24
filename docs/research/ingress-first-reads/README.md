# Bash-tool first reads, 2026-09-24

Every sustained bash-tool session since 09-23 went raw within its first 2–8 calls and never went back (≥85% of bash calls with `raw: true`; one `ab pull` across all of them). Each flip followed the first filtered result: an orientation read the agent had asked for (`git log; ls docs/issues`, `cat` of two cloned READMEs, `pwd; ls -la; rg`, reading back a just-written `design.md`) came back as `[keyword cues; not assertions]`. The reasoning said so: "I notice the output got filtered significantly, so I should rely on the raw response instead." Agents reran the command raw rather than pulling.

Exec over 316 sessions since 09-20 drifts the same way but far less: ~40% `show.raw` in a session's first fifth to 56% in its last, 16 sessions ≥90% raw, pulls in 90. Pages in bash sessions were cues 16% of the time, in exec 6%. Exec chooses raw per value and usually shows something already narrowed; a bash call is typically a multi-command dump that the lexical chunker leaves as one chunk, so one cues judgment degrades the whole output.

## Change

The fidelity question gained: "Names are not gist: when the current command asks to see names (a listing, paths, a log, grep matches, a status), the reader acts on those names next and token deletion destroys them, so keep what it can act on verbatim and omit the rest. Reading back what was just written, or what is about to be edited or checked, is verification: verbatim." Omission notices now carry up to three chunk labels, so an omission can be priced without a pull. The bash tool description says a skim is not evidence for edits, to pull rather than rerun, and offers per-command `ab raw`.

## Replay

`bun docs/research/ingress-first-reads/replay.ts 2` re-judges recorded chunks from local session logs (specimens are not copied here). Two runs each, byte share kept:

| need | specimen | recorded | before change | after change |
|---|---|---|---|---|
| exact | `pwd; git status; ls -la; rg chrome` 1.7 KB | 25% cues | 75% skim75 | 100% verbatim |
| exact | `pwd; ls -la; find calc.ts` 1.5 KB | 25% cues | 25% cues | 100% verbatim |
| exact | `ls; git log` 1.8 KB | 25% cues | 25% cues | 100% verbatim |
| exact | `cat` two READMEs 3.2 KB | 25% cues | 25% cues | 100% verbatim |
| exact | `git log; ls docs/issues` 4.7 KB | 25% cues | 25% cues | 100% verbatim |
| exact | read back `design.md` 4.4 KB | 71% | 72% | 85% (one skim50 and the `ls -l` line omitted) |
| exact | `grep -rl; ls` 0.6 KB | 25% cues | 25% cues | 100% verbatim |
| exact | `grep -n` definitions 7.4 KB | 39% | 39–52% | 100% verbatim |
| skim | `exa-cli search` 1.3 KB, 0.9 KB | 25% cues | 25% cues | 100% verbatim |
| skim | pgrep/ls dump 41 KB | 27% | 23–25% | 22% (verbatim×3, omit×12) |
| skim | session scan 41 KB | 3% | 3–5% | 4–14% |

Large dumps keep about the same bytes, now as exact passages plus labelled omissions instead of cues. Small search results go verbatim, about 1 KB each. Untested: whether agents stay off `raw` in live sessions; the audit is to drive a session without `raw` and count pulls and anchors skimmed before an edit.
