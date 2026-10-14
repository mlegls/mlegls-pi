---
stage: "idea"
assignee: "agent"
author: "session:01a13a22-4836-7352-8bf8-7f040ebe6433"
---
Observed while implementing SCM #281 under a supervised worker: a managed process running mise exec python@3.13 -- python3 reports Python 3.13, while the same selector followed by /bin/sh -c "python3 --version" or /bin/zsh -f -c "python3 --version" reports system Python 3.9.6. Make recipes consequently fail importing tomllib before setup/tests/checks run. The bash tool with the same selector and nested shell preserves 3.13. Tried mise around make, the direct Xcode make executable, an explicit make PATH assignment, and unsetting BASH_ENV/ENV; all retained the failure. Cause not established; inspect shell-launch PATH handling in the process tool versus bash. Workaround: invoke repository Python setup/check scripts directly with mise-selected python3, and uv-run tests without make. This is tooling environment evidence, not a product regression. Origin session: 01a13a22-4836-7352-8bf8-7f040ebe6433.
