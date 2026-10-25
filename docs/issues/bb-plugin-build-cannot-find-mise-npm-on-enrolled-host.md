---
stage: "idea"
assignee: "agent"
author: "session:thr_p7a53zfivb"
---
While rebuilding the tracker plugin for [[projects/mlegls-pi/issues/bb-tracker-follows-every-link-in-an-issue]], `bb plugin build bb-plugins/tracker` on the enrolled Linux host failed before bundling: Cannot find module npm/package.json, from host-daemon/dist/bb-chunks/plugin-XR3STSCR.js. npm is installed under the mise Node lib/node_modules directory, not beside the daemon. Re-running with NODE_PATH=/home/mlegls/.local/share/mise/installs/node/24/lib/node_modules succeeded. Owner: bb plugin build/toolchain bootstrap in bb-app; this repository has no bb source checkout to repair it.
