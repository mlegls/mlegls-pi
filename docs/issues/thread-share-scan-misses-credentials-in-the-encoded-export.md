---
stage: "done"
assignee: "agent"
author: "session:01a160b1-7675-74f4-a5d6-2709df2d9580"
priority: 2
---
The thread-share plugin's pre-upload credential scan (`bb-plugins/thread-share`, README line 7) searches pi's exported HTML, but the export carries transcript contents base64-encoded. The 2026-10-22 adversarial review (@thread:thr_hq3sm75vq8, both reviewers) confirmed it with a synthetic check: a dummy credential is detected in plaintext and missed inside the export. The confirmation also precedes a second export, so the bytes uploaded can differ from the bytes scanned and shown. No leak was established; whole-transcript warnings and password protection exist.

Done when the scan reads the decoded transcript (a dummy credential inside an export is found) and the upload sends exactly the bytes the confirmation described. Evidence: [checked synthesis](/Users/mlegls/.bb/thread-storage/thr_hq3sm75vq8/synthesis.md).

## Result

Fixed in bb-plugins 407f8c3 (main on the Linux host, not yet pushed; the running plugin is installed from the Mac checkout /Users/mlegls/dev/bb-plugins/thread-share, which needs it pulled and rebuilt). scannable() in thread-share/share.ts decodes the session-data payload (gunzipping a compressed one) before scanSecrets; inspect keeps the prepared page under a token and publish uploads exactly that page, refusing a stale or missing token. Test: share.test.ts "finds a credential inside the base64 session payload, raw or compressed" (6 pass, tsc clean). No live publish was driven.
