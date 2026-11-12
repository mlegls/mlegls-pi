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

## Review (2026-11-12)

The maintainer's amendment (links in an item open where the Issues page opens them: an issue in the Issues page, a file in bb's file preview) was not in the plugin when driver 9 ran, and drive 9 didn't exercise it. Before the repair, an item's wikilinks and relative links rendered through bare `<Markdown>` and fell to bb's external opener.

Repair, plugin commit `602606f` on branch `attention-panel` of `bb-plugins`: the Issues page's `linkify`, post-render file resolution and click routing moved to `tracker/doc-links.ts` (`useDocLinks`) and both pages use it. `resolveLinks` takes no `slug` when the base is the project's `desk/ATTENTION.md`; the project may be any bb project, with or without a vault. Issue wikilinks to a repository that has a tracker project open in the Issues panel for that project; any other wikilink is a file link.

Re-drive on the signed-in desktop profile (plugin rebuilt and reloaded from the branch), disposable project, one item with `[[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]]`, `[[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]]`, `[rel](../README.md)` and `[[projects/nonexistent/stories/nope]]`:

- Issue link → URL became `/plugins/tracker/issues/proj_xzgxqiaesb/attention-inbox-in-the-bb-tracker`, ticket shown ([issue](review-links-issue.jpg)).
- File link → bb's file preview opened `docs/stories/answer-what-agents-ask-of-me.md` beside the panel ([attention](review-links-attention.jpg), [preview](review-links-file-preview.jpg)).
- The two dead links lost their `href` and carry the reason as title (`File does not exist: …/README.md`, `Unresolved file: …`), as on the Issues page.
- Issues page after the refactor: its file link opened the preview and its issue links navigated, as before.

Item removed afterwards with the helper; owned browser session closed. Replay: add an item whose body has the links above (`bin/desk attention add` in the disposable checkout), open Attention, click each.
