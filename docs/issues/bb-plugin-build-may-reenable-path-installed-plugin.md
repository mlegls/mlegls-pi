---
stage: "idea"
assignee: "agent"
author: "session:thr_g43xzszmtb"
---
A local build and an installed plugin can share the same source directory. While developing native supervision tools, the supervisor reported that `bb plugin build .` kept re-enabling the plugin on the shared BB after it was disabled. Three new Pi workers failed because the old Pi extension and the newly installed plugin both registered `dispatch`, `integrate`, `reconcile_*`, and `pickup_*`. The plugin was uninstalled; a disposable BB was used for verification instead.

The developer had also run `bb plugin install` and `bb plugin config` for the same source, so the operation that restored the enabled state is unisolated. Can build of a path-installed plugin affect enabled state on its own, or does this require install, settings, or source recognition? The build help says no server is required. Expected: a local build should leave the installed plugin's enablement unchanged.

Origin: @thread:thr_g43xzszmtb (worker) and @thread:thr_dfgkcug6jp (supervisor).
