// drift: which concept notes a change contradicts, and which statement of each.
//
//   bun lib/lint/drift.ts <repoRoot> <fromRef> [toRef] [--all]
//
// Pairs the change with every note under docs/ whose `path:` frontmatter names or contains a
// changed code file, or whose title is that file's stem or one of its words (confirmations.ts →
// Confirmation): a concept is often enacted in files its `path:` does not name. Notes are read as
// they stand at toRef (the working tree when omitted), so a note the change updated is judged in
// its updated form. For each note and each diff chunk (commit messages plus whole-file diffs,
// ~12k chars), Jev picks the note statement the change contradicts, or none; a note's score is
// the largest 1 - p(none) over its chunks. One request per (note, chunk).
//
// Advisory: prints notes at or above 0.5 (all with --all), highest first, with the statement.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decide } from "../decide";

export interface Note { file: string; title: string; paths: string[]; body: string }
export interface Drift { note: string; p: number; pick?: number; statement?: string; statementP?: number; files: string[] }

const QUESTION = "TypeScript from a solo-maintained codebase whose docs/ concept notes describe what the code does. `change` is a change to the code: its commit messages and diff (- removed, + added lines, comments included). `note` names a documentation note; its statements are the choices, as they stand after the change. Which statement does the code contradict after this change — the code doing what the statement says does not happen, or no longer doing what it says it does? Behavior the note merely does not mention contradicts nothing.";
const VERIFY = "TypeScript from a solo-maintained codebase whose docs/ concept notes describe what the code does. `change` is a change to the code: its commit messages and diff (- removed, + added lines, comments included). `statement` is one statement from the documentation note in `note`, as it stands after the change. Is `statement` false of the code after this change? Answer yes only if the change makes the code do what the statement says does not happen, or stop doing what it says it does; a statement about something the change does not touch, or that merely omits what the change adds, is not false.";

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|css|sql)$/;
const TEST = /(\.test\.|\.spec\.|(^|\/)tests?\/)/;
const GENERATED = /(\/_generated\/|\.d\.ts$|\.gen\.)/;

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
}

/** Notes under docs/ with `path:` frontmatter, at a ref or in the working tree. */
export function notes(root: string, ref?: string): Note[] {
  const files = (ref ? git(root, "ls-tree", "-r", "--name-only", ref, "docs") : git(root, "ls-files", "docs"))
    .split("\n").filter((f) => f.endsWith(".md") && !/\/(issues|attachments|guide)\//.test(f));
  const out: Note[] = [];
  for (const file of files) {
    if (!ref && !existsSync(resolve(root, file))) continue;
    const text = ref ? git(root, "show", `${ref}:${file}`) : readFileSync(resolve(root, file), "utf8");
    const front = /^---\n([\s\S]*?)\n---\s*/.exec(text);
    if (!front) continue;
    let meta: unknown;
    try { meta = Bun.YAML.parse(front[1]!); } catch { continue; }
    const path = (meta as { path?: unknown } | null)?.path;
    const paths = (Array.isArray(path) ? path : [path]).filter((p): p is string => typeof p === "string");
    if (!paths.length) continue;
    out.push({ file, title: file.split("/").pop()!.replace(/\.md$/, ""), paths, body: text.slice(front[0].length) });
  }
  return out;
}

const singular = (w: string) => w.toLowerCase().replace(/s$/, "");
/** Does a note document a file: its path, a directory above it, a template slot, or its title? */
export function pairs(note: Note, file: string): boolean {
  const stem = file.split("/").pop()!.replace(/\..*$/, "");
  if ([stem, ...stem.split(/[-_]/)].map(singular).includes(singular(note.title.replace(/\s+/g, "-")))) return true;
  return note.paths.some((p) => p === file || (p.endsWith("/") && file.startsWith(p)) || (p.includes("<") && new RegExp("^" + p.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/<[^>]+>/g, "[^/]+") + "$").test(file)));
}

/** Sentences of a note's prose, the choices a contradiction can point at. */
export function statements(body: string): string[] {
  return body.split(/\n\s*\n/).flatMap((para) => para.replace(/\s*\n\s*/g, " ").split(/(?<=[.!?])\s+(?=[A-Z`\[*])/))
    .map((s) => s.trim()).filter((s) => s.length > 20 && !s.startsWith("#"));
}

export async function drift(root: string, from: string, to?: string): Promise<Drift[]> {
  const range = to ? [from, to] : [from];
  const changed = git(root, "diff", "--name-only", ...range, "--").split("\n").filter((f) => CODE.test(f) && !TEST.test(f) && !GENERATED.test(f));
  if (!changed.length) return [];
  const messages = git(root, "log", "--format=%s%n%n%b", `${from}..${to ?? "HEAD"}`).trim();
  const chunks: { files: string[]; text: string }[] = [];
  for (const file of changed) {
    const diff = git(root, "diff", "-U1", ...range, "--", file).slice(0, 12000);
    const last = chunks.at(-1);
    if (last && last.text.length + diff.length <= 12000) { last.files.push(file); last.text += diff; }
    else chunks.push({ files: [file], text: diff });
  }
  const paired = notes(root, to).filter((n) => changed.some((f) => pairs(n, f)));
  const jobs = paired.flatMap((note) => chunks.map((chunk) => ({ note, chunk })));
  const results: Drift[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < jobs.length) {
      const { note, chunk } = jobs[i++]!;
      const ss = statements(note.body);
      if (!ss.length) continue;
      const criteria = { none: "No statement is contradicted", ...Object.fromEntries(ss.map((s, n) => [String(n), s])) };
      try {
        const d = await decide({ change: (messages ? messages.slice(0, 2000) + "\n\n" : "") + chunk.text, note: note.file + "\n\n" + note.body.slice(0, 6000) }, { claim: { type: "choice", instructions: QUESTION, criteria } });
        const [best, bestP] = Object.entries(d.claim!.dist).filter(([c]) => c !== "none").sort((a, b) => b[1] - a[1])[0] ?? [];
        const statement = best === undefined ? undefined : ss[+best];
        const verified = statement === undefined ? 0 : (await decide({ change: (messages ? messages.slice(0, 2000) + "\n\n" : "") + chunk.text, note: note.file + "\n\n" + note.body.slice(0, 6000), statement }, { false: { type: "noul", instructions: VERIFY } })).false!.dist.true!;
        results.push({ note: note.file, p: verified, pick: 1 - (d.claim!.dist.none ?? 0), statement, statementP: bestP, files: chunk.files });
      } catch (error) { console.error(`${note.file} × ${chunk.files[0]}: ${(error as Error).message}`); }
    }
  }));
  // A note's score is its most contradicted chunk.
  const byNote = new Map<string, Drift>();
  for (const r of results) if ((byNote.get(r.note)?.p ?? -1) < r.p) byNote.set(r.note, r);
  return [...byNote.values()].sort((a, b) => b.p - a.p);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const [rootArg, from, to] = args.filter((a) => a !== "--all");
  if (!rootArg || !from) throw new Error("usage: drift.ts <repoRoot> <fromRef> [toRef] [--all]");
  const found = await drift(resolve(rootArg), from, to);
  for (const d of found) if (all || d.p >= 0.5) console.log(`${d.p.toFixed(2)} ${d.note}  (${d.files.length > 2 ? d.files.slice(0, 2).join(", ") + ", …" : d.files.join(", ")})\n     ${d.statementP?.toFixed(2)} ${d.statement?.slice(0, 200)}`);
  console.log(`${found.length} notes judged for ${from}..${to ?? "working tree"}; ${found.filter((d) => d.p >= 0.5).length} at or above 0.5`);
}
