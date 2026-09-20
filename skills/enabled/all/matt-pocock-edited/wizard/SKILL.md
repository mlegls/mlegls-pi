---
name: wizard
description: "Use when a task needs a staged human setup flow for dashboards, credentials, consent, or physical actions."
---

[template.sh](template.sh) provides staged progress, URL opening, confirmations,
hidden secret entry, `.env` upserts, and GitHub secret/variable writes.

1. Complete the agent-accessible work and identify the remaining human steps.
2. Copy the template and author stages below `STAGES` using the actual
   dashboard paths and value destinations. Open the URL before requesting
   its value. `ask_secret` captures secrets; `write_env` writes local values;
   `set_secret` and `set_var` supply CI. `confirm` handles irreversible actions.
3. Check the script with `bash -n`, make it executable, and give the user its
   invocation. The staged flow can resume after a person stops halfway through.

The script is ephemeral unless repeatable setup is part of the deliverable.
A single human action can remain a direct instruction.
