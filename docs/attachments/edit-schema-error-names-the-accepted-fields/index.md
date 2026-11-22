# Edit schema error: first-use drive

## Predictions before first use

- With `replace` and `from`, codemode rejects the edit, names the submitted keys and accepted field pairs, and leaves `sample.txt` as `hello\n`.
- With `old_text` and `new_text`, codemode accepts the edit and changes `sample.txt` to `world\n`.

## Replay and observations

Tested `6b21c2e44ca2cb81a32017a68ff2926900d0a1a4` in the candidate worktree with Bun. The local codemode fixture seeds a temporary `sample.txt` with `hello\n` for each call and cleans it up. No server or credentials required.

```sh
bun lib/outline-read/fragment.fixture.ts 'text(await tools.edit({edits: [{path: "sample.txt", replace: "world", from: "hello"}]}));'
bun lib/outline-read/fragment.fixture.ts 'text(await tools.edit({edits: [{path: "sample.txt", old_text: "hello", new_text: "world"}]}));'
```

1. **Met.** Exit 1. The error said `edits.0 has {path, replace, from}; use {old, new} (or oldText/newText, old_string/new_string, old_text/new_text)`. It also offered the `near` form for whole definitions. The reported file contents remained `"hello\n"`.
2. **Met.** Exit 0, one edit reported, with resulting contents `"world\n"`.

For replay, check both exit status and reported file contents; the field hint alone does not establish that the rejected call left the file unchanged. No friction encountered.
