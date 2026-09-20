---
name: setup-guidelines
description: "Use when first configuring project guidelines or changing minimalism, testing, or domain-document policies."
disable-model-invocation: true
---

The useful project guidelines are the facts a capable engineer cannot infer
from general expertise: what this project owns, what it promises, where its
concepts live, and how its behavior is evidenced.

1. Inspect the repo and existing guidance. Identify the core competency,
   actual consumers and compatibility promises, accepted theory contexts,
   public caller seam, test harness, and upstream guarantees.
2. Draft the resulting policy together. Setup records accepted concepts rather
   than inventing a theory. Show the complete proposed documents and entry-file
   changes, and get confirmation before writing (`grilling`).
3. Install only the approved project-specific account:
   - [minimalism.md](minimalism.md) in the agent entry file;
   - [testing.md](testing.md) at `docs/agents/testing.md`;
   - [domain.md](domain.md) at `docs/agents/domain.md`;
   - [docs-readme.md](docs-readme.md) as the role/path map in `docs/README.md`.
4. Link these from the existing agent entry file. Use `AGENTS.md` for a new
   setup; retain `CLAUDE.md` where it already serves that role. Report tests or
   conventions that conflict with the new policy without quietly rewriting
   them as part of setup.

Fill template slots with observed or agreed facts. Preserve existing document
paths. For a new layout, one context goes directly under `docs/`; several go
under `docs/<context>/`, with repository stories at `docs/stories.md`. Each
context maps glossary, theory, architecture, ADRs, and hypotheses. Files and
collections appear on first write, not as empty scaffolding.
