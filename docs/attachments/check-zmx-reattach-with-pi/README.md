# zmx reattach observation packet

Verdict and limits: [check-zmx-reattach-with-pi](../../issues/check-zmx-reattach-with-pi.md).

## Captures

Original Cua window PNGs, not desktop captures. Display content is synthetic.

- Pi baseline: `direct-pi.png`, `zmx-pi-before.png`.
- Fresh reattach: `zmx-pi-reattached.png`; native history: `direct-pi-scrollback.png`, `zmx-pi-scrollback.png`.
- Attached resize: `direct-pi-resized.png`, `zmx-pi-resized-attached.png`.
- Detached size change and subsequent update: `zmx-pi-resized-detached.png`, `zmx-pi-live-after-reattach.png`.
- Nvim initial baseline: `direct-nvim.png`, `zmx-nvim-before.png`.
- Unpaired later state: `zmx-nvim-reattached.png` (cursor 147, not the initial cursor 1).
- Attached resize: `direct-nvim-resized.png`, `zmx-nvim-resized-attached.png` (different cursor positions; compare layout, not identity).
- Detached size change: `zmx-nvim-resized-detached.png`.
- Controlled final comparison: `direct-nvim-narrow.png`, `zmx-nvim-controlled-reattach.png`.

## Terminal snapshots

`*.vt` are raw `zmx history <session> --vt` output. They contain escape sequences; inspect in a disposable terminal, not by printing into an active agent UI.

These comparisons passed:

```sh
cmp pi-before.vt pi-reattached.vt
cmp nvim-controlled-before.vt nvim-controlled-reattached.vt
```

Pi pair SHA-256: `17e34f1833c4f1f0c5c2878e9e1da5245ef6052dd76efc5d81da070539e5dcef`.
Controlled nvim pair SHA-256: `1ab2973349ce77fe15286daf3bc13d3b72f7417689e7d2400bb6cb50fb9942c4`.

The resized pi snapshots each retain ROW-001 through ROW-090. They are not expected to be byte-identical across dimensions. The initial/unpaired nvim snapshots also differ; no preservation claim uses that pair.

## Reproduce

Requires Ghostty, pi, Bun, nvim, and zmx (or Nix). Launchers include this machine's usual executable locations. `run-zmx.sh` obtains zmx via a one-off `nix shell nixpkgs#zmx` if absent; nixpkgs is not pinned, so check the version when repeating. No repo dependency configuration was changed.

Run from this directory in a separately opened Ghostty window:

```sh
./run-pi.sh             # direct, synthetic persisted session, no model request
./run-zmx.sh pi         # isolated check-pi
./run-nvim.sh           # direct alternate-screen control
./run-zmx.sh nvim       # isolated check-nvim
```

Each command is a separate encounter. Scroll natively to inspect early rows. In another shell, use `./run-zmx.sh history check-pi --vt` to capture state, then `ZMX_SESSION=check-pi ZMX_DIR=/tmp/zmx-reattach-owned zmx detach` to detach. Reopen the launcher at the same size, then resize while attached. Detach and reopen a narrower window for the detached-size-change case. The observed Ghostty launches used 166×39 cells initially and 83×22 cells for the narrow surface; attached resize was approximately 720×500 points.

For a model-free live update, send the literal bytes of `!printf 'LIVE-AFTER-REATTACH\\n'\r` to check-pi. Before a controlled nvim comparison, send `gg`, wait for the displayed cursor/status to settle, and capture a new baseline.

Cleanup from this directory:

```sh
./run-zmx.sh kill check-pi check-nvim
./run-zmx.sh list        # expect no sessions in the isolated directory
```

Close only the observation windows. This run finished with no sessions in `/tmp/zmx-reattach-owned` and only the pre-existing Ghostty process remaining.
