ab memory recall ID... [--offset N] [--limit N]

Read 1–8 original session entries cited by memory (use the ID inside [@ID]).
Current invocation's branch only, including entries covered by compaction.
Reasoning is omitted; images are represented by placeholders.
Offset/limit are character counts; default limit 12000, maximum 20000.

Session/branch coordinates are supplied by bash and exec. Offline use requires
--session FILE --leaf ID; the reader never guesses a session or latest branch.

Output is verbatim within normal size caps. If truncated, grep the indicated
full-output file. This replaces the former memory_recall tool.

exec equivalent: show(memory.recall({ids:["ID"], offset:0, limit:12000}))
Exact exec output: show.raw(memory.recall({ids:["ID"]}))
