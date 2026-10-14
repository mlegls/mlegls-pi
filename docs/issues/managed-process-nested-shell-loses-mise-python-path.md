---
stage: "idea"
assignee: "agent"
author: "session:01a13a22-4836-7352-8bf8-7f040ebe6433"
---
Observed while implementing SCM #281 under a supervised worker: direct mise exec python@3.13 -- python3 reports Python 3.13, while nesting /bin/sh -c or /bin/zsh -f -c reports system Python 3.9.6 in the managed process tool. The bash tool preserves 3.13 for the same nested command. Make recipes fail importing tomllib. Tried mise around make, the direct Xcode make executable, a make PATH override, unsetting BASH_ENV/ENV, and SHELL=/bin/bash; all failed. Direct repository Python setup/check scripts work. A temporary Make SHELL wrapper that evaluates mise env inside the shell after startup also restores Python selection, and is being used for the actual packaging target. Cause not established; inspect process versus bash shell-launch environment handling. Origin session: 01a13a22-4836-7352-8bf8-7f040ebe6433.
