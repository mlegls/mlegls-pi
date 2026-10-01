#!/bin/sh
# Isolated local sidebar surface: no personal sessions, board, UI state or tmux client.
set -eu
repo=$(cd "$(dirname "$0")/../../.." && pwd)
root=${2:?usage: first-use.sh seed|sidebar|main|stop /absolute/owned-directory}
case "$root" in /*) ;; *) echo "root must be absolute" >&2; exit 2 ;; esac
export TMUX_TMPDIR="$root" PI_CODING_AGENT_DIR="$root/agent"
export XDG_STATE_HOME="$root/state" XDG_CACHE_HOME="$root/cache" PI_BOARD_DIR="$root/board"
unset TMUX TMUX_PANE
case "$1" in
seed)
  [ ! -e "$root" ] || { echo 'seed requires a new directory' >&2; exit 1; }
  mkdir -p "$root/agent/sessions/fixture" "$root/state/ab-tree"
  touch "$root/.sidebar-bridge-owned"
  git init -q "$root/sidebar-fixture"
  git -C "$root/sidebar-fixture" -c user.name=Fixture -c user.email=fixture@example.invalid commit -q --allow-empty -m fixture
  git -C "$root/sidebar-fixture" worktree add -q -b child "$root/child"
  export FIXTURE_ROOT="$root"
  bun -e 'import {writeFileSync} from "node:fs";
    const r=process.env.FIXTURE_ROOT;
    const now=new Date().toISOString();
    for(let i=0;i<24;i++) writeFileSync(`${r}/agent/sessions/fixture/${i}.jsonl`,
      JSON.stringify({type:"session",id:`fixture-${i}`,cwd:i%2?`${r}/child`:`${r}/sidebar-fixture`,timestamp:now})+"\n"+
      JSON.stringify({type:"session_info",name:`Parked fixture ${i}`})+"\n");
    writeFileSync(`${r}/state/ab-tree/ui.json`,JSON.stringify({collapsed:[],preview:45,view:"workspaces",sidebarView:"workspaces"}));'
  tmux -f /dev/null new-session -d -s fixture-main -c "$root/sidebar-fixture" "printf 'isolated main terminal\\n'; exec sleep 3600"
  i=0; while [ "$i" -lt 20 ]; do
    tmux new-session -d -s "free-$i" -c "$root" "exec sleep 3600"
    i=$((i+1))
  done
  ;;
sidebar)
  [ -f "$root/.sidebar-bridge-owned" ]
  # The legacy AppleScript helpers address Ghostty's front window, not a new
  # Cua-owned app instance. Keep this isolated trial from resizing that window.
  unset GHOSTTY_RESOURCES_DIR
  printf '\033]2;ab tree\007'
  cd "$repo"
  exec "$repo/bin/ab" tree ui --sidebar
  ;;
main)
  [ -f "$root/.sidebar-bridge-owned" ]
  exec tmux attach -t fixture-main
  ;;
stop)
  [ -f "$root/.sidebar-bridge-owned" ]
  tmux kill-server
  rm -rf "$root"
  ;;
*) exit 2 ;;
esac
