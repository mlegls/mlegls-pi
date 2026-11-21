# Pi Memory (bb plugin)

A nav page, **Pi memory**, over the records store that `extensions/context` writes: notes logs (`extensions/context/notes.ts`) and lives (`extensions/context/life`). Read-only.

- `read.ts` (bun, this checkout's own code): `index`, `notes <log>`, `notes-zoom <log> <lo-hi>`, `life <id>`, `life-zoom <id> <first> <n>`, each printing JSON.
- `server.ts` exposes those over RPC by running `read.ts` with bun.
- `app.tsx` is the page.

Install from the canonical checkout so the plugin keeps reading this repo's code: `cd ~/dev/mlegls-pi/bb-plugins/pi-memory && npm install && bb plugin install . --yes`. Settings: `checkout`, `bun`, `store` (as `PI_BOARD_DIR`).
