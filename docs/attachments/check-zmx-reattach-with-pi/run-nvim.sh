#!/bin/sh
set -eu
export PATH="$HOME/.nix-profile/bin:$PATH"
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec nvim -u NONE -i NONE -n "$here/control.txt"
