---
stage: idea
assignee: agent
author: session:01a0e2f4-3d1a-7628-a875-04776a15503b
---

During [[projects/mlegls-pi/issues/dsh-port]] root review, headless `--json` emitted only 8,192 characters for a successful `run_code` tool result, without an omission marker. The persisted `tool/result` at seq 68 contains 11,150 characters, including the complete requested 11,000-character slice. This is a CLI reporting limit, not skim loss. Owning repository: deepseek-ai/deepseek-harness, whose issue tracker is disabled.

Tried checking exact pull output from the CLI JSON stream; the prefix assertion failed at 8,192 characters. Workaround: decompressed the owned `session.v4.jsonl.zstd` and checked the actual persisted result. Evidence: `docs/attachments/dsh-port-root-review/session-excerpt.json`. Prefer a marked truncation/locator or an opt-in full-results flag for machine-readable verification output.
