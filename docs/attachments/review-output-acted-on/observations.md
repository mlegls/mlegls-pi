# Selected public evidence

Observed 2026-09-30. These are report/log/commit-metadata observations, not a code review. No source, diffs, tests or fixtures were opened. Shared historical evidence was read-only.

## Delivered document

At tested revision `32523025463142398fc29397d14897b66a80afec`:

- `docs/issues/review-output-acted-on.md:16` requests `## answer`, five report rows and path:line evidence.
- The file ends at line 18: one verdict paragraph, with no `## answer`, table, individual report IDs, timestamps or parent-session lines.
- Line 18 says `13/17 fixed in code within ~1–60 min`, `1/17 substituted`, `3/17 consciously declined`.
- The full table is visible in peer-board message `munovewh-ezi1p9` (historical log line 3997) and its resend `munow5fj-ye1xar` (3999), but neither is linked from the ticket. They are not the contracted durable answer.
- The ticket retains the old `review/*` corpus/method at lines 10–12 and gives its correction only in the verdict. The supplied IDs do reach five real review topics; taking the method literally would not find them.

## Five reports and their listed findings

Board path: `~/.local/share/pi-board/log.jsonl`. All timestamps below are 2026-09-15 UTC. JSONL line numbers and IDs refer to the same records; use IDs if the log is relocated.

| Report | Timestamp | Board line | Listed findings |
|---|---|---:|---|
| `concept/factor-finish/finish-hub/review-join`, `mu2iynwi-6fr44l` | 10:24:22.914 | 696 | 4 nits: boolean rootDefinition label widening (`release.ts:306`); alias publication marker (`hub_projection.ts:366-378,595`); omitted author display (`read.ts`, publicListing); extra empty scan page (MAX_EXAMINED). |
| `concept/factor-finish/materials/u2-review`, `mu2mpq98-el9ybh` | 12:09:24.524 | 847 | 1 blocking: outer replay fences (`review.ts:219`). **3 additional nits in `data.nits`**, not in body: filler provenance (`surface_lifecycle.ts:301`); cheap validation after lookup / provenance revalidation (`:310`); skipped session-tree check on replay (`quizzes.ts:138`, suggestion says none needed). |
| `concept/factor-finish/materials/u2-replay-rereview`, `mu2nm46u-wpiiol` | 12:34:35.574 | 913 | 1 blocking: raw selfGrade identity (`review.ts:219-224`). **3 additional nits in body and `data.nits`**: absent selfGrade throws plain Error (N1, subsumed by B1); cramped SourceIdentity spacing (`journal.ts:300-303`); redundant exactMatch comparison (`review.ts:244`, keep or drop). |
| `concept/factor-finish/finish-hub-remainder/guard-review`, `mu2rx0dc-ag3ef1` | 14:35:02.304 | 981 | 2 nits: stale refusal on reset (`query-bar.tsx:118`); request-line budget wording (`navigation.ts:100`). 3 improvements in body: no guard tests; unbounded tag links; bound scope overclaim for document URLs. |
| `orch/forum-search/review-forum-search`, `mu2jg3tk-7csary` | 10:37:56.696 | 700 | 1 blocking: inaccurate missing-identity diagnosis (`search_forum.ts:112`, `client.ts:209`). 5 nits: singular vote; slug encoding; title/excerpt bounds; zero-result handoff; first-page truncation disclosure. Final report `mu2k3xp2-ny88yk`, line 762, 10:56:28.502, approves repaired head `5ea1560` and explicitly says the five smaller items landed. |

These lists contain **23 entries** (4+4+4+5+6), not 17. Some entries have no requested change or are subsumed. The delivered result supplies no exclusion/deduplication rule or individual dispositions for the six omitted U2 nits. It is therefore not possible to reproduce its fraction from its stated sample. This is not an assertion that all 23 require separate fixes.

The peer-board table also gives guard-review `3 code / 2 driven`, whereas its prose describes four code changes (reset, two comment corrections, bounded links) and one drive substitution. That row does not reconcile with the aggregate `13 code / 1 substituted / 3 declined` without changing the row's categorization.

## Reviewer identity

Session headers' `id` matches each report's `from.session`; each selected session's `model_change.modelId` is `~z-ai/glm-flash-latest`.

All paths start `~/.pi/agent/sessions/`:

| Report | Session path |
|---|---|
| review-join | `--Users-mlegls-dev-mmon-concept__worktrees-review-join--/2026-09-15T10-15-16-917Z_01a0a490-52b4-7763-ac7d-41bddf93e9b9.jsonl` |
| u2-review | `--Users-mlegls-dev-mmon-concept__worktrees-u2-review--/2026-09-15T11-56-59-601Z_01a0a4ed-7151-7411-80c1-5a79010aa3a7.jsonl` |
| u2-replay-rereview | `--Users-mlegls-dev-mmon-concept__worktrees-u2-replay-rereview--/2026-09-15T12-21-06-524Z_01a0a503-855c-73b4-9da0-192dee94f2d7.jsonl` |
| guard-review | `--Users-mlegls-dev-mmon-concept__worktrees-guard-review--/2026-09-15T14-20-46-784Z_01a0a571-1540-7460-aadb-4adcb875921c.jsonl` |
| review-forum-search | `--Users-mlegls-dev-arkhai-webapp__worktrees-review-forum-search--/2026-09-15T10-31-46-309Z_01a0a49f-6b84-73f1-b05a-66038cc86bda.jsonl` |

## Parent turns after the reports

Prefix all three session paths with `~/.pi/agent/sessions/`:

- **H:** `--Users-mlegls-dev-mmon-concept__worktrees-finish-hub--/2026-09-15T09-58-17-337Z_01a0a480-c3f9-70b7-a815-9db54a166585.jsonl`
- **C:** `--Users-mlegls-dev-mmon-concept--/2026-09-12T14-19-33-261Z_01a095fc-e205-73ba-a173-453daf440770.jsonl`
- **W:** `--Users-mlegls-dev-arkhai-webapp.dev--/2026-09-15T02-48-24-532Z_01a0a2f7-32cf-771c-b55e-28c5bd3b5702.jsonl`

| Report | Observed after-report turn | Observable disposition evidence |
|---|---|---|
| review-join | H:229 requests report at 10:25:42; H:233 tool result at **10:26:27.456** actually contains ID `mu2iynwi-6fr44l`. Earlier H:221/H:228 reads returned `(no messages)`. | H:294 board_send at 10:34:26 explicitly lists all four nits as “recorded (not repaired now)”. H:598 at 11:26:33 records `cc68bd3f` and all four deliberately unrepaired observations. C:5226 at 11:26:45 orders cross-lane author repair; C:5285 at 11:38:00 names `4a00a731` and says rootDefinition was diagnosed unreachable. Thus initial documented decline is real, but not the entire final disposition. |
| u2-review | C:5370 board_send at **12:09:33.213**, 9 seconds after report: “U2reviewconfirmsblocker repairReviewouterreplay now thenrereview beforeU3”. | Same turn requests exact input identity and a typed source-key helper without fake provenance. C:5398 at 12:20:49 says replay repaired pending re-review, but selfGrade equivalence still needs resolution. |
| u2-replay-rereview | C:5489 board_send at **12:34:43.770**, 8 seconds after report: “ConfirmedU2B1 repairpersist exactoptional rawselfGrade”. | Same turn says compare absence/value before grading, conflict not plain error. C:5520 at 12:41:17 accepts `daf4972` shape pending independent re-review/runtime; C:5844 at 16:21:54 approves joining `daf4972e`. No individual disposition for cosmetic N2 or redundant-invariant N3 found in these selected turns. |
| guard-review | C:5663 board_send at **14:35:15.420**, 13 seconds after report: “Guardreviewclear butH5factcheckneeded”. | Orders stale-alert fix and authored-tag-link checking, rejects the fixed-constant premise. Board:983 (`mu2s5t9d-5i8ume`, 14:41:52.993) says `33cfc8bb` bounds links, clears reset refusal and rewrites comments. C:5672 at 14:43:28 orders committed-query-change repair and targeted rerun. Board:987 (`mu2spcml-li28xo`, 14:57:04.557) reports seven checks held on a head containing `33cfc8bb` + `f7838250`. |
| forum-search | W:629 wm.send at **10:38:05.231**, 9 seconds after report: “Reviewer returned on original a4c1e21, same 403 blocker”. | Requests minimal conditional wording and vote/slug/text-bound/page-disclosure fixes. W:631 accepts conditional guidance instead of new probe. W:680 requests focused recheck of `5ea1560`; report:762 approves it. W:695 merges at 10:56:34; W:706 records merge `de02e5c` at 10:56:53. |

The parent-turn-first requirement is observable for all five. Parent decisions and reviewers' final reports establish that findings received attention. They do not independently prove code behavior; that belongs to review, not this source-blind drive.

## Commit metadata (no diffs)

Commands: `git -C <repo> show -s --format='%H %cI %s' <commit>`. UTC conversion is explicit below.

| Repository | Commit | Commit time UTC | Subject |
|---|---|---|---|
| `/Users/mlegls/dev/mmon/concept` | `cc68bd3f` | 11:25:21 | Record the independent review's non-blocking observations |
| same | `4a00a731` | **11:36:08** | Show the authored attribution the public Hub routes already carried |
| same | `e2044d1f` | 12:19:45 | Return recorded review attempt receipts before acceptance fences |
| same | `daf4972e` | 12:39:58 | Persist raw review self-grade for exact acceptance replay |
| same | `33cfc8bb` | 14:40:08 | Bound tag links by the same address measure as a Query commit, and clear the refusal with the draft |
| same | `f7838250` | 14:44:19 | Clear the bar's address refusal when the committed Query changes underneath it |
| `/Users/mlegls/dev/arkhai/webapp` | `d40d311` | 10:50:30 | web: never assert a missing Community identity, only suggest it conditionally |
| same | `165a39d` | 10:50:44 | contract+bff: bound topic title/excerpt, encode the topic URL slug |
| same | `c73ab6a` | 10:50:48 | web: singular vote on a thread card (1 vote, not 1 votes) |
| same | `5ea1560` | 10:51:00 | test: search_forum against a real BFF, real client, fake Discourse only |
| same | `de02e5c` | 10:56:34 | Merge branch 'forum-search' into dev |

`4a00a731` is **71 min 45 s** after the review-join report, outside the delivered `~1–60 min` range. The unlinked peer table calls it “10 min later” while also printing 11:36Z; that phrase only fits the later repair-spawn time, not the report timestamp. It needs a named latency origin, not an implied report-to-fix latency.
