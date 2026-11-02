# Implementation first use

Base: `31026c8ce8feb059b0bfbfef8af1a4f99100c4d5`.

The implementation adds `bin/host-for-human`, a Linux user-systemd static server launcher and Tailscale HTTPS publisher. [Usage and fixture entry point](../../guide/host-for-human.md). The committed [HTML fixture](fixture/index.html) references [relative CSS](fixture/review.css). No secrets, seed database, or browser login are needed; the host must already have Tailscale Serve enabled.

## Observed setup blocker

On Beelink, 2026-11-02, first invocation failed before server startup: `no free Tailscale HTTPS port in 10000–10003; existing mappings were left untouched`. `tailscale serve status --json` showed 10000→4410, 10001→3219, 10002→18174, 10003→4720. These mappings are not owned by this worker and were not changed. No browser trial was started against this not-ready deployment.

Capacity friction is tracked as [[projects/mlegls-pi/issues/tailscale-review-https-range-is-full]]. An owner must release a slot or explicitly authorize a broader mapped range before first-use HTTPS and restart behavior can be observed.

The CLI help and Python syntax checks pass. There are no existing regression tests covering this new Python CLI; no permanent tests were added by the implementer. HTTPS fetch, systemd launch and restoration remain **unobservable** until the required port is available. The artboard publish instruction and universal browser-serving convention name `host-for-human`.

No servers, browsers or HTTPS mappings were left running by this worker. Visual evidence: false; screenshots: none. This records setup, not acceptance.
