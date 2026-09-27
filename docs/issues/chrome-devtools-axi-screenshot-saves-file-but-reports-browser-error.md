---
stage: idea
author: "session:01a0e43b-0708-70eb-ad7a-670690209021"
---

`chrome-devtools-axi screenshot PATH` saved valid PNGs but returned `BROWSER_ERROR: chrome-devtools-mcp did not report a saved screenshot path` after `emulate --color-scheme dark` and `open` to another page. Observed on 2026-09-27 while driving the Common Concept landing with named session `print-some-landing-editions-on-black-stock-drive`. First five home screenshots reported success. On the product page, viewport, full-page and scrolled screenshots all reported the same error; each PNG nevertheless existed at PATH and opened normally. Repeated after changing emulation back to light. This false failure makes collection appear incomplete and can trigger unnecessary retries.

Replay: open a page using an isolated named session, capture a screenshot, `emulate --color-scheme dark`, open a second page, then `screenshot /tmp/second.png`. Compare CLI result with file existence and image validity. Workaround: check the path after the error and inspect the saved image rather than retry blindly.

Possibly the bridge's path parser rejects one MCP screenshot response shape after switching selected pages; not yet isolated to emulation versus navigation.
