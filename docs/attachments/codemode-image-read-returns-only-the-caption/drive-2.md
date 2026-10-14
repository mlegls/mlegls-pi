# Independent first-use drive

## Before use

Revision: 4d24e97c7faf501848823e141866ba7af5be919b.
Setup: local library/QuickJS sandbox in this worker checkout; no authentication. Committed entry point exists; worker setup completed per supplied log. Entry: `bun docs/attachments/codemode-image-read-returns-only-the-caption/try-read.ts`. Temporary PNG/text seed is owned and cleaned by that entry.

Predictions from ticket and handoff (before opening product):
- A single PNG read resolves to an object with type=image, base64 data, MIME type and note; image(result) accepts it rather than refusing a caption string.
- A text read resolves to its text string.
- A multiple-path read has a deliberate documented result; I expect merged text to preserve text content, with any image behavior clearly identified.

No implementation, tests or fixtures inspected.

## Encounter and results

1. Ran the supplied entry unchanged: exit 0, `ok: true`; two image outputs (PNG, 73 decoded bytes) and two text outputs.
2. Used its documented optional script argument to inspect public return values and call `image()` directly. Exit 0, `ok: true`.
   - PNG: object, type `image`, MIME `image/png`, data length 100, note `Read image file [image/png]`. `image(png)` emitted a 73-byte PNG without error. **Held; prediction met.**
   - Text: string `hello.txt (1 lines)\nhello from text`. **Held; prediction met.**
   - Mixed `hello.txt x.png`: array of length two, first entry the same text string, second an image block; `image(mixed[1])` emitted the PNG without error. Two text paths returned a single merged string separated by a blank line. **Held; prediction met.** The prepared user-facing index describes the mixed-array behavior and optional script entry.

## Replayable checks

Run the documented entry with this optional script argument:

```js
const png = await tools.read({path: "x.png"});
text({kind: typeof png, type: png.type, mimeType: png.mimeType, dataLength: png.data.length, note: png.note});
image(png);
const txt = await tools.read({path: "hello.txt"});
text({kind: typeof txt, value: txt});
const mixed = await tools.read({path: "hello.txt x.png"});
text({array: Array.isArray(mixed), length: mixed.length, first: mixed[0], secondType: mixed[1].type});
image(mixed[1]);
const texts = await tools.read({path: "hello.txt hello.txt"});
text({kind: typeof texts, value: texts});
```

Accept object/image/PNG with nonempty data and note, successful image emission, text string preservation, ordered mixed array with usable image, and merged two-text string. Both executions above met these observations.

## Frictions and limits

No encounter friction. Nonvisual library journey: no rendered UI or screenshots. This verifies the handed-off checkout library/QuickJS entry, not an independently launched installed pi session. As its user-facing index explains, the entry supplies structured-result selection; the current long-lived agent's tool registration is not the deployment under test. No implementation or repository checks run. Both processes finished; temporary state was managed by the supplied entry, and no server or external deployment was started.

