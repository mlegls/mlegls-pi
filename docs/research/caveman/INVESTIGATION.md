# Retention replay follow-up — 2026-09-22

Investigation, not an ingress or system-network configuration change.

## The 31-second cost is cold connection setup

Reproduction: bun docs/research/caveman/latency.ts. Requires JEV_API_KEY. This
uses direct HTTP calls, not lib/decide, and writes the two unauthenticated request
payloads to /tmp/jev-tiny.json and /tmp/jev-full.json for curl comparisons.
Responses, timings and repeated judgments are retained in latency.json.

| Same Bun process, in order | Wall time | Envoy upstream service time |
|---|---:|---:|
| Tiny Noul, cold | 30,895 ms | 96 ms |
| Same Noul, warm | 313 ms | 116 ms |
| Four architecture Choice questions | 514 ms | 144 ms |
| Identical four questions again | 300 ms | 94 ms |

Upstream time is the reported x-envoy-upstream-service-time header, not a direct
measurement of GPU inference. Nearly all the cold delay precedes receiving response
headers. These observations rule out prompt size or question count as the cause of
the original ~31-second floor.

The shell has HTTP(S)_PROXY pointing to localhost:10809 and SOCKS at :10808, managed
by Xray. System conventions were checked in ~/.config/system-config. Separate curl
processes through that HTTP proxy showed 17–31 seconds before TLS setup completed,
then ~0.3–0.9 seconds to first response byte. Forcing the proxy destination to each
known IPv4 address still took 19–31 seconds; that did not solve the proxy path.

A direct curl request (--noproxy '*') showed:

- name lookup: 30.0025 seconds;
- TCP connected: 30.1719 seconds;
- TLS complete: 30.3510 seconds;
- complete response: 30.8234 seconds.

Forcing IPv4 alone still took 30 seconds in lookup. Bypassing lookup with
--resolve api.typesafe.ai:443:44.227.31.201 while keeping the original URL, Host and
TLS certificate validation reduced the entire direct request to **649 ms**.
All these successful API calls returned HTTP 200. One preliminary shell loop failed
to split a multiword --resolve argument under zsh; the corrected explicit command
produced the 649 ms result.

Direct dig A queries to all four configured DNS servers returned the expected IPv4
addresses in 7–13 ms; sampled AAAA lookups returned negative answers in 7–14 ms.
This narrows the problem to the machine's resolver/connection path, but does not
identify the exact macOS/Xray fallback causing the 30-second wait. No DNS settings,
proxy settings, host overrides, or pinned IPs were installed. Pinning an observed
address is diagnostic, not a durable fix.

Implication: retain the long-lived HTTP client/process, but don't treat warmup as a
complete repair—new connections still matter. Fixing the local resolver path is
separate from choosing a model or reducing its question count. The eight-second
live ingress deadline can currently fail on cold connections even though warm
judgments fit comfortably inside it.

## Neighboring rates really do fluctuate

Eight identical four-question architecture requests, collected during the transport
probes, yielded:

| Passage | 50% choices | 75% choices | Other choices |
|---|---:|---:|---:|
| Engineering update | 7 | 1 | 0 |
| Reading policy | 5 | 3 | 0 |

The distributions cluster around the boundary, rather than moving between unrelated
interpretations. For the policy passage, 50% has .30–.39 probability, 75% .32–.39,
and full .21–.28. These are descriptive observations of eight calls, not calibrated
confidence intervals or a claim that either skim is adequate downstream.

The selector is making an **ordinal decision**, but the prototype takes its modal
category as though the five bins were unrelated. In particular, low winning
probability does not imply ambiguity between omission and exact reading: it can be
mostly ambiguity among neighboring levels. A universal .6 → full fallback would
hide that distinction and undo much of the intended skimming.

Recommendation: tolerate adjacent-rate variability for now. The important next
measurement is whether 50 versus 75 changes the reader's next action or need to
expand, not whether repeated calls emit the same label. If allocation needs to be
deterministic, an explicit ordinal loss / quantile policy can use the distribution;
that would encode a cost preference, not magically improve the underlying judgment.
A weighted mean would also require ordinal semantics and must not silently mix
omit/full uncertainty into an apparently safe skim. No selector change was made.

## Where the repository's 20× headline comes from

The README TL;DR attributes it to the original **LLMLingua (EMNLP 2023)**, not
specifically LLMLingua-2. Its broader overview subsequently uses the headline for
the family of tools.

Original paper, Table 2, GSM8K with GPT-3.5-Turbo-0301:

| Setting | Reported prompt tokens | Exact-match answer accuracy |
|---|---:|---:|
| Full-shot | 2,366 | 78.85 |
| LLMLingua quarter-shot constraint | 117 | 77.33 |

That is 20.2× fewer reported prompt tokens with a 1.52 percentage-point accuracy
loss. The source prompt is a complex multi-step chain-of-thought demonstration
prompt. The compressor combines demonstration-level selection, iterative token
pruning, and different budgets for demonstrations versus instructions/questions.
It is not a claim that every sentence remains faithful after dropping 95% of words.
The metric is the target LLM's eventual math answer, not source reconstruction or
human readability. It is also not 20× end-to-end speedup.

The same table reports BBH falling from 70.07 to 56.85 at 7×. So “minimal loss” is a
best-case headline, not uniform behavior across tasks. Their conversation results
use roughly 2–3× compression; paper summarization uses 4–9×.

LLMLingua-2's own abstract reports 2–5× compression with 1.6–2.9× end-to-end speedup.
It also reports 14× on GSM8K (Table 3: 2,366 → 178 tokens; 78.85 → 77.79 EM), using
hierarchical compression for multi-demonstration prompts. Section 4.2 explicitly
retains the original budget controller for these high-ratio scenarios, replacing
its token compressor with the new classifier. Our probe disables context-level
filtering and token-compresses individual passages: it does not reproduce that
hierarchical experimental setting.

The useful comparison for foveated reading is the whole retained context after
omission, passage selection, and token compression, measured by downstream task
performance. A document can shrink greatly because most sections are irrelevant,
without requiring aggressive deletion within the few sections that matter.

Sources:
- https://github.com/microsoft/LLMLingua (README TL;DR and overview)
- https://aclanthology.org/2023.emnlp-main.825/ (Tables 1–2, §4.1, Appendix A.1)
- https://aclanthology.org/2024.findings-acl.57/ (abstract, §4.2, Table 3)
