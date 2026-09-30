---
stage: done
author: "session:01a0e43b-0708-70eb-ad7a-670690209021"
---

`chrome-devtools-axi screenshot PATH` saved valid PNGs but returned `BROWSER_ERROR: chrome-devtools-mcp did not report a saved screenshot path` after `emulate --color-scheme dark` and `open` to another page. Observed on 2026-09-27 while driving the Common Concept landing with named session `print-some-landing-editions-on-black-stock-drive`. First five home screenshots reported success. On the product page, viewport, full-page and scrolled screenshots all reported the same error; each PNG nevertheless existed at PATH and opened normally. Repeated after changing emulation back to light. This false failure makes collection appear incomplete and can trigger unnecessary retries.

Replay: open a page using an isolated named session, capture a screenshot, `emulate --color-scheme dark`, open a second page, then `screenshot /tmp/second.png`. Compare CLI result with file existence and image validity. Workaround: check the path after the error and inspect the saved image rather than retry blindly.

Possibly the bridge's path parser rejects one MCP screenshot response shape after switching selected pages; not yet isolated to emulation versus navigation.

## Also observed from Common Concept


Owner: `chrome-devtools-axi` (`~/dev/chrome-devtools-axi`, without a local `docs/issues/` tracker). Observed while first-using [[projects/concept/issues/zh-landing-pages-and-the-gong-lockups]]; [[projects/concept/attachments/zh-landing-pages-and-the-gong-lockups/index|packet]].

With named isolated CLI session `zh-landing-pages-and-the-gong-lockups-drive`, after `emulate --color-scheme light` and `resize 1200 1100`, `chrome-devtools-axi screenshot docs/attachments/zh-landing-pages-and-the-gong-lockups/05-zh-ncept-paper.png` repeatedly reported `error: chrome-devtools-mcp did not report a saved screenshot path` (`BROWSER_ERROR`, exit 1). Yet the named PNG existed immediately, was viewable with `ab view`, and showed the right page. The same error recurred on subsequent screenshot calls (including full page scroll screenshots and four presets per route), whether the output path started with `./` or not. Before emulation/resize, screenshots returned the saved path successfully. Reproduction: serve the local landing at `127.0.0.1:4478`, open `/zh/ncept/` in the isolated CLI, emulate light, resize, then screenshot into an existing directory. No causal claim about emulation or resize yet.

Workaround: check that the file exists and open it independently despite the CLI failure. Investigate why the bridge loses the output path in its response while writing succeeds; report success when the expected file was actually saved.

disposition, 2026-09-30: filed upstream as https://github.com/kunchenguid/chrome-devtools-axi/issues/151 (comment with the color-scheme and resize triggers; root cause is the trailing status line after emulation); the owner is the upstream repository. No repair is claimed by closing this capture.
