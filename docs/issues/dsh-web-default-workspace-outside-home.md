# dsh Web default workspace escapes isolated DSH_HOME

During supervised setup of a fresh worker-owned `DSH_HOME`, `dsh web` created its
session workspace at `/Users/mlegls/Documents/deepseek-harness/default-workspace`,
outside both the checkout and the isolated home. Setting `DSH_HOME` and passing
checkout-owned Cordis overlays did not change this. A model-backed Web turn then
wrote `MEMORY.md` there without being asked to persist anything. Its contents
matched the one file created in this encounter; that file was removed. No other
workspace files were changed.

Observed workaround so far: stop before model-driven workspace writes; explicitly
select or create a checkout-owned workspace in Web before resuming an agent. This
needs a supported setup option or a deterministic owned-workspace preparation
step before a fresh verifier can safely use file-capable presets.
