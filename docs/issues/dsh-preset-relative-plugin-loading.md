---
stage: idea
assignee: agent
author: session:01a0e1e4-3397-74ac-bf94-15f9c9303681
---

Owner: deepseek-ai/deepseek-harness, Cordis preset loading. Found during
[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]. Upstream issue creation
was attempted with `gh issue create`; that repository has disabled issues.

With npm dsh 0.1.7-rc.2 / Cordis 4.0.4, an overlay inserting an
`@deepseek-ai/dsh-agent-preset` whose `config.plugins` contains
`{id: hashline, name: './dist/hashline.js'}` starts Web, but mounting that preset
in `ctx.agents.create` fails with `agent-preset/invalid` and
`hashline (./dist/hashline.js): never started`. Direct Node import succeeds.
The module exports `name`, `inject: ['tools']`, and `apply`.

Moving the same plugin row to a top-level overlay insert works: the registered
tools complete a real `run_code` read/edit program. This is the spike's workaround.

Possible cause, not established: nested preset configuration loses the overlay's
relative module provenance. The useful diagnostic would name the resolved URL
or underlying import/activation error, rather than only `never started`.

During [[projects/mlegls-pi/issues/dsh-templated-spawn-and-dispatch]], absolute plain plugin paths inside the nested preset document worked. `dsh/dispatch/config.ts` generates the overlay with those names before launching. Using `!!js` for the nested name instead failed registry row validation. Origin: session:01a0e2d3-2fe3-706a-8616-9394e05449d1.
