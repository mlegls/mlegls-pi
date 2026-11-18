# Tracker update: empty body verification

Tested revision: `fccee900`. Surface: local tracker CLI, invoked with Bun from a fresh `mktemp -d` vault using this checkout's `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`. Persona: local maintainer editing the seeded `demo` issue; no auth or server. The vault is removed on exit.

## Predictions before first use

- Create `demo` with `Original contract.`. Updating from a zero-byte file or a space/tab/newline file should fail, name `demo`, and leave `Original contract.` visible in `text demo` after each attempt.
- Updating from a file containing `Replacement contract.` without an override should succeed and display that body.
- Updating from the zero-byte file with `--allow-empty-body` should succeed and leave the issue front matter present with no body.

## Encounter

`create` returned `demo`, and `text demo` confirmed the seeded body and `idea` front matter before the first update. All four predictions held:

| Input | Observed |
| --- | --- |
| Zero-byte file | Exit 1; `demo: refusing to replace a non-empty body with a blank one; use --allow-empty-body to clear it`. `text demo` still showed the original body. |
| Space, tab, newline | Exit 1 with the same error. `text demo` still showed the original body. |
| Non-empty file | Exit 0; `text demo` showed the replacement body and unchanged front matter. |
| Zero-byte file with `--allow-empty-body` | Exit 0; `text demo` showed the front matter with no body. |

No friction observed. The refusal itself explained how to clear the body deliberately; the override worked after the replacement had established a non-empty body again.

## Replay checks

Run from the checkout root. After each refusal, check for exit 1, `demo` in the diagnostic, and the original body in `text demo`. After the ordinary replacement, check for `Replacement contract.`; after the override, check for front matter only.

```sh
(
set -eu
cli="$PWD/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
sandbox=$(mktemp -d)
trap 'rm -rf "$sandbox"' EXIT
cd "$sandbox"
mkdir issues
printf 'Original contract.\n' | bun "$cli" create demo --fields '{"stage":"idea","author":"user:demo"}' --body-file -
bun "$cli" text demo
: | tee blank.md >/dev/null
printf ' \t\n' | tee whitespace.md >/dev/null
printf 'Replacement contract.\n' | tee replacement.md >/dev/null
for input in blank.md whitespace.md; do
  printf '\n--- %s ---\n' "$input"
  rc=0
  bun "$cli" update demo --body-file "$input" || rc=$?
  printf 'exit=%s\n' "$rc"
  bun "$cli" text demo
done
bun "$cli" update demo --body-file replacement.md
bun "$cli" text demo
bun "$cli" update demo --body-file blank.md --allow-empty-body
bun "$cli" text demo
)
```
