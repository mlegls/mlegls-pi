# Concept Engineering: real named-agent setup

Installed runtime: `0b11e6c3b4e67b7060901f0368e238f8dcd98433` in `/home/mlegls/dev/mlegls-pi`. Setup branch merged installed main as `58e7ebc1`. This is first-use setup on the Beelink, not the week-long trial or its acceptance by the founder.

## Owned files and landing

- Concept main: `76a71eb1ea50cd92618673b857676c9a810be2e1`, also observed at `origin/main`. Adds `agents/concept-engineering/SOUL.md`, `skills/engineering-taste/SKILL.md` and `references/research.md`. Soul has the profile description and exactly `anthropic/claude-fable-5-2:medium`; its body drops `(profile concept-engineering)`. The skill drops the Hermes-shell sentence. The Concept commit hook formatted Markdown and passed typecheck and lint. Other profile files and skills are unchanged.
- system-config master: `e35f76e`, committed locally. Only its three registry lines were staged; pre-existing device/changelog, MCP and mise edits were left alone. Registry is `~/dev/mmon/concept/agents`, so any repository uses the Concept main checkout. Machine notes settings remain off.
- Hermes source files remain intact. Only job `06c0f323b60e` was paused, using `hermes -p concept-engineering cron pause 06c0f323b60e`.

## Runnable target

Required and prepared: real machine-wide `/concept-engineering` on the Beelink, Concept BB project `proj_fgz6kudzrk`, main checkout environment `env_mzbcgghp7n`, host `host_a22uydxjy2`, `/home/mlegls/dev/mmon/concept`. Authentication is the installed Pi Anthropic subscription credential. No web deployment or application seed is involved.

Terminal entry point (from any checkout):

```sh
pi --model agent/concept-engineering
```

BB entry point, used for the first session:

```sh
bb thread spawn --project proj_fgz6kudzrk --environment env_mzbcgghp7n --provider pi --model agent/concept-engineering --reasoning-level medium --title 'Concept Engineering' --prompt 'What are you holding?'
```

First real thread: @thread:thr_9hjpcsjipp. Second fresh continuity encounter: @thread:thr_renzt5tzne. They are top-level threads, not children. Setup stops their runtimes after its checks; the owner can resume either or start a fresh named-agent thread.

## Observed first use

1. Imported Hermes history before the first live session, using `bun extensions/context/life/import-hermes.ts concept-engineering`. Nine sessions, fourteen runs, 277 copied messages; no surviving compaction wrappers. The importer reads the real Hermes SQLite database read-only.
2. BB selected `agent/concept-engineering`; the persisted session records medium thinking and assistant messages identify `anthropic/claude-fable-5-2`. The agent identified the real soul path, saw the private skill's exact description and read it; `note` was available. See [session receipts](session-receipts.json).
3. The attached agent saved all four MEMORY entries and USER facts as seven global notes, ids #0–#6, each at most 280 bytes. No project notes or settings changes. The exact import request is [import-notes.txt](import-notes.txt); the note tool results are in the session receipts.
4. BB automation `auto_1yjcfelkko8` is enabled in the Concept project, on `agent/concept-engineering`, medium, environment `env_mzbcgghp7n`, cron `0 9 * * 0`, timezone `Asia/Shanghai`. Its prompt equals the retained Hermes job prompt byte-for-byte. Hermes job remains defined, disabled and paused. See [settings and automation](settings-and-automation.json). Reversal: pause this BB automation and resume the retained Hermes job; ordinary trial use is through the life only.
5. Asked why the founder declined a dedicated Simplified Chinese review pass, the agent answered that his girlfriend already uses the Chinese interface and reports issues. `zoom({id:49,n:1})` returned the copied Bot Chat message and source `hermes:concept-engineering/20261108_221538_44a911/da525f825cbf49199660200dddc898ff#0`, dated 2026-11-09T05:51:46.864Z. No Hermes files or repository documents were read for the answer. The retained tool result is in the session receipts.
6. At 05:23:18Z all 152 longer imported messages had leaf summaries and none was missing (the review's 161 was an earlier count; this is the current import measured with the runtime's `source` and `NODE_BYTES`). The final read-only Chat snapshot at 05:24:35Z reports all 295 current messages summarized and no unbuilt node at any complete tree level; see [final state](progress-and-recall.txt). Eight initial summaries waited for abandoned startup leases to expire, then completed; the reproduction is recorded in tracker issue `life-compactor-lease-outlives-its-builder`. No `life: compaction failed: empty reply` warning was observed.

7. Fresh BB thread `thr_renzt5tzne`, started with the same named model after the compactor finished, independently listed global notes #0–#6, the exact private skill description, and the Chinese-review answer without tools. It reported every imported-history line summarized. The read-only readiness snapshot and its response are retained in the final state receipt.

The week of ordinary use, the owner's own BB recall question and the founder's judgment belong to the trial owner, Concept Strategy.

Visual: false. No browser, screenshots, dev server or containers were needed.
