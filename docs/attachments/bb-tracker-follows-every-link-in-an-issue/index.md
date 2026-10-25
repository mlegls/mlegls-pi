# Tracker file-link implementation trial

**Rendered first use now held:** [signed-in desktop encounter, setup and replay](desktop-first-use.md), 2026-10-25. Mission, the attachment and `prepare-cases-first.ts` each opened in a file preview. This supersedes the authentication gap below for these three requested clicks; the earlier trials remain historical evidence.

Independent second drive: [predictions, setup blocker and replay checks](drive-2.md). It again reached only the authentication gate; no rendered product claim was observed.

Tested revision: `3588187e` (base `7c2a34585db21c7d82825f299a0428af1b78854d`). This is an implementation setup/API trial, **not rendered acceptance**.

## Setup

Required target: bb with the tracker pane, Obsidian at Home installed, and the existing concept issue `replay-cases-first-by-default`. No application seed or model credentials are needed. Browser persona: the account authorized to access the operator's bb.

Actually prepared: isolated plugin `tracker-link-preview`, on server host `host_w74xscm3fz`, under `/Users/mlegls/.bb-worker-setups/tracker-link-preview/bb/tracker`. The canonical tracker installation and checkout were unchanged. `bb plugin install . --yes` succeeded after `bun install --frozen-lockfile`; `bb plugin dev .` watched it and reported two successful rebuild/reload cycles after final source updates. `projects` and `resolveLinks` RPC calls succeeded. The temporary plugin, watcher, terminal sessions and copy were removed after the trial.

To reproduce after checking out the tested revision **on the bb server host**, use the existing build/install tooling:

```sh
root="$HOME/.bb-worker-setups/tracker-link-preview"
mkdir -p "$root"
git archive HEAD bb/tracker | tar -xf - -C "$root"
cd "$root/bb/tracker"
bun -e 'const p = await Bun.file("package.json").json(); p.name = "bb-plugin-tracker-link-preview"; p.bb.name = "Tracker link preview"; await Bun.write("package.json", JSON.stringify(p, null, 2));'
bun install --frozen-lockfile
bb plugin install . --yes
bb plugin dev .
```

Direct entry point attempted: <https://mlegls.getbb.app/plugins/tracker-link-preview/issues/proj_fgz6kudzrk/replay-cases-first-by-default>. Stop the watcher and run `bb plugin remove tracker-link-preview` after use; remove only the owned `$root` copy.

## Observed results

- Typecheck: `cd bb/tracker && bunx tsc --noEmit -p .` passed on final code.
- Build: `NODE_PATH=/home/mlegls/.local/share/mise/installs/node/24/lib/node_modules bb plugin build bb/tracker` passed; live dev rebuilt the final sources on the server host.
- Live `resolveLinks` input used project `proj_fgz6kudzrk`, slug `replay-cases-first-by-default`. Five destinations returned host targets on `host_w74xscm3fz` with these exact paths:
  - Mission wikilink → `/Users/mlegls/dev/mmon/concept/docs/application/concepts/Mission.md`.
  - `../../docs/attachments/tutor-reverses-the-learners-selected-cases-first-method/index.md` → `/Users/mlegls/dev/mmon/concept/docs/attachments/tutor-reverses-the-learners-selected-cases-first-method/index.md`.
  - `../../packages/web/scripts/prepare-cases-first.ts` → `/Users/mlegls/dev/mmon/concept/packages/web/scripts/prepare-cases-first.ts`.
  - `../../AGENTS.md#live-models` → `/Users/mlegls/dev/mmon/concept/AGENTS.md` (heading dropped: SDK supports line/range locations, not headings).
  - `[[projects/mlegls-pi/verification-evidence]]` → `/Users/mlegls/dev/mlegls-pi/docs/verification-evidence.md`.
- Unknown project and `../../not-a-file.md` returned null targets with unresolved/missing explanations.
- No existing tracker-pane regression tests were found; no permanent tests were added.

## Unobservable rendered claims

The session-private MCP browser reached only bb Connect's account gate: “Sign in with the account that owns this server to open it.” It could not reach the pane. Thus concept/attachment/repository preview opening, missing-file plain-text presentation, and preserved in-page issue navigation are **unobservable**, not passed. No screenshot is offered as product evidence. The requested three clicks still need an authenticated browser.

The supervisor subsequently authorized review and landing with this rendered check remaining **unobservable**: neither the worker nor the owner's available browser reaches an authenticated bb Connect session. The maintainer will click the three links on first use after landing; the linked browser-setup issue retains the gap. This is an explicit acceptance boundary, not a claim that the rendered journey passed.

## Click-path code trace for review

In `bb/tracker/app.tsx`, `linkify` converts the Mission wikilink to `#tracker-file=<encoded target>`. Relative attachment and repository links retain their Markdown destinations. `Detail` scans the rendered anchors and sends all three destinations to `resolveLinks`. Successful results are stored in `files.current` keyed by the returned original `href`, without altering the returned `{kind, hostId, path}` target.

The pane's `onClickCapture` handles each file anchor before the Markdown link's own activation: it prevents default navigation and propagation, looks up that same `href`, and calls `navigate.experimental_openFilePreview({ target, location: null })` with the stored RPC target. Thus the concept, attachment and repository paths listed above share the same preview dispatch, with no target reconstruction in the click handler. Issue destinations take the earlier `#tracker-issue` branch and call `open`; external schemes bypass interception. Null-target results lose their `href` and receive the missing-file explanation as their title. This trace is static code evidence only; a fresh reviewer should inspect it alongside the RPC observations.

Tooling observations: [[projects/mlegls-pi/issues/bb-plugin-build-cannot-find-mise-npm-on-enrolled-host]] records the local build's npm lookup failure and successful NODE_PATH workaround. [[projects/mlegls-pi/issues/remote-bb-pane-drive-needs-authenticated-browser]] records the remaining browser setup gap.
