---
stage: done
assignee: agent
author: "session:53c0d69f-e221-4a86-b75d-9cf3b3c46e6a"
priority: 3
---
Done: in codemode, `await tools.read({path: "x.png"})` resolves to pi's documented image block `{type: "image", data, mimeType, note}` that `image()` accepts, and text files still resolve to their text. Test in `lib/outline-read` asserting `structuredContent` for an image and a text read, plus a multi-file read.

Cause (2026-10-14 triage): this repo's `lib/outline-read/read.ts` overrides pi's `read` tool without pi's `outputSchema` and `structuredContent`, so codemode falls back to the text content (the caption). pi's built-in (`dist/core/tools/read.js`, `toReadOutput`) declares `outputSchema: String | {type:image,data,mimeType,note}` and returns `structuredContent`. Declare the same output schema and return `structuredContent` from `execute` (pass through the builtin result's for images; the merged text otherwise). Decide what a multi-path read with an image returns and document it in the tool description. Reproduced 2026-10-14 with a 1×1 PNG.

During Concept's `drive-the-joined-review-and-checkpoint-paths` packet collection, codemode's `tools.read({path: ".../01-joined-path.png"})` returned a string containing only `Read image file [image/png]` and resize instructions, not the image block documented in the installed pi `docs/codemode.md`. `image(await tools.read(...))` failed with `invalid image output. Pass a base64 data URI instead`. A second read confirmed `typeof result === "string"` and its entire 134-character caption.

The same failure recurred on 2026-10-09 while reconciling Concept's audit evidence (`reconcile-audit-evidence-and-prototype-access`, session `b12315c3-b5bd-41b5-a4c5-8d71c03e0f25`): reading `/tmp/audit-guard-contact.jpg` through codemode and passing it to `image()` returned `invalid image output`. `base64 -i /tmp/audit-guard-contact.jpg` through bash, then `image("data:image/jpeg;base64," + result.output.replace(/\s/g, ""))`, displayed both contact sheets. No bridge source was changed.

Recurred during Concept's Agent 0.7.2 artifact-repair first use, 2026-10-10 local, session `66976788-d5c5-45cc-8fab-e391fbe067bc`: reading `session.png` returned only `Read image file [image/png]`; passing that string to `image()` failed with the same invalid-output error. A second PNG read confirmed the caption-only string. The two 1440×1000 frames were inspected by converting disposable copies to JPEG, returning base64 from Bun in 35,000-character chunks (to stay below bash's output cap), and passing the combined data URI to `image()`. Original PNG evidence remains in Concept's `docs/attachments/agent-patch-artifact-repair/`. No bridge source was changed.

The successful workaround read the PNG bytes with Bun in bash, returned base64 to codemode and called `image("data:image/png;base64," + result.output.trim())`. This displayed the actual 1280×2631 frame. No image transport implementation was investigated or repaired. Owner is the pi codemode read bridge or its advertised return contract, not Concept's screenshot files.

Recurred 2026-10-13 in Concept mounted catalog first-use (session 01a132e6-2aac-7757-ab82-c90c5553accd): tools.read(author-en.png) returned only the 26-character caption string; image(result) refused it. Bun byte-to-base64 conversion through bash followed by image(data URI) displayed the original 1440×960 frame successfully. No bridge code changed. Evidence owner: Concept docs/attachments/mount-the-resource-tutor-catalog/index.md.

## Result

done

I resolved the pending merge of collector 62b59416. Only `lib/outline-read/read.test.ts` conflicted. I kept both tests (the image/text/multi-file read contract and the quoted-path test) and combined their imports, then committed the merge as `549fa6e1`. I ran `mise run setup` afterwards.

Checks on the merged head:
- `bun test lib/outline-read`: 45 pass, 0 fail.
- `bun run typecheck`: clean.
- The driver's `try-read.ts` still produces `image/png` output items.

I reviewed the diff against the ticket and found nothing to repair. The output schema, `structuredContent` handling and multi-file shape match the ticket's contract and the tool description. I did not run `mise run test:affected`, because the project declares no such task. I appended a short review note to the packet's `index.md` and committed it.

```yaml
commit: 549fa6e1 (merge), plus the review-note commit on top
stories:
  - story: Image read returns a block accepted by image()
    outcome: held
  - story: Text read remains a string
    outcome: held
  - story: Multi-path reads preserve text and usable images
    outcome: held
evidence:
  path: docs/attachments/codemode-image-read-returns-only-the-caption/index.md
  visual: false
  shots: []
tests:
  - lib/outline-read/read.test.ts
caveats:
  - The driver verified the library and QuickJS entry point, not a fresh installed pi session.
  - The installed pi 1.2.0 builtin read may return `structuredContent` itself. The repo's pinned pi 1.0.0 does not, so `readOutput` in `lib/outline-read/read.ts` builds the image block from the result content when it is missing.
```

Evidence: [docs/attachments/codemode-image-read-returns-only-the-caption/index.md](docs/attachments/codemode-image-read-returns-only-the-caption/index.md)
