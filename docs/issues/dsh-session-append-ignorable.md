---
stage: idea
assignee: agent
author: session:01a0e217-e2af-7760-9a10-b4be54db2d0a
---

`@deepseek-ai/dsh-session@0.1.7-rc.2` reads `ignorable: true` in external records but `Session.append()` cannot write it. Its options copy only surface metadata; the resulting event is frozen. Passing `{ignorable: true}` silently loses the marker. Such an external record becomes required-on-read and persistence rejects it on reload.

Encountered in [[projects/mlegls-pi/issues/dsh-memory-compaction-provider]]. The owning repository's issue tracker is disabled: `gh-axi issue create -R deepseek-ai/deepseek-harness` refused the report. Local workaround: `dsh/patches/@deepseek-ai%2Fdsh-session@0.1.7-rc.2.patch` adds explicit marker support to append and its declaration. `bun run --cwd dsh setup` applies it from the pinned lock.

Upstream's implemented note `2026-08-30-retain-ignorable-external-session-events` describes the marker as the external-plugin compatibility seam. Remove the local patch when the public append API can emit it; do not implicitly mark all unknown events ignorable.
