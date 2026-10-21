# bb thread share

Adds **Publish to ht-ml.app** to the actions menu of every pi thread (thread header, sidebar row, right-click). It uploads pi's HTML export of the thread's session (`pi --export`) to [ht-ml.app](https://ht-ml.app), a third-party host, either as a public link or behind a generated password. The link (and password) are copied to the clipboard.

Once published, the same entry offers: copy link, copy password, open page, republish the current transcript at the same link, add a password, and unpublish. ht-ml.app has no delete: unpublish replaces the page with a placeholder locked behind a discarded password, and adding a password to a public page can leave CDN-cached copies readable for a few minutes.

Before every upload it exports the transcript, scans it for credential-shaped strings (API keys, tokens, private keys, JWTs) and asks for confirmation with the size and any findings. The scan is a hint, not redaction: the export holds every prompt, tool call, command output and file content.

ht-ml.app takes at most 6 MB per request, so the export's embedded session is gzipped (a small loader unpacks it in the browser before pi's viewer runs). When that is still too large, which happens with screenshot-heavy sessions, its images are replaced with a note and the confirmation says so; if even that doesn't fit, it refuses.

Only pi threads show the action: the session file is `<bb data dir>/pi-bridge-sessions/<providerThreadId>.jsonl`, found through the thread's latest `thread/identity` event. The update key and password stay in the plugin's server-side kv (`share:<threadId>`; unpublished sites under `retired:<siteId>`). Setting: `pi` (path to pi; default: found through the login shell).

```sh
bb plugin install .      # once, from this directory
bb plugin dev            # rebuild and reload on save
npx tsc --noEmit -p .
```
