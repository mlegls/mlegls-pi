// bun test preload: tests that check the roster against this checkout's routing.md read
// this checkout's agents/, not the host's ~/.pi/agent/agents (a symlink to whichever
// checkout is canonical, whose roster can name models this catalog lacks).
// An explicit PI_AGENTS_DIR still wins.
import { fileURLToPath } from 'node:url';

process.env.PI_AGENTS_DIR ??= fileURLToPath(new URL('../agents', import.meta.url));
