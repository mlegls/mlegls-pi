# Post-fix skim adoption — September 26

The recent traces do not support blanket abandonment across models. Sustained whole-call raw use is concentrated in Astra sessions. Other models commonly keep filtering enabled and recover selected details. In the ten reviewed sessions, the clearest friction is extra reading and failed recovery attempts, not an observed belief in a reversed claim.

## Population and sampling

Offline inventory of sessions born September 25–26, retaining entries before **2026-09-26 15:00 UTC**. The September 24 names/read-back policy change (`5d19aa4`, 14:54 UTC) precedes this window. The later skill-exact mitigation landed September 26 10:35 UTC, and model-family gating landed 11:28 UTC. A commit timestamp does not prove every running host adopted it; the reviewed tool responses themselves show named omission notices and actual filtering. No causal before/after estimate is made.

326 files contain bash/exec calls in the window; 321 are roots rather than declared forks. The 269 eligible roots have at least ten calls, one recorded calling model, at least one changed version-3 filter event, and a tool result containing an ingress skim/omission notice. All observed calls in this inventory use **bash**; there is no fresh exec comparison. Later files and entries are excluded, including this audit. Entries preceding a session's header timestamp are excluded from its inventory to avoid counting inherited history as new behavior.

| Calling model family | Eligible roots | ≥85% calls with `raw: true` | ≥85% calls with any lexical raw marker |
| --- | ---: | ---: | ---: |
| Astra | 12 | 8 | 8 |
| Opus | 39 | 0 | 0 |
| Sol | 33 | 0 | 1 |
| Luna | 157 | 0 | 0 |
| GLM | 28 | 0 | 0 |

These are invocation counts, not the share of bytes or reading tasks bypassing filtering. Per-command `ab raw` is not equivalent to whole-call `raw: true`. Lexical markers can occur inside code or documentation being written, so that column is a candidate detector, not a fully adjudicated behavior count. No tool-call IDs overlap between the 321 root files. The worker-heavy population and model/task assignment confound comparisons; this is not evidence that the September 24 fix caused the difference from the earlier study.

For close reading, selected the **latest two eligible roots per model family**, without choosing by raw fraction or observed complaint. All ten are September 26 sessions. Checked the first visible filtering, first raw candidate, first pull candidate, nearby repeated reads, and the next substantive action in those episodes. This is not an audit of every later action or the correctness of each whole task. The sample has no overlapping tool-call IDs.

## Reviewed episodes

Session prefixes below identify full IDs and original line references in `reviews.json`; `receipt.jsonl` retains entry IDs, timestamps, hashes, modes and bounded evidence. Original bodies stay in local Pi session logs. “Whole raw” counts exact `raw: true` arguments, not a classifier's interpretation.

| Session / model | Calls / whole raw | What happened |
| --- | ---: | --- |
| `01a0dd6d` Astra | 135 / 130 | Broad search omitted; narrowed search finds nothing. Raw dependency search locates hysteresis. Definition then arrives as a skim; rereads six lines raw before explaining the threshold. Sustained raw use follows, but no explicit reason for persistence is recorded. |
| `01a0de22` Astra | 26 / 11 | First call is raw **before any filtering**. Later mixes filtered historical searches with raw implementation reads and narrower queries. Cannot attribute its first raw choice to filter rejection. |
| `01a0ddca` Opus | 21 / 0 | Article arrives as skims. Pulls one passage and refetches a narrowed raw extraction of experiment/control lines before citing numbers. Later uses raw to inspect freshly rendered prompt text. Recovery works; no blanket switch. |
| `01a0dd27` Opus | 123 / 0 | Recording-tool source is omitted; rereads the needed range via `ab raw`, then reasons about pre-/post-write state and reads the host interface. Targeted exact recovery, not whole-call abandonment. |
| `01a0dd1f` Sol | 23 / 0 | Admission function is omitted. Reads the route span, dispatch and tests raw before distinguishing selectable model pairs from fixed operating points. Later uses anchored source before edits. |
| `01a0dd10` Sol | 52 / 1 | First whole-call raw read inspects Markdown/CSS precedent before implementation. Immediately preceding output is normal exact grep plus an in-progress install. No evidence ties this choice to skim damage; next call returns to filtered reads. |
| `01a0dd5f` Luna | 12 / 0 | Main report stays exact but reproduction section is omitted. Narrows the range and adds reproduction focus, recovers the paragraph, then edits coverage claims. No raw or pull. Later edit-DSL errors are separate. |
| `01a0dd5e` Luna | 89 / 0 | Skimmed AGENTS instructions trigger a targeted raw read while other reads remain filtered. Later pulls an omitted Podman failure log, then uses the recovered immutable image ID to bypass registry lookup. No claim that this establishes eventual test success. |
| `01a0dd4f` GLM | 248 / 0 | Docs map omitted; a rerun through `tail` is omitted again. Later says “The skimmed output loses CSS details,” then retrieves mockup CSS ranges raw. Later pulls browser guidance and starts a named browser session. |
| `01a0dd4b` GLM | 122 / 0 | Raw tracker references precede filtering. Later says omitted lint should be read raw, but the rerun actually requests neither raw mode nor `ab raw`; it is omitted again. Writes JSON to a file and rereads with focus, recovering the first report's fresh status and empty findings. |

Nine of ten do not settle into almost-all whole-call raw use. That does **not** mean nine found filtering helpful: several recover omitted relevant material through extra reads. Conversely, exact verification, source inspection before editing, and already-established raw habits should not be counted as failures merely because they bypass filtering.

### Concrete recovery observations

- **Pulls are used successfully.** Three sampled sessions make four actual ingress-pull calls: Opus article recovery, two Luna log recoveries, GLM browser-guidance recovery. The reviewed first pull in each returns the requested original. The Astra script-writing episode contains the literal `ab pull` but is not a pull invocation; it is excluded from this count. Regex-only adoption metrics would get that wrong.
- **Rereading is still the common recovery path in these episodes.** Some rereads are narrower than the recoverable page and therefore not simply waste. The AGENTS reread, omitted docs-map rerun, and lint rerun do repeat work that an available original could have supplied. No total-token or latency saving is inferred without a matched counterfactual.
- **A recovery intention can fail at invocation.** GLM's “Let me see the full output with raw” is followed by an ordinary filtered command. The second omission is real, but this is not evidence that the raw escape hatch failed. Its later focused file read succeeds.
- **No reversed belief identified in the reviewed episodes.** Readers often request exact evidence before claims or actions. The previous [synthetic fidelity audit](../skim-fidelity/README.md) established damaged representations, not downstream confusion; this small trace review does not turn that into a task-error rate, nor establish that unnoticed errors never occur.

## What this changes

The next useful paired replay is a **real recovery episode**: the omitted admission function, omitted recording-tool body, or repeated lint read. Compare the original filtered response with exact source while allowing pull, focus and narrowed reread. Score the next decision and recovery work, not just sentence fidelity or whether `raw` appears. The article episode offers a factual-grounding case with successful recovery rather than a presumed failure.

No compressor, fidelity prompt, model routing or host behavior changed. The existing [[projects/mlegls-pi/issues/skims-drop-the-conditions-in-instructions]] owns further task-accuracy/recovery calibration. The separate command-prefix/read-back defect found in the prior audit is not re-tested here. Broad task success, unnoticed reliance on skims, fresh exec adoption, actual per-session policy revision, and a matched raw/filter completion comparison remain unmeasured. Those limits are accepted for this bounded observational pass, not implementation promises.

## Reproduction

```sh
python3 docs/research/skim-adoption/audit.py > /tmp/skim-adoption-inventory.json
python3 docs/research/skim-adoption/receipt.py /tmp/skim-adoption-inventory.json > /tmp/skim-adoption-receipt.jsonl
python3 docs/research/skim-adoption/audit.py --trace 01a0dd4b-4249 --around 26 --radius 5
```

The first command reports metadata and candidate counts; the third displays original local evidence, including reasoning text when retained, never encrypted reasoning signatures. Manual classifications are in `reviews.json`, not generated by the inventory. Receipt generation checks sample membership and absence of shared tool calls. Both scripts passed Python compilation and were run against the retained records. They make no network calls, launch no agents and execute none of the historical commands.
