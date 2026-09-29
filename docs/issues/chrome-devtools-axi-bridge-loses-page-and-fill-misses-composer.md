---
stage: idea
priority: 3
author: "session:01a0e34b-eead-73ce-bfe8-e5ebaccde620"
assignee: agent
---

Tool owner: `chrome-devtools-axi` (`~/dev/chrome-devtools-axi`; no `docs/issues/` tracker there). Observed while driving [[projects/concept/issues/use-the-mission-name-in-session-chrome]]; [[projects/concept/attachments/use-the-mission-name-in-session-chrome/index|packet]].

- On CLI 0.1.35 in named isolated session `use-the-mission-name-in-session-chrome-drive`, `fill @<composer-ref> <text>` displayed the complete text in the Session's controlled multiline composer, but **Send** remained disabled. Pressing Enter cleared the text without adding a transcript turn. Retyping the same text with `click` + `type` made **Send** enabled; clicking it admitted the turn. Workaround: use `type` for this composer, and verify the button is enabled before sending. The failure was not generalized to other input types; provider and email `fill` did work.
- During a `wait 'missing content'` invocation (which did not match the actual reply), a simultaneous `snapshot` invocation stalled, then the waiter returned `socket hang up`; the following snapshot returned `No page is currently selected`. `pages` showed only `about:blank` and the prior authenticated context was gone. The Application at the checkout-owned URL remained HTTP 200 and the already admitted turn persisted after re-sign-in. Workaround: do not overlap CLI commands against a named session; inspect a fresh `pages` result and re-open/re-authenticate if the bridge loses the page. Whether concurrency caused the loss is unknown.
- Reviewing the same ticket (session `use-the-mission-name-in-session-chrome-review-1`), `screenshot <path>` with its output discarded twice left no file at the requested path (once a path inside the worktree, once under `/tmp`); rerunning the same command to a new `/tmp` path wrote the file and printed `screenshot: <path>`. Workaround: keep the command's output and check the file exists. Cause unknown.
- The quiet-transcript review saw a similar empty-composer/disabled-Send outcome with direct Playwright 1.63, not the CLI bridge. Keyboard input admitted one replay but another failed identically. The recording typed immediately after **+ New Mission**, before waiting for the Session route, so it could target Me's outgoing composer. The recording now waits for the Session URL and workspace before typing; this navigation race does not establish a controlled-input or bridge defect.
- Driving [[projects/concept/issues/place-pricing-and-payment-in-the-landing-and-application-flow]] (named session `pp-pricing`), `click @<ref>` and `screenshot <path>` often exited 1 although the click took effect and the file was written; `eval` with a bare statement list (`a; b; 1`) also exited 1 until wrapped as `() => { ...; return 1 }`. Workaround: ignore the exit status and check the effect (URL, snapshot, file).

Proposed: preserve the selected page across failed waits or report bridge termination distinctly, and test `fill` against a controlled textarea where React state drives a disabled submit button. These are tooling observations, not claims about the product's implementation.
