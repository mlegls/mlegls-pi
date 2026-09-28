# Retrieval and output limits

Jevgrep replaces implicit output skimming with explicit repository search:

```sh
jg "How does cancellation reach running jobs?" .
```

`bin/jg` runs the pinned package dependency. Run `jg auth` in a terminal to choose
and authenticate a provider; `jg doctor` checks connectivity. Repository content
is sent to that provider. For known names or paths, use exact grep and bounded reads.
Jevgrep excerpts are verbatim but relevance rankings are not completeness guarantees.

Bash output keeps an 8 KiB head and 32 KiB tail; the original remains in the
session's `.ab/out` log. Exec keeps 8 KiB per show call (`show.large`: 32 KiB),
with complete rendered text saved under a private `pi-exec-output-*` temporary
directory. Exec shell streams over 1 MiB also point to their full temporary files.
Grep the indicated file for what is needed rather than reading it whole.
Temporary files survive kernel reset and are subject to the OS's temporary-file
cleanup; bash logs follow session retention.

No model-dependent scoring, token deletion, or local LLMLingua worker runs on reads.
`raw` and `focus` remain accepted for compatibility, without semantic filtering.
`ab pull` can still recover legacy pages from existing sessions; new output uses
file paths. Exec `show.pull` accepts output handles only.

Reload Pi to update the tools and restart the exec kernel. Historical skimming
experiments under `docs/research` refer to the implementation at their git revision.
Other extensions' direct notifications and user messages are outside these caps.
