#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
export PATH="$root/dsh/node_modules/.bin:$PATH"
export DSH_HOME="${DSH_HOME:-$root/dsh/.local/dispatch}"
bun "$root/dsh/dispatch/config.ts" "$DSH_HOME/dispatch.yml"
export DSH_TOOLS_MODE=ptc
unset PI_BOARD_TOPIC PI_BOARD_NAME PI_WM_RUN PI_WM_HANDLE PI_WM_AGENT PI_WM_PARENT_SESSION
if [[ ${1:-} == web ]]; then
  shift
  exec dsh web --patch "$root/dsh/cordis.yml" \
    --patch "$DSH_HOME/dispatch.yml" \
    --patch "$root/dsh/provider.deepseek.yml" "$@"
fi
exec dsh --profile headless \
  --patch "$root/dsh/cordis.yml" \
  --patch "$DSH_HOME/dispatch.yml" \
  --patch "$root/dsh/dispatch-headless.yml" \
  --patch "$root/dsh/provider.deepseek.yml" "$@"
