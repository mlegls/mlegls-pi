ab code VERB [NAME] [--file F] [--kind K]... [--exported] [--root DIR] [--tsconfig P]

The TypeScript program as a graph: definitions at statement grain (functions,
classes, members, function-valued variables nested by dotted name) and the
references between them resolved by the checker, not by name match.

  stats              files, definitions, references
  defs [NAME]        list; NAME and --file accept /regex/
  def NAME           signature line and body (--no-body to omit)
  callers NAME       who references it (call|type|member|value)
  callees NAME       what it references
  tests NAME         callers in test files
  impact NAME        transitive callers, nearest first
  dead               named definitions nothing references
  similar NAME       by shared callees (--by callers), Jaccard, -n N
  around NAME        the definition, its neighbours' signatures, files --hops away
  rows NAME          its anchored rows, ready for ab edit

NAME matches a dotted name or its last segment; add --file to disambiguate.
Output rows are file:start-end  kind name  signature.
