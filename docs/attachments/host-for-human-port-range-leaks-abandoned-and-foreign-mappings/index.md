# Implementation first use

Tested source: `0b4a07ec9e8c43dd6a854bfb8901b5a96824222c` (on top of implementation `bf105fc8`). CLI/HTTP observations on Beelink, 2026-11-09; no browser or visual judgment.

## Setup and entry point

Required environment: Linux user systemd 250+, Python 3, and authenticated Tailscale with Serve enabled. Actual target: `beelink.tail9d5828.ts.net`, user `mlegls`, systemd 259, `Linger=yes`. The implementation checkout owned every scratch review/service below. Authentication used the host's existing Tailscale login; there are no additional credentials or database seeds. The committed [fixture](../serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture/index.html) supplies the page and relative CSS.

From the checkout being verified, this exact entry command was opened and checked:

```sh
bin/host-for-human --run 'python3 -m http.server 4388 --bind 127.0.0.1 --directory docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture' 4388 --name owned-review-first-use
```

It printed `https://beelink.tail9d5828.ts.net:10000/`; independent HTTP fetches returned **200** for the page and `review.css`. `systemctl --user is-enabled <recorded unit>` returned `enabled`, and `systemd-analyze --user verify <recorded unit file>` succeeded. Find the unit in `${XDG_STATE_HOME:-$HOME/.local/state}/host-for-human/*.json`. Finish with:

```sh
bin/host-for-human 4388 --name owned-review-first-use --stop
```

The [guide](../../guide/host-for-human.md) also provides directory-mode and isolated Lavish entry points. No resident deployment is handed off: these commands reproduce the prepared surface from committed files.

## Observed behavior

- **Refused foreign mapping:** installed a scratch HTTPS 10000 mapping to closed upstream `127.0.0.1:53589`. A new publication reused HTTPS 10000 and emitted `removed refused mapping HTTPS 10000 -> http://127.0.0.1:53589` on stderr. The new page and relative CSS passed their HTTPS checks.
- **Listening foreign mapping:** simultaneously kept HTTPS 10001 mapped to a scratch HTTP server on `127.0.0.1:43211`. The mapping retained the same proxy and its upstream still answered 200 after allocation. That external server was cleaned up separately by its owner.
- **Missing directory reservation:** published `hfh-implement-gone`, removed its scratch source directory, and published another name. Stderr named the reclaimed review, its proxy and HTTPS 10000; its reservation disappeared and the new review reused 10000.
- **Inactive service reservation:** stopped the owned directory unit for `hfh-implement-inactive`, then published `hfh-implement-fresh`. Stderr named the inactive review's reclamation; the fresh page reused HTTPS 10000 and passed HTML/CSS checks.
- **Owned command lifetime:** `hfh-implement-owned` ran a Python HTTP server on 37155. After the publishing process exited, HTTPS still returned 200. Its persisted unit was active and enabled with `ExitType=cgroup`. Restarting that unit through systemd restored HTTPS 200 without re-running the publisher. `--stop` removed its mapping, disabled/removed its unit and reservation, and TCP connections to 37155 were refused.
- **Lavish's detached server:** used isolated `LAVISH_AXI_PORT=56077`, a checkout-owned state directory, `LAVISH_AXI_ALLOWED_HOSTS=beelink.tail9d5828.ts.net`, and `LAVISH_AXI_NO_OPEN=1` in the `--run` command. The command opened the committed fixture with `lavish-axi <fixture> --no-open`. After that short-lived CLI and a second resume CLI both exited, `https://beelink.tail9d5828.ts.net:10000/session/d085a9bf2ec7bed4` returned **200** (19,590 bytes), and the user service remained active. `--stop` ended the isolated Lavish server and removed its mapping.
- **Occupied upstream port:** `--run` against the already-listening scratch server failed with exit 1 and `upstream port is already in use; --run needs its own unused port`, before reserving or starting a review.

The first allocator use also reclaimed the three originally observed refused foreign mappings: HTTPS 10000 → 4410, 10001 → 3219, and 10003 → 4720. Each removal was named on stderr. Mappings outside 10000–10003 were unchanged.

## Checks and cleanup

Python AST parsing and `git diff --check` passed. There are no existing automated regression tests for this CLI; the existing committed fixture and live public entry points above were exercised. No permanent tests were added.

All scratch upstreams were stopped and all scratch mappings, unit files and reservations were removed. Final `tailscale serve status --json` had no mappings in 10000–10003; `systemctl --user list-units 'host-for-human*' --all` listed none. The installed mapping helper remains as ordinary tool runtime data in the state directory.

Boot persistence is configured through the enabled unit, `default.target` and user lingering; a persisted-unit restart was observed. The shared host was not rebooted. Directory-only mode retains its existing transient-unit lifetime; use `--run` for reboot persistence.
