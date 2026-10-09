---
stage: idea
assignee: agent
author: "session:53c0d69f-e221-4a86-b75d-9cf3b3c46e6a"
priority: 3
---

During Concept's `drive-the-joined-review-and-checkpoint-paths` packet collection, codemode's `tools.read({path: ".../01-joined-path.png"})` returned a string containing only `Read image file [image/png]` and resize instructions, not the image block documented in the installed pi `docs/codemode.md`. `image(await tools.read(...))` failed with `invalid image output. Pass a base64 data URI instead`. A second read confirmed `typeof result === "string"` and its entire 134-character caption.

The same failure recurred on 2026-10-09 while reconciling Concept's audit evidence (`reconcile-audit-evidence-and-prototype-access`, session `b12315c3-b5bd-41b5-a4c5-8d71c03e0f25`): reading `/tmp/audit-guard-contact.jpg` through codemode and passing it to `image()` returned `invalid image output`. `base64 -i /tmp/audit-guard-contact.jpg` through bash, then `image("data:image/jpeg;base64," + result.output.replace(/\s/g, ""))`, displayed both contact sheets. No bridge source was changed.

Recurred during Concept's Agent 0.7.2 artifact-repair first use, 2026-10-10 local, session `66976788-d5c5-45cc-8fab-e391fbe067bc`: reading `session.png` returned only `Read image file [image/png]`; passing that string to `image()` failed with the same invalid-output error. A second PNG read confirmed the caption-only string. The two 1440×1000 frames were inspected by converting disposable copies to JPEG, returning base64 from Bun in 35,000-character chunks (to stay below bash's output cap), and passing the combined data URI to `image()`. Original PNG evidence remains in Concept's `docs/attachments/agent-patch-artifact-repair/`. No bridge source was changed.

The successful workaround read the PNG bytes with Bun in bash, returned base64 to codemode and called `image("data:image/png;base64," + result.output.trim())`. This displayed the actual 1280×2631 frame. No image transport implementation was investigated or repaired. Owner is the pi codemode read bridge or its advertised return contract, not Concept's screenshot files.
