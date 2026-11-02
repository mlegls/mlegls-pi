# Review pages over Tailscale HTTPS

```sh
host-for-human ./review --name design-review
host-for-human 4387 --name lavish-review
```

Requires Python 3, Tailscale signed in with Serve enabled, and (for a directory) Linux user systemd. HTTPS ports 10000–10003 are the host's mapped review range. Occupied ports are left alone; exhaustion is an error. The command prints only the checked URL to stdout. It fetches the page and the first referenced stylesheet or script over HTTPS; a page with no such reference is checked by itself. An artboard directory without `index.html` opens `canvas.html` directly.

Directory mode starts a transient `host-for-human-<identity hash>.service` in user systemd, independent of the publishing thread's turn/process. Systemd restarts crashes; re-running the same command recreates a stopped server and retains its HTTPS port. Keep the source directory until review ends. Port mode publishes an existing server; its original owner remains responsible for running/restarting it.

The stable name defaults to the absolute directory or `port-<port>`. A name belongs to one target: re-run with that target to repair a dead link. Metadata in `${XDG_STATE_HOME:-~/.local/state}/host-for-human/*.json` records owner thread, last publishing thread, purpose, directory, systemd unit, upstream port, HTTPS port and URL. Failed checks retain the reservation for repair at the same URL. Service logs are available through `journalctl --user -u <unit>`.

When the review ends, remove only its mapping and owned directory server:

```sh
host-for-human ./review --name design-review --stop
```

Port-mode cleanup leaves the external server running. `--stop` refuses to remove a mapping whose upstream has changed since publication. Host reboot persistence is not provided by these transient units; re-run the publishing command after a reboot.

## First-use fixture

From the checkout being verified:

```sh
bin/host-for-human docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture --name review-page-first-use
```

This is the direct story entry point: it serves the committed fixture and checks HTTPS HTML plus relative CSS. Find its `unit` in the metadata and use `systemctl --user stop <unit>` to simulate a dead server. Re-run the same entry command: expect the same checked URL. `systemctl --user kill --signal=SIGKILL <unit>` instead exercises automatic crash recovery. Finish with the entry command plus `--stop`.
