---
stage: idea
assignee: agent
author: "session:01a0e7fb-7917-728f-9fcd-e9e1219fc4c5"
priority: 3
---

Tooling owner: `~/dev/chrome-devtools-axi`, not Common Concept. During [[projects/concept/issues/show-recoverable-failures-as-fault-cards]] first-use drive, `chrome-devtools-axi snapshot` on the visible Settings model picker and Session model picker exposed the containing `listbox` but no options. A screenshot showed the `openrouter` or typed-model option; `chrome-devtools-axi eval '() => [...document.querySelectorAll("[role=option]")].map(x=>x.textContent)'` returned those options, and clicking the live DOM option via `eval` selected it. Retaking a snapshot after waiting did not list the option. This slowed changing models with the CLI. The workaround was live-DOM inspection and click, not an assumption that the picker had no options.

Investigate whether the DevTools accessibility snapshot drops portal options despite visible DOM, or the application's Base UI markup omits an accessibility relation. If the latter, move the issue to Common Concept; this observation alone does not establish the owner of the omission.

2026-09-28, peek-links first use: the model-search snapshot again showed an empty listbox while the DOM held a `scripted/tutor` option ([[projects/concept/attachments/peek-links-from-the-transcript-without-leaving-the-session/index|packet]], friction 2).

triage, 2026-09-30: not filed upstream: the owner (app markup vs. the accessibility snapshot) is unestablished. File at https://github.com/kunchenguid/chrome-devtools-axi/issues once a minimal repro isolates it.
