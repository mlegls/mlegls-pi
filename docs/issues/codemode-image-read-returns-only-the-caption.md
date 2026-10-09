---
stage: idea
assignee: agent
author: "session:53c0d69f-e221-4a86-b75d-9cf3b3c46e6a"
priority: 3
---

During Concept's `drive-the-joined-review-and-checkpoint-paths` packet collection, codemode's `tools.read({path: ".../01-joined-path.png"})` returned a string containing only `Read image file [image/png]` and resize instructions, not the image block documented in the installed pi `docs/codemode.md`. `image(await tools.read(...))` failed with `invalid image output. Pass a base64 data URI instead`. A second read confirmed `typeof result === "string"` and its entire 134-character caption.

The successful workaround read the PNG bytes with Bun in bash, returned base64 to codemode and called `image("data:image/png;base64," + result.output.trim())`. This displayed the actual 1280×2631 frame. No image transport implementation was investigated or repaired. Owner is the pi codemode read bridge or its advertised return contract, not Concept's screenshot files.
