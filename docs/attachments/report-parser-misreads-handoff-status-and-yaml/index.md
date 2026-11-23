# Report parser — coordinator first use

## Predictions before opening the library

- If a worker leads with `done`, a `### Blocked` section heading or a `- blocked` prose bullet will leave that status intact and raise no conflict. I will send each form separately.
- If a report includes unrelated YAML before its handoff, I will receive the handoff. If several fences contain handoff keys, I will receive the last eligible one, even with unrelated YAML after it.
- If a visual reviewer sends a handoff containing only `data`, I will receive the nested payload intact.

## Setup and readiness

Candidate `07610cbf` in the driver worktree, using Bun and the existing lockfile dependencies. The coordinator supplies a worker report on stdin; no auth, server, or persisted data. The [setup recipe](implementation-first-use.md) returned `done`, the final `data` payload, and `handoffError: null`.

## Drive and replay

From the candidate checkout, pipe each report below into the public parser entry point:

```sh
bun -e 'import { parse } from "./lib/report.ts"; console.log(JSON.stringify(parse(await Bun.stdin.text()), null, 2));'
```

Start each report with `done` and a blank line. For rows with mappings, wrap each mapping separately in `~~~yaml` / `~~~` lines, in the order shown. Each row is a fresh invocation. The observed result is also the replay acceptance check. All calls exited zero with `status: done` and `handoffError: null`.

| Appended report content | Observed result | Prediction |
| --- | --- | --- |
| `### Blocked` | No handoff; heading retained in the body | Met |
| `- blocked` | No handoff; bullet retained in the body | Met |
| `sample: first`, then `setup: actual handoff` | Only `setup: actual handoff` in the handoff | Met |
| `setup: earlier`, then `setup: later`, then `sample: final` | Only `setup: later` in the handoff | Met |
| `data: {blocking: [], nits: [check contrast]}` | `data` retained with empty `blocking` and one `nits` entry, `check contrast` | Met |

All three ticket stories held. No friction encountered; no services started. This is library evidence with no rendered state.

## Review

The candidate narrowed the prefix stripping inside `statusAt`, which also serves the leading line and the line after a short heading. That regressed reports that open with a Markdown heading or quote: on `dda7aacd` each of `## Done` + prose, `# Done`, `> done — ok` and `Report:` / `## blocked` parsed to `status: null`, where the base `6e253b30` returned the sentinel. The repair restores the prefix stripping in `statusAt` and keeps the bare-word requirement only in the later standalone scan.

Re-driven on the repaired head with the same `bun -e` entry point:

| Report | Result |
| --- | --- |
| `## Done`, blank, prose | `done` |
| `> done — ok` | `done` |
| `# Done` | `done` |
| `Report:` then `## blocked` | `blocked` |
| `done` + `### Blocked` / `- blocked` / `> blocked` | `done`, no conflict |
| `done` + bare `blocked` line | conflict `done, blocked` (unchanged) |
| driver rows 3–5 (unrelated YAML, last eligible fence, data-only) | same as the driver's observations |

`bun test lib/report.test.ts`: 17 pass.
