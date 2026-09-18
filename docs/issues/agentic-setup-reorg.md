---
next: wait
priority: 1
---

one harness-integrated library replaces tool calls, most skills, and the split between `~/.config/system-config` (skills, agents) and this repo (exec, lib). functions are orthogonal and composable; project-local exec modules are the plugin surface and upstream by moving the file. the system prompt carries one entry to the library's index. jev is the substrate for decision-tree and coordination logic; language models only where output is freeform or the reasoning is too hard for jev.

evidence for the current state: [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]. summary: parents spend ~60% of context on reading, a quarter of files read are never referenced; coordinator sessions spend 94% of their cost after the first spawn, reading merged results in the main checkout; child reports are small (1.3 KB) and enter unfiltered by board push; the one expensive worker shape is a long opus session steered many times through checkpoints.

substeps, roughly in dependency order:
1. "[[projects/mlegls-pi/issues/decide-primitive]]" — everything jev-backed waits on it.
2. "[[projects/mlegls-pi/issues/session-instrumentation]]" — so later audits are one-liners.
3. "[[projects/mlegls-pi/issues/ingress-filter]]", "[[projects/mlegls-pi/issues/autoread-show-me]]", "[[projects/mlegls-pi/issues/skim-and-triage]]" — what enters context; run in parallel.
4. "[[projects/mlegls-pi/issues/supervision-join-script]]", "[[projects/mlegls-pi/issues/dispatch-script]]" — orchestration as scripts.
5. "[[projects/mlegls-pi/issues/pool-aware-routing]]", "[[projects/mlegls-pi/issues/campaign-coordinator]]".
6. "[[projects/mlegls-pi/issues/skills-triage]]" then "[[projects/mlegls-pi/issues/repo-merge]]".
7. "[[projects/mlegls-pi/issues/home-ui]]", "[[projects/mlegls-pi/issues/operon-adapter]]" — the human surfaces; independent of the rest.
8. "[[projects/mlegls-pi/issues/orchestration-audits]]" — remaining hypotheses; "[[projects/mlegls-pi/issues/reranker-eval]]" gates how much of the filter to build.

decisions:
- 2026-09-18: skills dissolve into docs (conventions), scripts (procedures), and prompts (stances); one index replaces the skill list.
- 2026-09-18: the parent does not autoread its children; child reports are classified, and the filter applies to fs and other outside ingress.
- 2026-09-18: jev is treated as free; use it for every decision node, not as a cheaper LLM.
- 2026-09-18: decide-primitive landed as lib/decide.ts (jev direct or cloudflare, logprobs and ask fallbacks, ~2s live); suspend semantics and state serialization stay open holes.
- 2026-09-18: session-instrumentation landed: PI_WM_* env → session-meta entry, board reads.jsonl, billing/pool flags in ~/.pi/agent/models.json (machine config, not in repo).
- 2026-09-18: supervision-join-script landed as lib/supervise.ts (serial wait→merge→test→decide; pending value, no wake primitive; caller must not wake on worker topics). live jev on recorded reports: clean .83, needs-decision .69, checkpoint→respawn only .39 — the respawn class needs a threshold or better state. cost effect unmeasured; first real run of the script is the measurement.
- 2026-09-18: dispatch-script landed as lib/dispatch.ts; baseline on archived tickets invalid (completion prose), next is measure over spawn prompts.
- 2026-09-18: operon-adapter answered: CLI + in-process API only, no HTTP/MCP, needs obsidian running; project = parent task tree, gantt exists without CPM or pools; next and claimed-by have no analogue. adapter is possible but lossy; whether to adopt is part of the campaign-coordinator grill.
- 2026-09-18: pool-aware-routing researched: codex wham/usage endpoint, anthropic in-band ratelimit headers, xai api-key balance only; pi captures none, seam is after_provider_response.
- 2026-09-18: skills-triage resolved: skills stay skills and migrate one at a time; the skill list is the index, not a new one. "[[projects/mlegls-pi/issues/context-handoff]]" and "[[projects/mlegls-pi/issues/exec-project-modules]]" added; the parent's `next` is carried by its children.
- 2026-09-18: exec-project-modules landed: `.pi/exec/<name>.ts` shadows `lib/<name>.ts` in the cell; new stems are `project.<name>`; `skills/mlegls-pi` documents layout/add/reload. "[[projects/mlegls-pi/issues/archive/exec-project-modules]]".
