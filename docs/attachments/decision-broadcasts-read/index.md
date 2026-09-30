# decision-broadcasts-read — first-use drive

## Starting state and predictions (before opening the report or running its CLI)

- Tested revision: `62bbcb30429fa76b247b3bfffb4bbec00e79ef4b`.
- Persona: research reader using the delivered report and its reproduction CLI. No authentication or secrets needed.
- Deployment: none. Shared source corpus is local, live-appending JSONL in `~/.pi/agent/sessions` and `~/.local/share/pi-board/log.jsonl`; no seeding or backend restart authorized or needed.
- Owned output target: `/Users/mlegls/dev/mlegls-pi__worktrees/decision-broadcasts-read-drive/analysis/decision-broadcasts-read/`. Starting checkout clean; committed scripts and report are present. Python 3.14.7 is available.
- Handoff entry point: `python3 analysis/decision-broadcasts-read/extract.py` (about four minutes), then `python3 analysis/decision-broadcasts-read/analyze.py`. Wait for extraction to finish before analysis.
- Nonvisual surface: CLI output, report Markdown and generated research data; no browser journey or screenshots.
- Independence limit: the required coordination-board read exposed the implementer's conclusions before this prediction log. Predictions below derive from the ticket's requested measurements, not those numerical conclusions. No source, diffs, tests or fixtures read.

| Story | Prediction and intended action |
| --- | --- |
| Per-decision peer readership | Run the entry points and open the report. Expect an identifiable factor-finish decision corpus, each decision's timestamp and peer list/count, with subsequent reads and at least-one-read fraction. Expect counts and fraction to reconcile. |
| Push versus pull | Expect subscription injections counted as reads but separately flagged, and peer identity distinct from the original decision sender. Inspect the report and delivered data for those distinctions. |
| Comparison with acks | Expect comparison against the 34 board-wide acks, with scope/window explicitly distinguished from factor-finish decisions and no use of the later reads.jsonl as historical evidence. |
| Visible relays and limits | Expect visible parent relays recorded separately, and limits that distinguish lack of direct read evidence from proof of ignorance. |
| Reproduction and delivery | Expect both commands to finish successfully in this worktree without services or external mutation, write usable outputs into their own directory, and agree with the delivered report. Expect the ticket to lead a reader to the answer. |

## Session log

2026-09-30: Checked the ticket, README, supplied setup and verification instructions. No services, deployment selectors, credentials or browser sessions used. Initial predictions committed before product use.
