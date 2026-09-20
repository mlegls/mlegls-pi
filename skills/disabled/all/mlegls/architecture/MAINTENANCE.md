# architecture documents

`docs/README.md` maps document roles, scopes, and paths. mapped documents can be
absent until their first write. `/setup-guidelines` establishes a missing or
incomplete map.

## what lives where

- stories explain product behavior and why it matters. their `via:` lines join
  product and theory.
- the glossary names the concepts of this codebase. terms refer to present or
  decided code, so resolving a term is also resolving something about the
  implementation. [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md).
- theory is philosophical exposition: foundations, then refinement and
  elaboration. it gives enough understanding to work fluently, rather than
  enumerating cases. its concepts correspond to code; old vocabulary may become
  compounds while remaining useful at the interface. predecessor theories can
  appear as phlogiston does in chemistry.
- architecture describes how the theory is realized in existing code, from
  deep modules through their compositions and variants. a generated dependency
  graph and interface outline connect the account to the implementation.
  planned structure lives in a spec or hypothesis until the code makes it true.
- ADRs preserve decisions whose reasons would otherwise be lost.
  [ADR-FORMAT.md](ADR-FORMAT.md).
- hypotheses hold unaccepted theory revisions: the `difficult` issues they
  unify, proposed concepts and laws, what they displace, and restructuring cost.
  they record the resulting proposal rather than the brainstorming transcript.

module depth is useful here: what complexity would deleting a module scatter
into its callers? context boundaries belong to the theory, not the current
package layout.

## upkeep

These documents shape later contexts. Show proposed changes and get confirmation
before recording them (`grilling`); agreement in discussion is not automatically
approval of the written account. An approved batch needs only one confirmation.

1. read the mapped documents relevant to the work, descending into local docs
   and code as needed.
2. when a term or explanation resolves, update its document. use ordinary file
   links between documents; write the account so it stands without the conversation.
3. for adoption of a hypothesis, use `/revise-theory`: rewrite theory, migrate
   glossary terms, file or amend ADRs, and close the hypothesis together. a
   rejection worth remembering becomes an ADR; otherwise delete it.
4. once implementation realizes the theory, update architecture from the code.
   differences between the two are substantive, not just documentation drift.
5. when context boundaries change, update the map and move the affected terms
   and docs; file any code move still needed. when a document needs splitting,
   use `<role>/README.md` with indexed children and update the map.
