---
name: diagnosing-bugs
description: "Use when asked to diagnose or debug, or when something is broken, failing, throwing, or slow."
---

A tight feedback loop changes the economics of a hard bug. Invest in an
agent-runnable observation of the user's actual symptom: a failing test,
request, CLI invocation, replay, browser drive, or small harness. Reading and
hypotheses help find that instrument; they are not substitutes for observing
the failure.

1. Reproduce the symptom and sharpen the signal. Prefer seconds to minutes,
   specific assertions to “didn't crash,” and pinned inputs to ambient state.
   For intermittent bugs, improve reproduction rate rather than waiting for
   determinism. Measure performance regressions with a timing harness,
   profiler, or query plan.
2. Reduce the scenario while it continues to fail. Use hypotheses to choose
   discriminating probes; several genuinely different explanations can help
   when the first one has become an attractor (`variety`). Bisection,
   differential runs, and instrumentation are tools for narrowing the cause.
3. Fix the cause and capture the regression at a seam that observes it
   (`testing`). Rerun the original, unminimized scenario as well as the narrow
   check. A guard that merely hides the symptom has not explained it.
4. Remove temporary instrumentation and fixtures. Record the cause and the
   evidence that distinguishes the fix from a coincidental green run.
   `after-implementation` closes the change.

When access prevents observation, report what remains unknown and the concrete
artifact or access needed. [scripts/hitl-loop.template.sh](scripts/hitl-loop.template.sh)
can make a human-only reproduction repeatable. Share only redacted diagnostic
material; secrets belong in environment variables, not captured commands.

An unavailable testing seam or a fix much larger than the behavior warrants
may be the architectural finding. Preserve that friction as `difficult`.
