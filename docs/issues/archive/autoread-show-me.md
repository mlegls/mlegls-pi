---
stage: done
assignee: agent
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

autoread returns understanding for the parent’s next task, not snippets or a search transcript. Use labeled file/call trees, story sequences, and pseudocode where useful, with verified source references. The parent should begin useful work without repeating orientation.

shape: `lib/autoread.ts` exports `run(request, {model, effort?, sessionFile?, ...})` → `{text, sessionFile, model}`. Fork the persisted session, compact the child (including observational memory), switch model, investigate with read/search/recall tools, return only the last answer. Exec supplies the current session path. Routing stays caller-owned; no worker dispatch, automatic parent mutation, or cross-call cache. See [usage](../autoread.md).

remaining: map five recent tickets and compare the returned context against what their original sessions read. Check factual accuracy, source citations, parent rereads, latency, and tokens before deciding which parts to make deterministic ([[projects/mlegls-pi/issues/map-projection]]). A library implementation is not evidence of briefing quality.

holes:
- Memoization would need the request, inherited context, and dirty working tree, not only a git ref. Defer caching until measured.
- Short/already-compacted branches may retain too much context for a smaller reader model; measure before introducing a second compression policy.

decisions:
- 2026-09-20: implement as a private pi reader fork rather than a fixed projection pipeline or sidecar label cache. The same `run` handles orientation and targeted comprehension questions.

evidence — 2026-09-20:
- Live DeepSeek reader inherited a fixture label, read the module loader, and returned a briefing; parent JSONL remained byte-identical. A second run compacted an OM observation (`om.folded`) and used `recall` to recover the original source, then read code. Reader tools observed: read/find/grep/recall.
- Briefings were useful but exceeded requested word limits; the first included an incorrect inference, and the second guessed source line numbers. The prompt now asks for grep-verified citations; quality improvement is not yet measured.
- Exec exposes `autoread.run` and the correct session path. Timeout and pre-aborted invocations reject. Existing suite: `env -u BB_THREAD_ID bun test` — 196 pass, 2 skip, 0 fail. Typecheck retains the five existing errors outside this change.

done 2026-09-23: dropped with `lib/autoread.ts`. With observational memory, compaction after reading is free to the parent, so orientation reads in-session (`orient`/`introduce` skills) and delegated reading goes to the `research` stance.
