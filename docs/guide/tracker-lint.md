# Semantic tracker preflight

For choosing what to work on without mistaking stale issue prose for an executable obligation.

From the project, run:

~~~sh
bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]
bun ~/.pi/agent/skills/tracker/scripts/issues.ts mine [slug]
bun ~/.pi/agent/skills/tracker/scripts/issues.ts frontier [slug]
~~~

Omit the optional slug for all live issues. Lint evaluates changed inputs through the existing Jev configuration; queries only read its local cache. Add --json for probabilities, quotes, timestamps and status. Orient and supervise refresh at entry, then reconcile findings before choosing work. A signal does not block dispatch or rewrite the tracker.

The cache lives under $XDG_CACHE_HOME/mlegls-pi/tracker-lint (default ~/.cache), partitioned by canonical project path and issue. Remove an entry to repeat an unchanged judgment. Missing, stale, failed and bounded-context results are visible; no signal is not verification. Unlinked decisions and current code behavior are outside this reader's evidence.

## First use — 2026-09-22

The maintainer had found several delivery issues still open because their old “remaining work” prose was treated as a continuing obligation. The browser-drive issue at commit 8aaa80f explicitly recorded the implementation as done, followed by two product-story reruns. Cua background compatibility was already reconciled as a separate human-owned idea, not unfinished TextEdit delivery.

- Live lint over the current Cua issue initially flagged scope expansion and a parent mismatch. The scope question was tightened to distinguish an independent follow-up; the parent question is now omitted when there is no parent/child relation. The rerun returned no findings.
- Live lint over the historical browser-drive issue initially returned no findings: the completion question demanded a contradiction rather than a reason to reconcile. Asking whether recorded delivery warrants checking fulfillment produced a completion signal (p=0.67) and selected the source excerpt containing its dated delivery. This asks for review, not automatic archival or a claim that product-story verification is optional.
- The retained [Jev recording](../../lib/fixtures/tracker-lint-browser-drive.json) supplies the offline [replay](../../lib/tracker-lint.test.ts). Reading the same result through frontier exposed a cache-identity bug between /tmp and /private/tmp; canonical source paths fixed it. The replay checks that a cached signal leaves frontier eligibility unchanged, a newly linked or edited evidence document makes it stale, and a failed refresh preserves the previous result.

These are two local encounters, with questions revised against them—not a precision/recall estimate or evidence that the entire tracker was reconciled. No full-vault model scan was performed. Evidence is bounded to ten Markdown documents, with 12,000 characters for the issue and 4,000 per related document; truncation and unresolved links remain visible.

Checks: 116 library tests passed, two skipped; all 11 tracker tests passed; the explicit selected-project CLI/view parity run passed all five tests. Typecheck and the separate code-span Jev lint remain blocked by the existing missing TypeScript dependency (typecheck also reports the existing outline signature error); no tracker-lint diagnostic appeared. Against a81b1ab, scc over the three changed TypeScript files reports code 385 → 548 (+163), complexity 261 → 330 (+69), including the replay test. Totals were measured directly because the delta helper could not handle the new paths absent from the starting ref.
