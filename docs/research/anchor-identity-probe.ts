import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSourceAPI, SourceFile } from "../../extensions/exec/source";
import { Ledger } from "../../lib/outline-read/ledger";

// Run: bun docs/research/anchor-identity-probe.ts
// Want: use anchors already in context without silently editing another occurrence.
const root = await mkdtemp(join(tmpdir(), "anchor-identity-"));
const results: unknown[] = [];
async function probe(name: string, initial: string[], target: number,
  prepare: (api: ReturnType<typeof createSourceAPI>, rows: SourceFile["rows"], path: string) => Promise<unknown>,
  expected: string[] | null) {
  const path = join(root, name + ".txt");
  await writeFile(path, initial.join("\n") + "\n");
  const api = createSourceAPI({ cwd: root, ledger: new Ledger(), persist() {} });
  const source = await api.read(path) as SourceFile;
  const preparation = await prepare(api, source.rows, path);
  let feedback = "", rejected = false;
  try { feedback = (await api.edit([{ replace: source.rows[target], text: "MARK" }])).text; }
  catch (error) { rejected = true; feedback = String(error); }
  const actual = await readFile(path, "utf8");
  const outcome = rejected ? (expected === null ? "safe rejection" : "survivor rejected")
    : expected !== null && actual === expected.join("\n") + "\n" ? "intended edit" : "silent wrong edit";
  results.push({ name, initial, target: target + 1, preparation, expected, actual, outcome, feedback });
}
const external = (lines: string[]) => async (_api: unknown, _rows: unknown, path: string) => {
  await writeFile(path, lines.join("\n") + "\n"); return lines;
};
try {
  const functions = ["function a() {", "  work();", "}", "", "function b() {", "  work();", "}"];
  await probe("unrelated-function-change", functions, 5,
    external(["function a() {", "  other();", "}", "", ...functions.slice(4)]),
    ["function a() {", "  other();", "}", "", "function b() {", "MARK", "}"]);
  await probe("delete-first-function-surviving-statement", functions, 5,
    external(functions.slice(4)), ["function b() {", "MARK", "}"]);
  await probe("delete-first-function-old-brace", functions, 2,
    external(functions.slice(4)), null);
  await probe("external-delete-first-duplicate-use-survivor", ["A", "same", "same", "B"], 2,
    external(["A", "same", "B"]), ["A", "MARK", "B"]);
  await probe("external-delete-first-duplicate-use-deleted", ["A", "same", "same", "B"], 1,
    external(["A", "same", "B"]), null);
  await probe("own-delete-first-duplicate-use-survivor", ["A", "same", "same", "B"], 2,
    async (api, rows) => (await api.edit([{ delete: rows[1] }])).text,
    ["A", "MARK", "B"]);
  await probe("own-insert-duplicate-before-survivor", ["A", "same", "B"], 1,
    async (api, rows) => (await api.edit([{ before: rows[1], text: "same" }])).text,
    ["A", "same", "MARK", "B"]);
  await probe("own-delete-first-blank-use-survivor", ["A", "", "", "B"], 2,
    async (api, rows) => (await api.edit([{ delete: rows[1] }])).text,
    ["A", "MARK", "B"]);
  await probe("deleted-name-reintroduced-elsewhere", ["A", "target", "B", "C"], 1,
    async (api, rows) => {
      const deletion = (await api.edit([{ delete: rows[1] }])).text;
      const insertion = (await api.edit([{ after: rows[3], text: "target" }])).text;
      return { deletion, insertion };
    }, null);
  console.log(JSON.stringify(results, null, 2));
} finally { await rm(root, { recursive: true, force: true }); }
