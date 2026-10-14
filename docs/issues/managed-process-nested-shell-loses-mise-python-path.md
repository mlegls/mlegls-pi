---
stage: "idea"
assignee: "agent"
author: "session:01a13a22-4836-7352-8bf8-7f040ebe6433"
---
Observed while implementing SCM #281: managed process mise exec python@3.13 -- python3 reports 3.13, but a nested shell finds system Python 3.9.6; bash tool preserves 3.13 for the same commands. Make recipes fail importing tomllib. Tried direct Xcode make, make PATH assignment, unsetting BASH_ENV/ENV, SHELL=/bin/bash, and a temporary shell wrapper evaluating mise env; none fixed the recipes. Direct repository scripts work. Confirmed workaround for actual Make targets: export PATH="$(mise where python@3.13)/bin:$PATH" in the managed command before invoking make. With this, check-packaging, check-locks and check-architecture pass. Observation indicates managed shell PATH precedence differs from bash, not an SCM product failure. Cause remains unestablished; inspect inherited PATH/mise activation handling. Origin session: 01a13a22-4836-7352-8bf8-7f040ebe6433.
