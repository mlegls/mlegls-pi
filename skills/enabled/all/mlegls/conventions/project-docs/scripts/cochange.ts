#!/usr/bin/env bun
// Files that change together, from git history: Parnas's criterion measured.
// See ../references/theory.md.
//
//   cochange [--since DATE] [--theory docs/theory.md] [path...]
//
// Prints pairs by Jaccard of their commit sets, strongest first. With a
// theory, a pair whose files the tree places under different nodes is marked
// `!=`: the tree's error signal, alongside frictions.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const since = opt("--since", "1 year ago")!;
const theoryPath = opt("--theory", existsSync("docs/theory.md") ? "docs/theory.md" : undefined);
const paths = args.length ? args : ["."];

const log = execSync(
  `git log --since='${since}' --name-only --pretty=format:--- -- ${paths.map((p) => `'${p}'`).join(" ")}`,
  { encoding: "utf8", maxBuffer: 1 << 28 },
);
const commits: Set<string>[] = [];
let cur = new Set<string>();
for (const line of log.split("\n")) {
  const f = line.trim();
  if (f === "---") {
    if (cur.size) commits.push(cur);
    cur = new Set();
  } else if (f && existsSync(f) && !/\.(css|lock|md|json)$|\.gen\.|generated/.test(f)) cur.add(f);
}
if (cur.size) commits.push(cur);

const single = new Map<string, number>();
const pair = new Map<string, number>();
for (const c of commits) {
  if (c.size < 2 || c.size > 12) continue; // singletons say nothing; sweeps say too much
  const files = [...c].sort();
  for (const f of files) single.set(f, (single.get(f) ?? 0) + 1);
  for (let i = 0; i < files.length; i++)
    for (let j = i + 1; j < files.length; j++) {
      const k = `${files[i]}\t${files[j]}`;
      pair.set(k, (pair.get(k) ?? 0) + 1);
    }
}

// Tree nodes: a line with a wikilink and a backtick path places that path.
type Node = { name: string; path: string; depth: number };
const nodes: Node[] = [];
let base = "";
if (theoryPath && existsSync(theoryPath)) {
  const theory = readFileSync(theoryPath, "utf8");
  base = theory.match(/Paths are `([^`]+)`/)?.[1] ?? "";
  for (const line of theory.split("\n")) {
    const m = line.match(/^(\s*)- .*?\[\[[^\]|]*\|?([^\]|]*)\]\](.*)$/);
    if (!m) continue;
    for (const [, p] of m[3].matchAll(/`([^`*]+)`/g)) nodes.push({ name: m[2], path: base + p, depth: m[1].length });
  }
}
const nodeOf = (f: string) =>
  nodes.filter((n) => f.startsWith(n.path)).sort((a, b) => b.path.length - a.path.length)[0]?.name;

const rows: [number, number, string, string][] = [];
for (const [k, n] of pair) {
  if (n < 3) continue;
  const [a, b] = k.split("\t");
  rows.push([n / (single.get(a)! + single.get(b)! - n), n, a, b]);
}
rows.sort((x, y) => y[0] - x[0]);
console.log(`${commits.length} commits since ${since}`);
for (const [j, n, a, b] of rows) {
  if (j < 0.25) break;
  const na = nodeOf(a), nb = nodeOf(b);
  const mark = nodes.length ? (na && nb && na !== nb ? `!= ${na} / ${nb}` : na ?? nb ?? "") : "";
  console.log(`${j.toFixed(2)} ${String(n).padStart(2)}  ${a}  ${b}  ${mark}`);
}
