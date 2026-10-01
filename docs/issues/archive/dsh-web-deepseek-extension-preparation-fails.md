---
priority: 4
stage: done
assignee: agent
author: session:01a0e203-629e-7153-8f06-6c9840f79539
---

Obsolete 2026-10-01: the dsh port was deleted in the pi 0.99 rebuild (`4b79baa`).

Owner: `deepseek-ai/deepseek-harness` Web / DeepSeek request-extension composition. Found during [[projects/mlegls-pi/issues/archive/dsh-hashline-tools-spike]]. Upstream issue tracker is disabled, per the attempted issue creation recorded in [[projects/mlegls-pi/issues/archive/dsh-preset-relative-plugin-loading]].

Observed on npm dsh 0.1.7-rc.2 with Cordis 4.0.4, anonymous-local Web, `deepseek-official` / `deepseek-flash`, and `DEEPSEEK_API_KEY` supplied in the launch environment: a submitted prompt failed before any tool dispatch with `DeepSeek request extension preparation failed` (`REQUEST_EXTENSION`). The provider route and key were usable after locally disabling both `session-log-deepseek` and `plugin-package-inventory-deepseek`; the real model turn then completed. The error cause was not exposed in the session's surfaced error, and disabling both together does not identify which contributor or interaction is responsible. No API key or session contents are recorded here.

Tried the shipped defaults first, then disabled the two optional DeepSeek request-extension contributors in an ignored local overlay; that isolated the successful encounter but not the underlying failure. Useful next step: enable each contributor independently and retain the underlying prepare error in a safe diagnostic to identify the failing path.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
