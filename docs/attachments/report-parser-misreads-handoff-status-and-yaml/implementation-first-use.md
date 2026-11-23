# Report parser first use

Run from the candidate checkout with Bun and the lockfile dependencies (`bun install --frozen-lockfile` if absent). The caller is a coordinator reading a worker turn. The report on stdin is the only input; no authentication, server or persisted state is needed.

```sh
bun -e 'import { parse } from "./lib/report.ts"; console.log(JSON.stringify(parse(await Bun.stdin.text()), null, 2));' <<'REPORT'
done

### Blocked

- blocked

~~~yaml
setup: earlier draft
~~~

~~~yaml
data: {blocking: [], nits: [tighten the margin]}
~~~

~~~yaml
sample: final example
~~~
REPORT
```

On `dda7aacd`, the call returned `status: done`, `handoff: {data: {blocking: [], nits: ["tighten the margin"]}}`, and `handoffError: null`. The returned body kept the heading, bullet, earlier draft and sample.

Separate calls at base `6e253b30` returned a status conflict for either Markdown label following `done`, chose the earlier of two `setup` blocks, and dropped a `data`-only handoff. On `dda7aacd`, each label kept `done`, the later `setup` won even with an unrelated mapping after it, and the `data`-only handoff was retained.

Control: replacing the earlier draft with `status: blocked` still produces `conflicting report statuses: done, blocked`. Selecting the latest payload leaves explicit status conflict checks in place.
