if we've agreed on a plan, run it to completion instead of pausing for approval; only stop if genuinely blocked. when you check in or finish, report only deviations or new questions/insights. a direct summary of what you just did is usually too contextual to mean much to me or redundant, and I can review the diff or ask.

if you're a fable-class model, please use gpt via my pi harness for executing large code changes once there's a plan — it's faster and saves tokens:
`pi -p --name "<task-slug>" --model openai-codex/gpt-6-sol:high "<task>"` (run_in_background for long jobs, review the diff and commit yourself after)
leave pi extensions on (don't pass -ne) — they provide lsp/web-search that the model lacks natively. the named session makes progress tailable under ~/.pi/agent/sessions/; if a run sits at 0% cpu with no session writes, it's wedged — kill and relaunch.
the model is smart enough to work from high-level instructions, but tell it about repo conventions it can't infer, like not running autoformatters.

commit each coherent change-set as you go instead of batching rounds of edits.

if you're a fable-class model, please use gpt via my pi harness for executing large code changes once there's a plan — it's faster and saves tokens:
`pi -p --name "<task-slug>" --model openai-codex/gpt-6-sol:high "<task>"` (run_in_background for long jobs, review the diff and commit yourself after)
leave pi extensions on (don't pass -ne) — they provide lsp/web-search that the model lacks natively. the named session makes progress tailable under ~/.pi/agent/sessions/; if a run sits at 0% cpu with no session writes, it's wedged — kill and relaunch.
the model is smart enough to work from high-level instructions, but tell it about repo conventions it can't infer, like not running autoformatters.


# General guidance moved from universal.md

be willing to question the frame you're operating in, and to propose whole system subtractions or replacements when an additive patch seems difficult. infer intent beyond the stated instructions/path, and propose revisions to the path when it seems appropriate.

when writing or editing prose (including comments), remember that the reader cannot see your conversation. do not write reactively to the session's discussion context.

prefer Auftragstaktik to Befehlstaktik when delegating work to other LLMs, unless they are essentially simulating a deterministic function.

---

when designing or implementing code:

focus on correct data structures/representations first, and making invalid states unrepresentable.
in terms of representations, refactor wherever necessary, even if the "invalidness" introduced seems small, and the refactor seems large.
in terms of features/guards/"compatibility", assume yagni, and use one-liner solutions where they work.

commit in meaningful chunks as you make changes.

# General guidance moved from pi.md

Use tmux or the session tool for running background or parallel tasks. but don't start a task async unless you intend to do something else in parallel.
