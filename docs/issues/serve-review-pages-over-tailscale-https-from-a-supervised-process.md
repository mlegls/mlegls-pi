---
stage: "done"
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

## Result

done — all four stories hold on the final head. I made no code repairs. I appended my review to the driver's log and committed it.

I re-ran the fixture entry point (`bin/host-for-human` on the committed fixture directory, name `review-4-check`):
- **Publish:** it checked the HTML and `review.css` over HTTPS, both 200, and printed `https://beelink.tail9d5828.ts.net:10002/`.
- **Recovery:** after I killed and stopped the owned unit, the page returned 502. Re-running restored the identical URL with 200s.
- **Cleanup:** `--stop` removed the mapping, the unit and the state file. Nothing of mine is left running.
- **Bad input:** a missing directory or port 99999 exits 1 with a one-line reason.
- **Full range:** when the range is full, it fails loudly and leaves existing mappings untouched.

The artboard publish step and `agent-prompts/universal.md` both name `host-for-human` and the re-run-without-asking line.

I also settled the friction the change's workers filed. `tailscale-review-https-range-is-full` was already done with a result, so I left it as is.

```yaml
commit: HEAD of branch serve-review-pages-over-tailscale-https-from-a-supervised-process-review-4 (review log commit on top of ba8b10dd)
stories:
  - story: Publish a fixture directory with checked Tailscale HTTPS
    outcome: held
  - story: Restore a dead server at the same URL
    outcome: held
  - story: Record review purpose and owner in a supervised service
    outcome: held
  - story: Artboard and thread conventions name host-for-human
    outcome: held
evidence:
  path: docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/drive-3.md
  visual: false
  shots: []
tests: []
filed:
  - host-for-human-port-range-leaks-abandoned-and-foreign-mappings
caveats:
  - "No permanent test encodes the ticket's 'a test serves a fixture directory' acceptance. The live fixture entry point (docs/guide/host-for-human.md, First-use fixture) is the check, because adding a test needs the maintainer's approval."
  - "proposed test: none; the script is thin glue over systemd and tailscale."
  - "Only HTTPS ports 10000–10003 are available. Three are held by foreign mappings on Beelink, so only one concurrent review page fits. Reclaiming stale reservations or dead foreign mappings is a maintainer decision, filed in the issue above."
  - "Unit lifetime: the transient user-systemd units do not survive a host reboot, so re-run the command after one (documented). Reboot persistence was not tested."
  - "CLI-level only; rendered appearance and Lavish annotation over this origin were not assessed."
```

Evidence: [docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/drive-3.md](../attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/drive-3.md)
