---
stage: goal
assignee: human
priority: 1
---

A coherent harness-integrated library, skills and human surfaces reduce orchestration overhead. The repository merge and project-local exec modules are delivered; skills remain skills. Orca currently supplies execution and messaging as a trial. Choosing between what it offers and a tmux/workmux/board composition remains part of the human-surface decision.

Residual work: reconcile the remaining human-surface choices and accept the composed workflow against the recorded orchestration costs. Children own bounded preparation, measurement and delivery; their results do not by themselves certify the whole workflow. The dated decisions below preserve the route, including superseded proposals.

evidence for the current state: [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]]. summary: parents spend ~60% of context on reading, a quarter of files read are never referenced; coordinator sessions spend 94% of their cost after the first spawn, reading merged results in the main checkout; child reports are small (1.3 KB) and enter unfiltered by board push; the one expensive worker shape is a long opus session steered many times through checkpoints.

substeps, roughly in dependency order:
1. "[[projects/mlegls-pi/issues/archive/decide-primitive]]" — everything jev-backed waits on it.
2. "[[projects/mlegls-pi/issues/archive/session-instrumentation]]" — so later audits are one-liners.
3. "[[projects/mlegls-pi/issues/ingress-filter]]", "[[projects/mlegls-pi/issues/autoread-show-me]]", "[[projects/mlegls-pi/issues/skim-and-triage]]" — what enters context; run in parallel.
4. "[[projects/mlegls-pi/issues/archive/supervision-join-script]]", "[[projects/mlegls-pi/issues/dispatch-script]]" — orchestration as scripts.
5. "[[projects/mlegls-pi/issues/pool-aware-routing]]", "[[projects/mlegls-pi/issues/archive/campaign-coordinator]]".
6. "[[projects/mlegls-pi/issues/archive/skills-triage]]" then "[[projects/mlegls-pi/issues/archive/repo-merge]]".
7. "[[projects/mlegls-pi/issues/home-ui]]", "[[projects/mlegls-pi/issues/archive/operon-adapter]]" — the human surfaces; independent of the rest.
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
- 2026-09-18: skills-triage resolved: skills stay skills and migrate one at a time; the skill list is the index, not a new one. "[[projects/mlegls-pi/issues/archive/context-handoff]]" and "[[projects/mlegls-pi/issues/archive/exec-project-modules]]" added; children carry the individual follow-ups; composed acceptance remains with the parent.
- 2026-09-18: context-handoff landed: wm.spawn({from:"fork"|"summary"}), /jump <handle>. "[[projects/mlegls-pi/issues/archive/context-handoff]]".
- 2026-09-18: exec-project-modules landed: `.pi/exec/<name>.ts` shadows `lib/<name>.ts` in the cell; new stems are `project.<name>`; `skills/mlegls-pi` documents layout/add/reload. "[[projects/mlegls-pi/issues/archive/exec-project-modules]]".
- 2026-09-20: repo-merge landed: `agents/`, `skills/{enabled,disabled}`, `agent-prompts/` live here; system-config keeps relative symlinks and agents-apply. package skills stay `skills/pi` and `skills/mlegls-pi`. "[[projects/mlegls-pi/issues/archive/repo-merge]]".
