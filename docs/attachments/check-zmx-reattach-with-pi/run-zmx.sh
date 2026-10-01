#!/bin/sh
# Use a separate socket directory: cleanup never targets other zmx sessions.
set -eu
export PATH="$HOME/.bun/bin:$HOME/.local/share/mise/installs/bun/latest/bin:$HOME/.config/pi-bun/entry:$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"
export ZMX_DIR="${ZMX_DIR:-/tmp/zmx-reattach-owned}"
unset ZMX_SESSION ZMX_SESSION_PREFIX
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v zmx >/dev/null; then
  exec nix shell nixpkgs#zmx --command "$0" "$@"
fi
case "${1:-pi}" in
  pi) exec zmx attach check-pi "$here/run-pi.sh" ;;
  nvim) exec zmx attach check-nvim nvim -u NONE -i NONE -n "$here/control.txt" ;;
  *) exec zmx "$@" ;;
esac
