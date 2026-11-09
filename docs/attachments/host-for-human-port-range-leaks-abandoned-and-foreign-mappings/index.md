# Independent CLI encounter

Tested revision: `64b1f3996c3f7ef059f69ad82067da5c2ff74655`.

## Predictions recorded before setup

- A scratch foreign mapping to a refused TCP port will be removed during allocation, with its identity reported on stderr; the new review will use that HTTPS port.
- A scratch foreign mapping to a listening upstream will remain untouched while another review is allocated.
- An owned reservation with a removed directory, or an inactive service, will be reclaimed on allocation.
- `--run` will return a checked HTTPS URL; a subsequent shell will still fetch the fixture and CSS after the launching shell exits. Its service will be enabled for reboot. `--stop` will remove its mapping and close its upstream TCP port.

## Setup

Linux user systemd 259, Python 3, existing mlegls Tailscale authentication on beelink.tail9d5828.ts.net. Checkout owns only scratch reviews created during this encounter. Initial mappings: 443, 4443, 8443, 10005; none in 10000–10003. Fixture and entry command are the implementer's committed setup. No credentials or database state required. CLI/API journey only; no rendered UI evaluated.

Entry (from this checkout):

```sh
bin/host-for-human --run 'python3 -m http.server 14388 --bind 127.0.0.1 --directory docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture' 14388 --name drive2-owned
```

Readiness: returned checked page and CSS URLs at `https://beelink.tail9d5828.ts.net:10000/`. Separate launching shells exited normally; subsequent CLI calls used the surviving service.

## Actions, observations and replayable checks

1. **Refused foreign mapping: held; prediction met.** Created a scratch mapping with `tailscale serve --bg --https=10000 http://127.0.0.1:14389` (no listener). Ran entry above. stderr reported `removed refused mapping HTTPS 10000 -> http://127.0.0.1:14389`; new review used 10000. Accept removal naming both HTTPS port and refused upstream, followed by successful checked allocation at that port.
2. **Listening foreign mapping: held; prediction met.** Created `tailscale serve --bg --https=10001 http://127.0.0.1:14388`, pointing at the first review's listening server. Started a second review using the entry command with port 14390 and name `drive2-second`. New URL used 10002. `tailscale serve status` retained 10001 pointing to 14388 and 10000 pointing to 14388. Accept untouched live mapping and allocation on another port.
3. **Inactive owned service: held; prediction met.** `systemctl --user list-units 'host-for-human*'` identified the sole first-review service as `host-for-human-29270ec33099e34524c4.service`; list-unit-files reported enabled. Stopped that exact service, then allocated port 14391 as `drive2-third`. stderr: `reclaimed review 'drive2-owned': http://127.0.0.1:14388 (HTTPS 10000)`. New review used 10000. The now-refused scratch foreign mapping at 10001 was also removed, with an explicit message. Accept reclaim of inactive reservation and successful reuse.
4. **Removed owned directory: held; prediction met.** After stopping the second and third reviews, created `.wm/drive2-directory`, published it with `bin/host-for-human .wm/drive2-directory --name drive2-directory`, then removed that empty directory with `rmdir`. Allocated the fixture command on 14388 as `drive2-final`. stderr: `reclaimed review 'drive2-directory': http://127.0.0.1:59045 (HTTPS 10000)`; final review used 10000. Accept successful reuse with named reclaim.
5. **Shell-independent upstream and stop: held; prediction met.** After the first launching shell exited, independent curl commands fetched page and `/review.css`, both HTTP 200. Systemd reported the service active/running and enabled. Final review also fetched HTTP 200. `bin/host-for-human 14388 --name drive2-final --stop` removed its mapping; Python socket `connect_ex(('127.0.0.1',14388))` returned 111 (connection refused). Accept working HTTPS after launcher exit, enabled service, then absent mapping and closed upstream on stop. Actual host reboot was not performed on this shared machine; enabled state is the observed reboot-persistence mechanism, not a reboot trial.

## Frictions and expectations formed during use

No unresolved product friction. Cleanup initially tried removing already-reclaimed scratch targets: Tailscale said `handler does not exist`, and host-for-human said `no review named 'drive2-owned'`. These matched the preceding successful reclamations; subsequent cleanup omitted those targets.

## Cleanup

All scratch reviews stopped or reclaimed, all scratch mappings removed. Final Tailscale status exactly retained the initial ports 443, 4443, 8443, 10005; no 10000–10003 mappings. No loaded host-for-human units remained; state directory contained only `publish.lock` and `service-helper.py`. No processes or external resources left running by this driver.

## Review

Read `bin/host-for-human` against the ticket; no repairs needed. Checked: `py_compile` passes; reclamation runs under the publish lock; a foreign port is removed only when every handler is a refused proxy; owned unmapping is guarded by `proxy_at == proxy`; `--stop` unmaps before stopping the unit, and `ExecStopPost` is then a no-op. The diff range also carries other tickets' merged work, not reviewed here. Probed the documented forking-command claim with `systemd-run --user -p Type=exec -p ExitType=cgroup sh -c '(sleep 20 &); exit 0'`: the unit stayed active after the shell returned and stopped on `systemctl stop` (probe unit removed). Driver outcomes stand on the committed packet; all four stories held.

Observation left open: `agent-prompts/universal.md` and the artboard skill still tell agents to publish an already-running Lavish port; neither mentions `--run`, so agents don't yet use the lifetime feature. Untested with Lavish itself (its server must start on a port that is free beforehand).
