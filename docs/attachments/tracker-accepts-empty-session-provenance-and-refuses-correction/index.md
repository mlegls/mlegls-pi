# Empty provenance identities: review

Drive skipped (`drive: none`); the ticket's tests are the acceptance, owned by the ticket author and run by the integration gate. Nonvisual.

## Evidence

- `bun test issues.test.ts` (tracker scripts): 30 pass, including `create rejects empty provenance identities before writing an issue` (`session:`, `user:`, whitespace suffixes, empty and blank `PI_SESSION_ID`: nonzero exit, nothing written).
- Review repair (1 behavior): the implementer put the empty-suffix rule in `parseFrontmatter`, which `load` runs on every file, so one existing `author: session:` record made every query and `check` in that tracker fail on that file (reproduced in a scratch repo). The ticket leaves existing records to their owners and says `check` names them. Now the rule is `emptyIdentity` in `issues.ts`: refused by `create` (explicit or from `PI_SESSION_ID`) and by `update` setting a new author; `check` reports `<slug>: author session: names no identity` (exit 1); other queries still load.
- Scratch re-drive after repair (existing records `a` = `session:`, `b` = `session:q`): `check` names `a`; `fields b` works; `create` with `user:` and with empty `PI_SESSION_ID` fail; `update b` author change still `immutable`.

## Story outcomes

| Story | Outcome |
| --- | --- |
| `create` with an empty-suffix author fails and writes nothing | held |
| `create` with empty/blank `PI_SESSION_ID` fails and writes nothing | held |
| `check` names existing empty-suffix records; queries keep working | held |
