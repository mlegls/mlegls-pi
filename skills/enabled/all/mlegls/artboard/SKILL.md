---
name: artboard
description: "Use when the user requests an artboard: HTML frames arranged on a shared canvas."
argument-hint: "[what to design]"
disable-model-invocation: true
---

Each frame is a self-contained HTML file with inline CSS/SVG, relative images,
and linked fonts. Sibling `canvas.html` displays the set.

1. Use the agreed direction, fidelity, content, and app or brand sources.
2. Write `Main.html` for the leading frame and named siblings for the rest.
3. Copy [canvas.html](canvas.html) and fill its `#layout` JSON.
4. Inspect with `chrome-devtools-axi` and return the canvas path.

## Canvas format

```json
{
  "artboards": [
    { "file": "Main.html", "x": 0, "y": 0, "w": 1440, "h": 900, "title": "Home", "page": "flows" },
    { "file": "Card.html", "x": 0, "y": 1020, "w": 400, "h": 240, "page": "sheet" }
  ],
  "notes": [{ "id": "brief", "x": 0, "y": -160, "w": 240, "text": "Decision to make", "page": "flows" }],
  "pages": [{ "id": "flows", "name": "Flows" }, { "id": "sheet", "name": "Components" }]
}
```

Dimensions are canvas pixels at zoom 1; each frame's root matches its declared
size. Allow room above frames for their name strips. `pages` separates sets,
not printed sheets; omit it and `notes` when unnecessary.

Useful sizes: phone 390×844, desktop 1440×900. At 96 px/in: A4 794×1123,
Letter 816×1056, Tabloid 1056×1632, A5 559×794. A trifold's outer face runs
inside flap, back cover, front cover from left to right; its inner face is one
spread. Print layout answers to reading distance and folding, not web-page
conventions.
