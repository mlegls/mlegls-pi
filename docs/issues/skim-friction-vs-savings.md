---
stage: idea
assignee: human
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
---

Current question: is a separate compression study still wanted after `a3d28ac` removed implicit skimming from Pi and DSH? [[projects/mlegls-pi/ingress]] is now verbatim output caps plus explicit retrieval. The proposal below is research into an alternative, not maintenance of the current output path. Recommendation: defer until a concrete reading task needs more than bounded reads and full-output recovery.

Agents keep reporting friction with skimmed output, but empirically skimming saves a lot of tokens with no noticeable degradation. Unclear how much is it feeling weird vs actually needing improvement. One observation: on prose docs (dsh's READMEs) skims read as keyword soup, and learning an API from them depended on what happened to survive; on code and structured text they were fine. Related: [[projects/mlegls-pi/issues/skims-drop-the-conditions-in-instructions]].

Ways to separate the two:
- revealed preference: pull rate after a skim, per content type
- priming: the label `[skim 75%; incomplete, may lose relationships]` tells the reader to distrust what follows; A/B the wording
- outcomes: task success with skim on vs off over a fixed task set

Cheaper improvements than a generative summarizer: choose the unit by content type (drop sentences in prose, lines in code and logs, tokens only in dense leftovers). Provence (Naver, 2025) is query-conditioned sentence pruning with a cross-encoder at LLMLingua-like cost; LongLLMLingua is the question-aware LLMLingua; RECOMP and Selective Context are nearby.

The ideal is a small model that strips the irrelevant parts and token-compresses the rest where viable, e.g. into classical Chinese. That only works done right: at most one character per original word and usually far fewer, since tokens rarely span multiple words. Small models imitate the shape (modern 2-character words, formal register) and save little or nothing. The failure is scorable, so it may be trainable: RL with reward = tokens per source word under the reader's tokenizer × fidelity (back-translation, or QA over the source), as in PCRL (Jung & Kim 2023).
