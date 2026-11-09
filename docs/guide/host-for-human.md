# Review pages over Tailscale HTTPS

```sh
host-for-human ./review --name design-review
host-for-human 4387 --name lavish-review
host-for-human --run 'python3 -m http.server 4388 --bind 127.0.0.1 --directory ./review' 4388 --name owned-review
```

Requires Python 3 and Tailscale signed in with Serve enabled. Owned servers require Linux user systemd; `--run` uses systemd 250+ (`ExitType=cgroup`). HTTPS ports 10000–10003 are the host's mapped review range. When allocating, mappings whose upstreams refuse TCP connections are removed and named on stderr, including foreign mappings. Listening upstreams, timeouts and unrecognized mappings stay in place. For a port with several paths, every handler must be a refused proxy before it can be reclaimed. Owned reservations are also reclaimed when their directory is gone or their service is inactive; an external-port reservation is reclaimed when its upstream refuses connections. Exhaustion remains an error.

The command prints only the checked URL to stdout. It fetches the page and the first referenced stylesheet or script over HTTPS; a page with no such reference is checked by itself. An artboard directory without `index.html` opens `canvas.html` directly.

## Server lifetime

Directory mode starts a transient `host-for-human-<identity hash>.service` in user systemd, independent of the publishing thread's turn/process. Systemd restarts crashes; re-running the same command recreates a stopped server and retains its HTTPS port. Keep the source directory until review ends. These transient directory units need re-publishing after a reboot.

Port mode publishes an existing server; its original owner remains responsible for running/restarting it.

`--run '<command>' <port>` instead owns the command and mapping in an enabled user service. It enables user lingering so the service starts at boot without a login. The service runs the shell command from the publishing directory with the publisher's PATH; put other required environment variables in the command. Commands that fork a server are supported: systemd owns the whole cgroup. It restarts when the command and its children exit. Source files and the working directory must remain available. The service's mapping helper is installed in the state directory, independent of the publishing checkout.

For an isolated Lavish server, choose an unused local port and state directory:

```sh
host-for-human --run 'LAVISH_AXI_PORT=4388 LAVISH_AXI_STATE_DIR=$HOME/.local/state/lavish-owned-review LAVISH_AXI_ALLOWED_HOSTS=beelink.tail9d5828.ts.net lavish-axi server' 4388 --name lavish-owned-review
```

Use your host's Tailscale DNS name for `LAVISH_AXI_ALLOWED_HOSTS`. Open/poll the artifact with the same `LAVISH_AXI_PORT` and `LAVISH_AXI_STATE_DIR`; share its session path on the printed HTTPS origin.

The stable name defaults to the absolute directory or `port-<port>`. A name belongs to one target and command: re-run to repair a dead link. A saved `--run` command is reused if omitted on subsequent calls. The current name's reservation is retained for repair; another publication may reclaim it while it is inactive. Metadata in `${XDG_STATE_HOME:-~/.local/state}/host-for-human/*.json` records owner thread, last publishing thread, purpose, directory, command, systemd unit, upstream port, HTTPS port and URL. Failed checks retain the reservation. Service logs are available through `journalctl --user -u <unit>`.

When the review ends:

```sh
host-for-human ./review --name design-review --stop
host-for-human 4388 --name owned-review --stop
```

This removes the mapping and stops the owned server. For `--run` it also disables/removes the installed unit. External port-mode cleanup leaves the external server running. Changed-owner mappings are preserved, including during service shutdown/restart.

## First-use fixture

From the checkout being verified:

```sh
bin/host-for-human docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture --name review-page-first-use
```

This serves the committed fixture and checks HTTPS HTML plus relative CSS. Find its `unit` in the metadata and use `systemctl --user stop <unit>` to simulate a dead server. Re-run the same entry command: expect the same checked URL. `systemctl --user kill --signal=SIGKILL <unit>` instead exercises automatic crash recovery. Finish with the entry command plus `--stop`.

To try command ownership with the same fixture:

```sh
bin/host-for-human --run 'python3 -m http.server 4388 --bind 127.0.0.1 --directory docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture' 4388 --name owned-review-first-use
```

After the publisher exits, fetch the printed URL, inspect `systemctl --user is-enabled <unit>`, then stop it with `bin/host-for-human 4388 --name owned-review-first-use --stop`.
