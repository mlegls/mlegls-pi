---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_ae8q9yrxnv"
---
idea: the maintainer asked again and again for review pages to be served over Tailscale HTTPS, and for dead pages to be brought back. Efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv; auditors @thread:thr_jzyk5zr226, @thread:thr_u4p4mait39) counted at least 11 such interruptions in 10-26→11-02, verbatim:
- "please use tailscale with https. i can't annotate over getbb" (@thread:thr_jd4uzns2tr#msg=1637)
- "try hosting over tailscale https instead" (@thread:thr_78sspagtst#msg=1978); "the page is down over tailscale" (#msg=3877); "the link is down again" (#msg=4626); "The link doesn’t work anymore. Please republish or use tailscale" (#msg=14193)
- "i can't see this. please re-host it over tailscale https" (@thread:thr_a35xhciju2#msg=27040); "please restart the page" (#msg=31101)
- "please serve it over tailscale https. it renders unstyled over bb" (@thread:thr_hnjs6y4dyz#msg=559)
- "please republish. the server is closed" (@thread:thr_rr4e4pr7ej#msg=745)

Two causes. Agents default to `bb connect expose` (the bb connect plugin prompt says so), which breaks Lavish annotation and relative assets ([[projects/mlegls-pi/issues/lavish-annotation-broken-over-bb-connect]]). And the server is started in a worker's turn and dies with it, so the link goes down before review ends. `bin/lavish-axi` already rewrites for `tailscale serve`, and the Beelink's `tailscale serve` maps HTTPS ports 10000–10003.

ticket: one way to put a page in front of the maintainer.
- `bin/host-for-human <port|dir> [--name N]`: for a directory, serve it with a static server; for a port, use the running server. Start the server as a managed process that outlives the turn (record owner thread and purpose so cleanup knows it's a review page), map it with `tailscale serve --bg --https=<free port in the mapped range>`, then fetch the HTTPS URL and one stylesheet or script it references, and fail loudly if either isn't 200. Print the URL. Re-running with the same name restarts a dead server on the same URL.
- Skill line in `skills/enabled/all/mlegls/artboard/SKILL.md` at the publish step, and in the conventions bb threads read: "Anything the maintainer opens in a browser is served with `host-for-human` over Tailscale HTTPS, not `bb connect expose`. If the maintainer says the link is down, re-run it without asking."

Acceptance: a test serves a fixture directory and gets a checked HTTPS URL; killing the server and re-running restores the same URL; the artboard skill names the script at its publish step.
