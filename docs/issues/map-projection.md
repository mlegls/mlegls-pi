---
stage: idea
assignee: agent
---

the deterministic version of the map: slice (grep/LSP-seeded neighborhood over the code graph), rank (jev per node), project (call tree, component tree, file tree, sequence from the graph), label (cached, cheap LLM only on cache miss). buys determinism, latency (deepseek thinking time is the real cost of the LLM version), and the label cache — not dollars.

candidates for the graph: LSP call hierarchy (exact for TS/Python; the disabled LSP extension exists), tree-sitter, graphify's extractors if doc/SQL/config edges matter. aider's repo-map (symbols + personalized PageRank) is the prior for the slice.
