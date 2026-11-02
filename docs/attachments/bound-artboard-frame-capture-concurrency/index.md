# Artboard capture first use

## Scope and prepared target

Implementation first use, not independent acceptance. Base: `8580fd5e45313dc80d5f906dcfbd65c96ec4319f`.

The required surface is the artboard CLI with Storybook frames. The prepared target is a **local, mocked Storybook-shaped fixture**, not a real Storybook deployment. The committed HTML supplies a visible root immediately and a `.panel` after 2200ms. Eight frames use that panel, with `wait: 0` to isolate selector readiness from animation settle. No authentication, secrets, external state or seed step. All fixtures belong to this checkout.

## Replay from the repository root

Use a directory with `@playwright/test` installed and its Chromium browser available. On the implementation host the existing dependency is at `/home/mlegls/dev/mmon/concept/packages/web/package.json`. This is only a module-resolution source; no service or data from that checkout is used.

Start the fixture in a managed process (the printed port is dynamically allocated):

```sh
bun -e 'const base = process.cwd() + "/docs/attachments/bound-artboard-frame-capture-concurrency/"; const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() { return new Response(Bun.file(base + "iframe.html")); } }); console.log("ARTBOARD_FIXTURE_PORT=" + server.port); console.log("fixture ready");'
```

After `fixture ready`, export its printed port and the dependency path. Readiness check: `curl --fail http://127.0.0.1:$ARTBOARD_FIXTURE_PORT/iframe.html` must return the fixture HTML before building.

```sh
export ARTBOARD_FIXTURE_PORT=<printed-port>
export ARTBOARD_PLAYWRIGHT=/home/mlegls/dev/mmon/concept/packages/web/package.json
ARTBOARD_CONCURRENCY=3 bun skills/enabled/all/mlegls/artboard/scripts/canvas.ts docs/attachments/bound-artboard-frame-capture-concurrency/layout.json --out .wm/artboard-first-use
```

The runnable entry point above writes `.wm/artboard-first-use/canvas.html`. Unset `ARTBOARD_CONCURRENCY` and use another output directory to try the default. Replace `layout.json` with `missing-story.json` or `missing-file.json` for the expected failures (exit 1). Set `ARTBOARD_CONCURRENCY=0` with `layout.json` for the expected configuration failure. Stop the fixture process when done.

## Observed first use (2026-11-02)

- Readiness: HTTP request returned fixture HTML on checkout-owned port 37787.
- `ARTBOARD_CONCURRENCY=3`: eight captures succeeded, about 8 seconds total. Generated canvas contained eight copies of “Panel ready after 2200ms”.
- Environment variable unset (default 6): eight captures succeeded, about 5 seconds; generated canvas contained eight ready panels.
- Missing story selector: exited 1 after the 30-second selector timeout: `Missing story panel (missing-panel): waitForSelector: Timeout 30000ms exceeded.`
- Missing file selector: exited 1: `Missing file panel (iframe.html): evaluate: Error: No element matches .absent`
- Concurrency 0: exited 1 with `ARTBOARD_CONCURRENCY must be a positive integer`.
- No existing artboard regression tests were found. No permanent tests were added. Project TypeScript configuration includes only `lib` and `extensions`, not this script.
- Fixture server stopped after use. No resident services or browser pages left open.

These CLI/DOM observations do not reproduce the historical shared-host load spike or establish a visual-layout claim; the independent driver can use these fixtures or an available real Storybook. No screenshots were taken.
