---
stage: "idea"
assignee: "human"
author: "session:thr_nijxp6tvsi"
---
Maintainer, 2026-10-28: "it seems annotation is broken in lavish pages served over getbb.app".

A Lavish session opened at `https://mlegls--4387.getbb.app/session/<key>` (port 4387 shared with `bb connect expose`, server started with `LAVISH_AXI_ALLOWED_HOSTS=mlegls--4387.getbb.app`) shows the artifact and the chrome, and its events WebSocket connects (101). But clicking an element does nothing: no request is sent and no annotation card opens.

Cause, seen over CDP in the bb desktop browser on 2026-10-28 (lavish-axi 0.1.92):

- Lavish renders the artifact in `<iframe sandbox="allow-scripts …">` without `allow-same-origin`, so the artifact document has an opaque origin. It loads the annotation SDK as a subresource, `<script src="/sdk.js?key=…">`.
- From an opaque origin that request is cross-site, so Chrome withholds bb Connect's `SameSite=Lax` session cookies (`__Secure-better-auth.session_token`, `__Secure-bb-connect.desktop_session`; CDP blockedReasons `SchemefulSameSiteLax`).
- The Connect gate answers 401 `text/html` (its sign-in page), Chrome blocks it with `net::ERR_BLOCKED_BY_ORB`, and the SDK never runs. The iframe navigation itself carries the cookies and returns 200, which is why the page looks fine.

Locally (`127.0.0.1`, Tailscale) there is no gate, so the same request succeeds. Any other relative asset an artifact loads (CSS, images, `/design/…`) should fail the same way over Connect (not tested directly). The latest lavish-axi (0.1.94) injects the SDK the same way.

The proxy isn't at fault for the API: it rewrites `Host` and `Origin` to `127.0.0.1:<port>`, so Lavish's same-origin checks pass, and API calls return 200.

Possible fixes (none chosen):
- bb Connect: let a shared port's own sandboxed frames load subresources without the session cookie, e.g. `SameSite=None` on the shared-port session cookie. bb's change to make; the only option that fixes annotation and assets everywhere.
- lavish-axi upstream (github.com/kunchenguid/lavish-axi): inline the SDK into the artifact HTML instead of referencing `/sdk.js`. Fixes annotation, not artifact assets.
- Local shim: a small proxy in front of 4387 that inlines `/sdk.js` (and local assets) into `/artifact/…/index.html`, exposed in place of 4387.
