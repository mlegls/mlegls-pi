# First-use CLI drive

Tested revision: `b490e134a4725a6c0bf8a4339898d82810c6c45e`.

## Predictions recorded before publishing
- Directory publish prints a Tailscale HTTPS URL after checking HTML and a relative asset; fetching both returns 200. **Met.**
- Killing this identity's static server and rerunning the command restores the exact URL. **Met.**
- The managed server records its owner/purpose and survives the publishing command ending. **Met.**
- The artboard publish step names host-for-human and conventions prohibit bb Connect for human review pages. **Met.**

## Setup and encounter
Deployment: Beelink user-systemd static server with existing host tailnet authentication. Worker identity: `review-page-first-use`. Entry point:

    bin/host-for-human docs/attachments/serve-review-pages-over-tailscale-https-from-a-supervised-process/fixture --name review-page-first-use

Seed: committed fixture supplied by implementer. Runtime state confirmed the directory was in this exact drive-3 checkout, owner and last publisher `thr_wc5uvpiuh6`, purpose `maintainer review page`, local port 40883, unit `host-for-human-2c1213c10a51cb870e4a`. No inherited server was reused. CLI help was the first product surface visited, before publishing; predictions above preceded publishing.

1. Entry command completed successfully, reporting `checked page and asset` for `/review.css` and printing `https://beelink.tail9d5828.ts.net:10002/`.
2. In a subsequent command, independent HTTPS curl requests returned page **200** and CSS **200**. User-systemd reported the unit active/running with description `Review page review-page-first-use (owner thr_wc5uvpiuh6)`. Thus it survived the launch command ending.
3. Issued `systemctl --user kill --signal=SIGKILL host-for-human-2c1213c10a51cb870e4a.service` (only this owned unit). HTTPS request then returned **502**, establishing actual downtime.
4. Repeated the entry command. It printed the exact same HTTPS origin and checked asset. Independent page and CSS requests again returned **200**.
5. Read the user-facing artboard instructions: publish step 4 uses `host-for-human <lavish-port> --name <name>` and the requested HTTPS/no-Connect/re-run instruction. The same instruction is present in `agent-prompts/universal.md:25`.
6. Cleanup: ran the entry command with `--stop`. `systemctl --user is-active` returned `inactive`. No owned server or mapping left running.

## Outcomes and replayable checks
- **held — checked directory publication:** run entry command, then `curl -sS -o /dev/null -w '%{http_code}'` against the printed URL and its `review.css`. Accept only 200 for both and successful checked-asset output.
- **held — recovery on stable URL:** kill only the identity's runtime-state unit, observe 502, repeat entry command; accept identical URL and HTML/CSS 200 afterward.
- **held — supervised lifecycle metadata:** after publish exits, inspect the identity's runtime state under `~/.local/state/host-for-human/` and its user-systemd unit. Accept active service, this checkout's directory, owner thread and review purpose.
- **held — publishing guidance:** inspect artboard publish step and universal agent conventions; accept host-for-human plus Tailscale HTTPS instead of Connect and automatic rerun instruction.

## Frictions and limits
No encountered friction. This is a CLI publishing journey; no browser was opened and no rendered appearance or annotation behavior is claimed. Port-target forwarding was not part of the supplied fixture/recovery acceptance encounter. No unit tests or source/fixture implementation were read or run. No product repairs.

## Review (review-4), same entry point on the final head

Re-drove the fixture under name `review-4-check`: published (HTML and `review.css` checked, 200 both, URL `https://beelink.tail9d5828.ts.net:10002/`); SIGKILL plus stop of the owned unit gave 502; re-run restored the identical URL with 200s; `--stop` removed the mapping, unit and state file. Bad input (missing directory, port 99999) fails with exit 1 and a one-line reason. With 10000/10001/10003 held by foreign mappings, a second concurrent name fails loudly ("no free Tailscale HTTPS port") without touching them. All four stories hold; no repairs made. Not covered by a permanent test (the ticket's "test" is this live fixture check; adding a test needs the maintainer's approval).

Filed: [[projects/mlegls-pi/issues/host-for-human-port-range-leaks-abandoned-and-foreign-mappings]] (the four-port range runs out; reclaim policy is a maintainer decision). Settled [[projects/mlegls-pi/issues/tailscale-review-https-range-is-full]]: already done with result.
