# Independent combined drive

## Predictions before first use

Two requests filed through this checkout's helper should appear together in the signed-in Attention panel for the disposable project. Taking the recommendation and quoting its question should populate that item's editable reply. A password entered for the other item should be sent alongside the decision in one owner message, without the password itself. The dotenv should contain the supplied assignment with mode 0600; both items should become answered and the badge drop by two. Removing both through the helper should remove their panel entries without reload.

## Preparation

Resolved the required collector merge, preserving credentials and notification behavior, in 863964362702b26da35c0a91cf27e591fbfdb2f4. `mise run setup` completed successfully. Project metadata confirms proj_846b5mt9ew uses /home/mlegls/dev/attention-panel-disposable on host_a22uydxjy2. Inherited owner thr_m6p2dzhyip and deployment are parent-owned.

## Encounter

`prepare.sh` completed successfully using this checkout's helper. The attention RPC returned both items, their common owner and the full secret destination. Opened the inherited signed-in desktop BB profile on host_w74xscm3fz, window 1, in an owned automation tab at `/plugins/tracker/attention`. The rendered panel and RPC established readiness; an anonymous curl returned 401, as expected for this signed-in surface.

Clicked Take the recommendation, selected the question with a DOM Range, clicked Quote selection and filled the credential password input with an invented value. [Drafts](drive9-drafts.jpg) shows Send (2), badge 5, independent decision reply with quote and masked credential. Clicked Send once: both items collapsed as Answered, project count became 0 and badge became 3 ([answered](drive9-answered.jpg)).

The newest owner user message in `bb thread log thr_m6p2dzhyip --limit 4` contained both headings, the recommendation and question quote, and `Wrote DEMO_API_KEY to /home/mlegls/dev/attention-panel-disposable/.env`. It contained no submitted value. The owner acknowledged both titles and the notice. Exactly one new grouped user message appeared for this send.

Checked the dotenv assignment against the invented input without printing its content: matched; file mode was 600. My initial literal comparison failed because dotenv values are single-quoted; comparing the enclosed value succeeded. This was a measurement correction, not a product failure.

Removed both titles using this checkout's helper from the disposable checkout. Without reload, neither item nor its project group remained ([removed](drive9-removed.jpg)). No product friction encountered. All predictions met.

## Replay checks

Run prepare.sh; expect two unanswered disposable requests. Click recommendation, select its question and Quote selection; expect the recommendation followed by a `> ` question, with the credential item's reply untouched. Fill only that item's password and click Send; expect one grouped owner message without the value, a matching dotenv assignment at mode 600, collapsed answered entries, and a badge decrease of two. Remove both titles through the helper; expect the project group to disappear without reload.

English dark-theme desktop captures, 1280×720, live interactions. Selection was established programmatically; quote and send used real panel controls. Closed the owned desktop session/tab; started no server and changed no plugin installation. Parent-owned fixture remains with empty attention and the invented dotenv assignment; prepare.sh clears it on replay. No tests run or repairs made beyond the explicitly required merge resolution.
