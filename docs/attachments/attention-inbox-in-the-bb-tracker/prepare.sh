#!/usr/bin/env bash
set -euo pipefail
# This fixture is owned by the Attention first-use drive, not a real project.
package=$(cd "$(dirname "$0")/../../.." && pwd)
target=/home/mlegls/dev/attention-panel-disposable
owner=thr_m6p2dzhyip
[[ -d "$target/.git" ]] || { echo 'Missing owned disposable repository' >&2; exit 1; }
cd "$target"
helper="$package/bin/desk"
"$helper" attention remove 'Choose a rollout' --thread "$owner"
"$helper" attention remove 'Replace the demo key' --thread "$owner"
# A read while empty retires previous answered records for these fixture items.
bb plugin rpc call tracker attention --json >/dev/null
rm -f "$target/.env"
printf '%s\n' 'Start with the small rollout or enable it everywhere?' '' 'Recommended: Start small and expand after the first use.' |
  "$helper" attention add 'Choose a rollout' --thread "$owner" --file -
printf '%s\n' 'The demo key expired. Supply a replacement.' |
  "$helper" attention add 'Replace the demo key' --thread "$owner" --file - \
    --secret 'DEMO_API_KEY=Disposable API key for first use' --write-env "$target/.env"
