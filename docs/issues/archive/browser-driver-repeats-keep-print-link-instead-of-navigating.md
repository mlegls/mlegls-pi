---
stage: done
author: "session:01a0e530-e03c-7772-833f-2b19c6cef978"
---

While driving Concept's landing typography story on 2026-09-27, `ab computer --url 'http://127.0.0.1:4482/?type=courier-ia-duo&hue=80&stock=paper' --until 'The Common Concept product page shows type: Courier · iA Duo in its colophon' 'Use “keep this one” on the catalog page, then follow the product link to Common Concept, then inspect the print description at the bottom'` pressed **keep this one** twice and stopped as `stuck` after 19 steps. The first press correctly reordered the query to `?hue=80&stock=paper&type=courier-ia-duo` (in this browser's color scheme). The product link remained visible. The driver waited repeatedly and chose **keep this one** a second time rather than moving to the product page. Trace: `/Users/mlegls/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept__worktrees-roll-landing-typography-as-one-preset-drive--/2026-09-27T23-26-20-732Z_01a0e530-e03c-7772-833f-2b19c6cef978.ab/computer/2026-09-27T23-29-33-688Z-7567fa.browser.jsonl` (session-local).

Workaround: in a unique named `chrome-devtools-axi` session, follow the same two visible links with `run` and inspect URL/colophon after each. Possible improvement: recognize that the first step's target is already satisfied by the query change and advance to the next requested link rather than retrying it. This observation does not establish why the driver ranked the second link below the first.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
