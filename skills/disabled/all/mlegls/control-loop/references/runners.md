# Runners

Use the active harness's agent registry and current model configuration.
Names, availability, authentication, and capabilities change too quickly for a
skill to own a model ranking. Record the model actually resolved for a run when
its identity matters to the experiment.

Prefer managed subagents when they provide the needed isolation, artifacts,
and lifecycle controls. Use another CLI when its model or harness is the point;
check that installed CLI's help and authentication before constructing a run.
A quiet process is not by itself a stuck process.

Independent judgment benefits from distinct families (`variety`). Execution
needs a model capable of the assignment's ambiguity and coupling, not merely
its nominal size. Do not silently substitute a weaker model when the intended
one is unavailable.

Subscription and API routes are different billing choices. Preserve the user's
configured route; unattended CI may need credentials that an interactive
session already has. In pi, provider selection distinguishes such routes;
consult the installed provider docs rather than inferring from the model name.

Background work is useful when something else can proceed alongside it. Use
managed sessions or tmux for external runners, with isolated working directories
for concurrent writers. Retain a report and completion status. In CI, collect
raw output separately from the concise result used for the PR body, and set
spend/time bounds appropriate to the loop.
