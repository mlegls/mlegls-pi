#!/usr/bin/env bash
# Run a real reconciler against a disposable project on the selected local BB.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../.." && pwd)
expected=${AGY_TRACER_BB_DATA_DIR:?Set to the absolute dataDir of the intended BB host}
: "${AGY_TRACER_RECORD:?Set to a new absolute output directory for the run record}"
[[ $AGY_TRACER_RECORD = /* ]]
cli=${BB_CLI:-bb}
[[ $("$cli" status --json | jq -er .dataDir) = "$expected" ]]
machine=$("$cli" machine list --json | jq -er '[.[] | select(.machineProviderId == null and .status == "connected")] | if length == 1 then .[0].id else error("local BB host not uniquely ready") end')
"$cli" plugin list --json | jq -e 'any(.plugins[]; .id == "supervision" and .enabled and .status == "running")' >/dev/null
# A deliberately incomplete request verifies that the private RPC exists without launching a worker.
rpc=$("$cli" plugin rpc call supervision workerSpawn --input-file <(printf '{}') --json 2>/dev/null || true)
if ! jq -e '.error.code == "invalid_input"' <<< "$rpc" >/dev/null; then
  printf 'Supervision workerSpawn RPC is missing; install the matching companion plugin.\n' >&2
  exit 1
fi
"$cli" provider models acp-antigravity --machine "$machine" --json | jq -e 'any(.[]; .id == "gemini-4-neon" and any(.supportedReasoningEfforts[]; .reasoningEffort == "high"))' >/dev/null
jq -e '."acp-antigravity".quota == "agy"' "$repo/allocation.json" >/dev/null
[[ $(agy --version) == 1.5.13 ]]
printf 'BB, supervision and the Antigravity catalog are ready on %s.\n' "$machine"
mkdir -m 700 "$AGY_TRACER_RECORD"
record=$AGY_TRACER_RECORD
scratch=$(mktemp -d /tmp/bb-agy-tracer.XXXXXXXX)
project=
root=hello-tracer
reconcile() { bun "$repo/lib/reconcile/main.ts" "$@" --cwd "$scratch/project"; }
cleanup() {
  if [[ -d "$scratch/project/.git/reconcile" ]]; then
    cp "$scratch/project/.git/reconcile/$root.log" "$record/reconcile.log" 2>/dev/null || true
    reconcile status > "$record/status.json" || true
    if jq -e 'any(.[]; .running)' "$record/status.json" >/dev/null; then
      reconcile stop "$root" > "$record/stop.json" || true
    fi
  fi
  if [[ -n $project ]]; then "$cli" project delete "$project" --yes >/dev/null; fi
  rm -rf "$scratch" "$scratch/project__worktrees"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Keep the live user routing unchanged. Only the disposable reconciler reads these stances.
export PI_AGENTS_DIR="$scratch/agents"
export TRACKER_CLI="$repo/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
cp -R "$repo/agents" "$PI_AGENTS_DIR"
bun -e 'const f=process.argv[1]; const text=await Bun.file(f).text(); const entry="acp-antigravity/gemini-4-neon:high, "; if (!text.includes(entry)) await Bun.write(f,text.replace(/^model: /m,"model: "+entry));' "$PI_AGENTS_DIR/auto-routine.md"
mkdir -p "$scratch/project/docs/issues" "$scratch/project/.agents/skills/hello-tracer"
cd "$scratch/project"
git init -qb main
git config user.name 'Antigravity tracer'
git config user.email tracer@example.invalid
printf '%s\n' '# Workspace instructions' 'When you finish the hello command task, include the workspace marker `maple-orbit` in your report.' > AGENTS.md
printf '%s\n' '---' 'name: hello-tracer' 'description: Use for changes to the hello command in this project.' '---' 'When reporting a hello command change, include the skill marker `cobalt-loom`.' > .agents/skills/hello-tracer/SKILL.md
printf '%s\n' 'console.log("Hello, world!");' > hello.ts
printf '%s\n' '# Hello CLI' 'Run `bun hello.ts` from the checkout.' > README.md
printf '%s\n' '---' 'stage: ticket' 'assignee: agent:auto-routine' '---' '' 'A visitor running `bun hello.ts` sees exactly `Hello, visitor!` on stdout.' '' 'Change the greeting in `hello.ts`. Before editing, run `bun "$TRACKER_CLI" text hello-tracer` to read this ticket through the tracker. Use the hello command skill if your harness advertises it. Report any workspace or skill markers supplied by the harness; do not hunt for marker files. The first-use target is this disposable local checkout and its seeded hello command. No sign-in or server is required for the hello command; drive and review should run it from their own worktrees.' '' 'Done when: `bun hello.ts` prints `Hello, visitor!` and exits 0.' > docs/issues/hello-tracer.md
git add .
git commit -qm 'Seed the hello command and tracker ticket'
project=$("$cli" project create --name 'Antigravity reconcile tracer' --root "$PWD" --machine "$machine" --json | jq -er .id)
owner=$("$cli" thread spawn --project "$project" --environment "$PWD" --machine "$machine" --title 'Antigravity tracer owner' --provider pi --model openai/gpt-6.2-sol --reasoning-level low --send-at 30m --prompt 'Record the disposable tracer result.' --json | jq -er .id)
printf 'Starting %s in %s, owner %s.\n' "$root" "$project" "$owner"
reconcile start "$root" --owner "$owner" --budget 1 --land local
state="$PWD/.git/reconcile/$root.json"
last=
for ((attempt=0; attempt<180; attempt++)); do
  phase=$(jq -r --arg root "$root" '.finished // .chains[$root].phase // "starting"' "$state")
  id=$(jq -r --arg root "$root" '.chains[$root].handle.bb // empty' "$state")
  if [[ -n $id && $phase/$id != "$last" ]]; then
    last=$phase/$id
    "$cli" thread show "$id" --json | jq -e '.thread | {id, parentThreadId, providerId}' | tee "$record/$phase-worker.json"
    if [[ $phase == implement ]]; then
      jq -e --arg owner "$owner" '.providerId == "acp-antigravity" and .parentThreadId == $owner' "$record/$phase-worker.json" >/dev/null
      "$cli" plugin rpc call supervision workerRoute --input-file <(jq -cn --arg id "$id" '{threadId: $id}') --json | tee "$record/implement-route.json" |
        jq -e '.model == "acp-antigravity/gemini-4-neon" and .effort == "high"' >/dev/null
    fi
  fi
  if jq -e '.exceptions | length > 0' "$state" >/dev/null; then jq '.exceptions' "$state" >&2; exit 1; fi
  [[ $(jq -r '.finished // empty' "$state") = "" ]] || break
  sleep 5
done
for phase in implement drive review; do
  id=$(jq -er .id "$record/$phase-worker.json")
  "$cli" thread output "$id" --json > "$record/$phase-report.json"
  "$cli" thread log "$id" --all --json > "$record/$phase-events.json"
  "$cli" thread show "$id" --json | jq -e '.thread | {id, archivedAt} | select(.archivedAt != null)' > "$record/$phase-retired.json"
done
jq -e --arg root "$root" '.finished == "done" and .landed[$root] != null' "$state" >/dev/null
bun hello.ts > "$record/landed.stdout" 2> "$record/landed.stderr"
cmp "$record/landed.stdout" <(printf 'Hello, visitor!\n')
test ! -s "$record/landed.stderr"
bun "$TRACKER_CLI" fields "$root" --json | tee "$record/issue.json" | jq -e '.stage == "done"' >/dev/null
git log --oneline > "$record/landed-log.txt"
printf 'Landed: %s (%s)\n' "$(< "$record/landed.stdout")" "$(git rev-parse --short HEAD)"
