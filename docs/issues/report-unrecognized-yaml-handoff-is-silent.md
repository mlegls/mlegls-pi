---
stage: idea
assignee: agent
author: session:01a0f093-b922-7486-9944-ecaa4130b01a
---

The sentinel parser's [first-use drive](../attachments/turn-end-sentinel-parser-rejects-preambles/index.md) expected a diagnostic or partial handoff for a fenced YAML block containing `: "patch:title"`. `parse(text)` returned `handoff: null`, `handoffError: null`; the standalone `done` survived.

Review reproduced this through the public library. The YAML is syntactically valid: `yaml.parseDocument` returns an empty-key mapping with no errors. The report parser ignores it because none of its keys identify a handoff. This is not the syntax-error bounce owned by [[projects/mlegls-pi/issues/bounce-handoff-shape-errors-to-the-child]].

Workaround: use recognized handoff keys; inspect the retained report body when the handoff is null. Open question: should an unrecognized fenced mapping be diagnosed as a malformed handoff, and how would that avoid rejecting unrelated YAML examples? This is separate from sentinel-position acceptance.
