# Review pages over Tailscale HTTPS

```sh
host-for-human ./review --name design-review
host-for-human 4387 --name lavish-review
host-for-human --run 'python3 -m http.server 4388 --bind 127.0.0.1 --directory ./review' 4388 --name owned-review
```

Requires Python 3 and Tailscale signed in with Serve enabled (owned servers also require Linux user systemd; `--run` needs systemd 250+ for `ExitType=cgroup`). Prints only the verified HTTPS URL to stdout after fetching the page and its first referenced stylesheet or script. An artboard directory without `index.html` opens `canvas.html`.

## Ports and reclamation

Mapped review ports are `10000–10003`. When allocating, dead proxy mappings (TCP connection refused on every handler of that port), missing-directory reservations, and inactive owned services are reclaimed and logged to stderr. Listening upstreams, timeouts, and unrecognized mappings stay untouched.

## Server lifetime

- **Directory mode**: starts a transient user systemd unit (`host-for-human-<hash>.service`) that survives the publishing thread and restarts on crash, keeping its HTTPS port across re-runs. Needs re-publishing after reboot.
- **Port mode**: exposes an existing server; its owner manages lifetime.
- **`--run '<command>' <port>`**: installs an enabled user systemd unit (with lingering enabled so it starts at boot) running `<command>` from the publishing directory with the publisher's `PATH`. Systemd tracks the whole cgroup, so forking servers restart cleanly. Metadata lives in `${XDG_STATE_HOME:-~/.local/state}/host-for-human/*.json`; logs are in `journalctl --user -u <unit>`.

Isolated Lavish server example (use your host's Tailscale DNS name):

```sh
host-for-human --run 'LAVISH_AXI_PORT=4388 LAVISH_AXI_STATE_DIR=$HOME/.local/state/lavish-owned-review LAVISH_AXI_ALLOWED_HOSTS=beelink.tail9d5828.ts.net lavish-axi server' 4388 --name lavish-owned-review
```

Open/poll with the same `LAVISH_AXI_PORT` and `LAVISH_AXI_STATE_DIR`, and share the session path on the printed HTTPS origin.

`--name` defaults to the absolute directory or `port-<port>`. Re-run the same name to repair a dead link (a saved `--run` command is reused if omitted).

## Stopping

```sh
host-for-human ./review --name design-review --stop
host-for-human 4388 --name owned-review --stop
```

Removes the mapping and stops (and for `--run`, disables/removes) the owned unit. External port-mode servers stay running, and mappings owned by another name aren't touched.

## First-use fixture

```sh
bin/host-for-human docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture --name review-page-first-use
```

Stop or `SIGKILL` its systemd unit from the state JSON to test repair and crash recovery, then clean up with `--stop`.
