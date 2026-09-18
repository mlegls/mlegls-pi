---
next: grill
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
