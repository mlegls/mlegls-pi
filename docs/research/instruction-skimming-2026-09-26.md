# Instruction skimming — September 26

The compressor reproduced the damaging skim of the old project-docs rule at 75% retention. The current fidelity judge already chose verbatim for relevant instruction passages and omitted unrelated procedures. An added instruction-specific rule made no difference in this bounded probe.

The concrete gap was the bash adapter: exec protects activated skills, but `ab skill` printed filterable text. It now uses the existing exact-output marker. Worker instructions name `ab skill` for activation and exact reads for instruction references and project rules. No filename whitelist, function-word whitelist, compression-model change or fidelity-judge change was added.

## Checks

- Direct LLMLingua compression of the historical rule produced: `frictions Ousterhout symptoms deferred costs recorded later triage. issues vault project` followed by the damaged backtick/path spacing recorded in [the exact result](../attachments/instruction-compression-2026-09-26.json). This bypassed the fidelity judge deliberately; it tests the failure mode when that passage is selected for compression, not current end-to-end selection. “Otherwise” survived this run, but the relationship was still damaged.
- Five chunks covered the historical filing condition, permission/negation/exception rules, verification sequence, an unrelated release procedure and an architecture overview. The instruction-reading query retained the first three verbatim and omitted the others. The orientation-only query selected cues for the filing passage, omitted the other procedures, and skimmed the architecture overview. Baseline and an added instruction-fidelity rule chose the same modes. [Queries, chunks, proposed rule and distributions](../attachments/instruction-fidelity-2026-09-26.json).
- `bun test ab/skill.test.ts lib/ingress.test.ts lib/raw.test.ts extensions/exec/ingress.test.ts`: 10 passed. The new regression checks expanded instruction output is entirely inside an exact segment in bash and contains no control markers outside the tool. Existing tests cover lossless chunks, omission recovery, budget pressure and failure preservation.

Activation is the guaranteed exact route, not ordinary source inspection. References are not automatically loaded, and exact reads still face host output caps. No fresh worker adoption or broad task-accuracy estimate was measured. General fidelity calibration, misleading peripheral skims and full-input replay storage remain open under [the original issue](../issues/skims-drop-the-conditions-in-instructions.md).
