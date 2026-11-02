# Implementation first use

Base: `31026c8ce8feb059b0bfbfef8af1a4f99100c4d5`.

The implementation adds `bin/host-for-human`, a Linux user-systemd static server launcher and Tailscale HTTPS publisher. [Usage and fixture entry point](../../guide/host-for-human.md). The committed [HTML fixture](fixture/index.html) references [relative CSS](fixture/review.css). No secrets, seed database, or browser login are needed; the host must already have Tailscale Serve enabled.

## First use on Beelink, 2026-11-02

The original capacity blocker was resolved by the supervisor releasing the stale mapping on 10002. Live mappings on 10000, 10001 and 10003 were left untouched. The fixture was served from this worker's checkout with existing tailnet authentication and user systemd; no browser login or seed data was required.

Entry point:

```sh
bin/host-for-human docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture --name review-page-first-use
```

The first invocation exposed a Tailscale listener startup race: Serve returned before HTTPS accepted connections, producing connection refused. A direct fetch seconds later returned 200. The launcher now retries connection refusal for up to 20 attempts at 250 ms intervals; other failures still propagate. A fresh publish after removing the mapping passed.

Observed checks on the implementation plus that repair:

- Fresh publication printed `https://beelink.tail9d5828.ts.net:10002/`, checking both HTML and `review.css` over HTTPS.
- After `systemctl --user stop host-for-human-2c1213c10a51cb870e4a.service`, the service was inactive and the HTTPS page returned 502.
- Re-running the entry command recreated the server and printed the identical URL, again checking HTML and CSS. Independent curl fetches returned HTML 200 and CSS 200.
- The artboard publish step and universal browser convention name `host-for-human`.
- The entry command with `--stop` removed the mapping and owned service. The other mappings remained unchanged; no server or mapping owned by this trial was left running.

The CLI help and Python syntax checks passed in the initial implementation. No existing regression tests cover this new Python CLI; this was a live CLI first-use check, not a new permanent test. A fresh driver still owns independent acceptance. Visual evidence: false; screenshots: none (publishing/HTTP lifecycle checks only).
