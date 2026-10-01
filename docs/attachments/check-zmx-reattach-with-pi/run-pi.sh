#!/bin/sh
# Observation fixture; resume known display content without a model request.
set -eu
export PATH="$HOME/.bun/bin:$HOME/.local/share/mise/installs/bun/latest/bin:$HOME/.config/pi-bun/entry:$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
seed=$(mktemp "${TMPDIR:-/tmp}/zmx-pi-specimen.XXXXXX")
trap 'rm -f "$seed"' EXIT HUP INT TERM
cp "$here/specimen.jsonl" "$seed"
pi --session "$seed" --no-extensions --no-skills --no-context-files --offline
