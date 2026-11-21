#!/usr/bin/env bash
# Start after bringing up the disposable BB described in index.md.
set -euo pipefail
: "${BB_DATA_DIR:?}" "${PI_AGENTS_DIR:?}" "${BB_CLI:?}"
repo=$(cd "$(dirname "$0")/../../.." && pwd)
test "$("$BB_CLI" status --json | jq -er .dataDir)" = "$BB_DATA_DIR"
"$BB_CLI" machine list --json | jq -e 'any(.[]; .machineProviderId == null and .status == "connected")' >/dev/null
"$BB_CLI" plugin list --json | jq -e 'any(.plugins[]; .id == "supervision" and .enabled and .status == "running")' >/dev/null
printf 'Local BB ready. Creating scratch project and scheduled caller.\n' >&2
scratch=$(mktemp -d "$(dirname "$BB_DATA_DIR")/owned-drive.XXXXXXXX")
cd "$scratch"
git init -qb main
git config user.name Fixture
git config user.email fixture@example.invalid
git -c commit.gpgsign=false commit --allow-empty -qm seed
project=$("$BB_CLI" project create --name 'Worker provider smoke' --root "$scratch" --json | jq -er .id)
# A scheduled turn gives us a real caller thread without using a third model turn.
BB_THREAD_ID=$("$BB_CLI" thread spawn --project "$project" --environment "$scratch" --title 'Worker provider smoke caller' \
  --provider pi --model openai/gpt-6.1-sol --reasoning-level low --send-at 30m --prompt 'Reply done' --json | jq -er .id)
export BB_THREAD_ID
trap '"$BB_CLI" thread archive "$BB_THREAD_ID" >/dev/null || true' EXIT
mkdir -p "$PI_AGENTS_DIR"
printf '%s\n' '---' 'model: codex/gpt-6.2-sol:low, openai/gpt-6.1-sol:low' 'checkpoint: 0.65' '---' 'Small disposable smoke change.' > "$PI_AGENTS_DIR/provider-smoke.md"
printf 'Dispatching Codex and Pi from %s.\n' "$BB_THREAD_ID" >&2
receipt=$(bun "$repo/lib/reconcile/tool.ts" dispatch <<'JSON'
{"run":"worker-provider-smoke","maxConcurrent":2,"active":[],"assignments":[{"handle":"native-codex","agent":"provider-smoke","issue":"worker-provider-codex","assignee":"agent","prompt":"Create and commit a checkout root file named CODEX_SMOKE containing the word codex. Report only by ending your turn with done."},{"handle":"native-pi","issue":"worker-provider-pi","assignee":"agent","model":"openai/gpt-6.1-sol","effort":"low","prompt":"Create and commit a checkout root file named PI_SMOKE containing the word pi. Report only by ending your turn with done."}]}
JSON
)
printf '%s\n' "$receipt"
jq -e '.submitted | length == 2' <<< "$receipt" >/dev/null
for provider in codex pi; do
  handle="native-$provider"
  id=$(jq -er --arg handle "$handle" '.submitted[] | select(.handle == $handle) | .bb' <<< "$receipt")
  "$BB_CLI" thread show "$id" --json | jq -e --arg provider "$provider" --arg parent "$BB_THREAD_ID" \
    '.thread | select(.providerId == $provider and .parentThreadId == $parent) | {id, title, providerId, parentThreadId}'
  "$BB_CLI" thread wait "$id" --status idle --timeout 180 >/dev/null
  "$BB_CLI" thread log "$id" --all --json | jq -e \
    '[.[] | select(.type == "provider.env-resolved") | .data.entries[] | select(.source == {plugin:"supervision"} and (.name | test("^PI_WM_|^PI_CHECKPOINT$"))) | {name,value}] | select(length > 0) | unique'
  "$BB_CLI" thread output "$id" --json | jq -er '.output | select(test("^done\\b"; "i"))'
  printf '{"worker":"%s"}\n' "$handle" | bun "$repo/lib/reconcile/tool.ts" integrate
  "$BB_CLI" thread show "$id" --json | jq -e '.thread | select(.archivedAt != null) | {id, archivedAt}'
done
git log -3 --oneline
git show HEAD:CODEX_SMOKE
git show HEAD:PI_SMOKE
test -z "$(git status --porcelain)"
