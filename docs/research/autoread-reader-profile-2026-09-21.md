# Autoread reader profile and session diagnosis — 2026-09-21

## Change and verification

Exec accepts `--exec-profile reader` (host override: `PI_EXEC_PROFILE=reader`). It supplies read/find/grep, source selections, state/show/console, and optionally Exa. Module flags can narrow but not widen it. Editing, shell, terminals, UI, coordination, skill-shell expansion, notifications, and automatic lib/project module loading are absent. Imports and OS access remain unrestricted: this is an API profile, not a security sandbox.

Autoread’s private Pi launcher loads exec with this profile. The in-progress BB reader host selects the same profile and allows exec plus recall/submission. The BB integration is separate work; its lifecycle behavior was not changed here.

Manual API drive: a real Kernel retained parallel file reads across cells, searched the retained source, and routed a mock Exa call. Its supplied keys were exactly show/read/grep/find/exa/console/state. All eleven checked write, skill, shell, UI, coordination and library helpers were absent. A real ExtensionRunner loaded the reader flag, omitted Exa with its deny flag, advertised only reading APIs, successfully read a file, and preserved the profile after session-tree reset. No model request was needed for these drives. Live BB child provisioning was not driven here.

`env -u BB_THREAD_ID bun test`: 203 pass, 2 skip, 0 fail. `bunx tsc --noEmit`: pass. In the BB environment, the full suite had 196 pass, 2 skip, 7 failures in board-dependent tests (the host is intentionally disabled under BB). An earlier targeted exec run also hit the terminal-ID failure; that test passed in both subsequent full-suite runs. No tests were added.

SCC against starting ref `0158e17`, scoped to `extensions/exec`: code 3050 → 3075 (+25), complexity 1005 → 1035 (+30). The cost is propagating one profile through tool advertisement, kernel host-call filtering, and runtime capability construction; the existing module boundary is too coarse because fs contains both read and edit. This avoids a separate reader evaluator. The default scc shim has no selected version; the installed aqua:boyter/scc@4.1.0 was used without changing global configuration.

## Session evidence

Inspected @thread:thr_m6g4pdthxc (`/advance correctness-and-minimalism`), provider session `pi_9a063d2f-dc40-4353-95c3-137d8b4f92cc`. All times UTC. Reader transcripts are under `~/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept--/`.

| Attempt | Reader ID | Observation |
| --- | --- | --- |
| 03:22:09 | 01a0c1fc-3fa7-722e-920a-bc635b4487da | Two reader model turns, five tools. Parent awaited before notification; exec killed its kernel at 03:22:49 after a 30-second cell deadline. |
| 03:22:59 | 01a0c1fd-04b3-77c8-a763-318a927ea993 | Eleven reader turns, twenty tools. Parent again awaited early; 120-second exec cell deadline at 03:25:04 destroyed this attempt. |
| 03:27:33 | 01a0c201-3373-7428-af21-a1e0718b2064 | Nineteen reader turns, forty-one tools, no final briefing. Genuine five-minute autoread timeout. Last completed reads were skill instructions at 03:32:08. One unavailable exec call. |
| 03:32:56 | 01a0c206-1fe6-764e-94ff-a644b01a7854 | Reader confused itself with the parent, tried state.preparing through unavailable exec, then returned a non-briefing at 03:33:08. Accepted because it was nonempty text with stopReason=stop. |

The fourth reader’s exact final text began: “That message is the reader fork's own prompt surfacing into the conversation (the preparation subprocess is mid-read); it isn't a request for me to answer.” It then promised to wait for the preparation notification. This was the child answering its explicit reading request, not the parent.

A subsequent triage fork (`01a0c206-56ec-70ad-a456-223e6be6d84d`, gpt-6-astra) recovered: it started at 03:33:10 and produced an audit assignment at 03:34:52. The parent retrieved that result at 03:35:24. Thus apparent eventual success masks a failed orientation stage.

## Prompting versus mechanics

- Reader identity is a prompting/context-boundary problem: restate at the current request that this is the child, inherited state/preparing belongs to the parent and is not present here, and the child must answer now rather than wait. Exec access removes a missing-tool error, not this confusion.
- Preparation scope needs a stopping criterion: establish live frontier, blockers/claims, relevant constraints and entry points; leave the actual research/audit inventory to the assigned session. “Read broadly” alone encourages unbounded preparation.
- Parent premature awaiting is a lifecycle/API problem as well as instruction following. The advance skill already says to wait for notification. A non-destructive status/poll interface would be more robust than relying on another reminder.
- Nonempty prose is not evidence of a successful briefing. Preserve this role-confused output as a regression case when improving completion handling; longer deadlines do not address it.

No role, stopping-rule, or result-acceptance prompts were changed in this patch.
