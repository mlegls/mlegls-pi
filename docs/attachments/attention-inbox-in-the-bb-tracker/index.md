# Combined desk → Attention first use

Independent verification on the merged collector: [drive 9](drive-9.md). All combined claims held; three fresh rendered captures and replay checks are recorded there.

Links in an item open where the Issues page opens them (issue → Issues panel, file → bb's file preview): driven in the [review section of drive 9](drive-9.md#review-2026-11-12).

## Predictions before first use

Using this checkout's desk helper to file a recommended decision and a secret request for the same disposable owner should render two unanswered items in Attention. Taking the recommendation and quoting the question should fill only the decision draft. Sending it with an invented password should deliver one message naming both items, containing the quote and write notice but no value; the dotenv should hold the assignment, both items should collapse and the badge should decrease by two. When the owner removes its requests with the helper, both should disappear without a page reload.

## Target

Package base `8abf0ec64f90d2b7c781735d1ab6e96140f54c3a`; plugin `bb19629`, enabled from `/home/mlegls/dev/bb-plugins__worktrees/attention-panel/tracker`. Inherited disposable project `proj_846b5mt9ew` (no vault), owner `thr_m6p2dzhyip`, local checkout `/home/mlegls/dev/attention-panel-disposable` on Beelink. Project and owner metadata confirmed these selectors before reset. Entry `/plugins/tracker/attention` answered HTTP 200 on the live bb server before opening. Persona: maintainer through the signed-in BB desktop profile; no real credential used.

Replay preparation: `bash docs/attachments/attention-inbox-in-the-bb-tracker/prepare.sh` from this package checkout. It uses the changed helper, the owned fixture only, and a read between removal and re-addition to retire answered records. Open `/plugins/tracker/attention` in the signed-in BB desktop profile. This drive used the normal Connect origin on MacBook host `host_w74xscm3fz`, BB window 1, in an owned desktop automation tab. No new server was needed.

## Encounter and evidence

All required combined first-use claims held on the revisions above:

1. Ran `prepare.sh` with this checkout's `bin/desk`. Both helper invocations returned the disposable desk immediately. The panel rendered the two items under **attention-panel-disposable 2**, with its owner chip and the secret description/full destination. Other projects' items were left untouched.
2. Clicked **Take the recommendation**, selected the question using a DOM Range, then clicked **Quote selection**. The decision draft contained the recommendation followed by a blank line and `> Start with the small rollout or enable it everywhere?`; the key item's prose draft remained empty. Filled the password with an invented test string. **Send (2)** and rail badge **5** are visible in [drafts](01-drafts.jpg). Selection state was programmatically established; the quote button itself was clicked through the live page.
3. Clicked **Send** once. Both items collapsed to **Answered**, project unanswered count became **0**, Send disabled, and rail badge changed **5 → 3**: [answered](02-answered.jpg). No page reload was used.
4. Read `bb thread log thr_m6p2dzhyip --limit 6`: exactly one new user message for this send named both items and contained the quote and write notice. The owner acknowledged both headings and the write notice. The message was:

   ```markdown
   ## Choose a rollout

   Start small and expand after the first use.

   > Start with the small rollout or enable it everywhere?

   ## Replace the demo key

   Wrote DEMO_API_KEY to /home/mlegls/dev/attention-panel-disposable/.env
   ```

   Read the disposable dotenv and confirmed `DEMO_API_KEY` matched the invented submitted string. `stat -c '%a'` returned `600`. The string was absent from the grouped owner message; no real credential was used. Value omitted from this durable packet.
5. Asked the owning agent to run this checkout's helper to remove both titles. It reported both removed. The file contained only `# Attention`, and a subsequent DOM read without reload showed the disposable project group absent and badge still **3**: [removed](03-removed.jpg).

Screenshots are live interactions in English, dark theme, 1280×720. The first shows the editable recommendation and quote, masked credential and full path; the second shows the two collapsed items and badge; the third shows the project group removed. These are selected frames, not a mocked panel.

## Replay checks and cleanup

Replay `prepare.sh`, then the actions above. Expect two items for this owner, an independent quoted decision draft, a password-only credential item included by Send, one new grouped owner message without the test value, a matching mode-0600 dotenv assignment, and a two-count badge decrease. Ask the owner to remove both titles; expect disappearance without reload. The unrelated badge baseline can change as other projects work.

No product friction or repair was encountered in this combined drive. Only docs, the replay setup and evidence changed; `bash -n prepare.sh` and `git diff --check` passed. No new tests were added and no full suite was run. This is an implementer's first use; independent acceptance remains the following verifier's responsibility.

Closed the owned desktop automation session/tab. No server was started or plugin installation changed. The inherited disposable project/owner and plugin deployment remain parent-owned for the next verifier; the fixture currently has no attention items and retains only the invented dotenv value. `prepare.sh` removes that value on reset. Plugin install/restore steps are in the plugin's `tracker/docs/attention-first-use.md`; the supervisor must install the canonical plugin after merging before retiring the implementation worktree. The separate README-only branch is `attention-inbox-join-docs`, based on plugin `bb19629`; its worktree is `/home/mlegls/dev/bb-plugins__worktrees/attention-inbox-join-docs` and remains parent-owned until integration.
