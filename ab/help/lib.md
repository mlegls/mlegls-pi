ab lib MODULE [FN] [ARG...]

Import lib/MODULE.ts and call FN (dotted paths allowed) with ARGs, each parsed as
JSON when possible. Without FN, list the module's exports. Results print as text,
.render(), or JSON. For anything more than a call, import the module directly:
  bun -e 'import * as m from "~/dev/mlegls-pi/lib/route.ts"; ...'
Host-bound modules (board, wm, computer's native ui) need the pi session and fail here.
