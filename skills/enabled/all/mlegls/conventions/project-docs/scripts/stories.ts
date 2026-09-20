#!/usr/bin/env bun
// Queries over docs/stories/ frontmatter. See ../references/stories.md.
//
//   stories               persona, kind and sequence per story
//   stories unwalked      stories with no sequence test
//   stories check         unknown kind, report without noticed, sequence path missing
//
// Run from anywhere inside a project; the nearest docs/stories/ upward is used.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

type Story = { id: string; persona?: string; kind?: string; sequence?: string; noticed?: string };
const KINDS = new Set(["process", "feature", "report"]);

function findUp(from: string): { root: string; dir: string } {
  let dir = resolve(from);
  for (;;) {
    const cand = join(dir, "docs", "stories");
    if (existsSync(cand) && statSync(cand).isDirectory()) return { root: dir, dir: cand };
    const up = dirname(dir);
    if (up === dir) throw new Error("no docs/stories/ found upward from " + from);
    dir = up;
  }
}

function load(dir: string): Story[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort()
    .map((n) => {
      const m = readFileSync(join(dir, n), "utf8").match(/^---\n([\s\S]*?)\n---/);
      const s: Story = { id: n.slice(0, -3) };
      for (const line of m?.[1].split("\n") ?? []) {
        const kv = line.match(/^([\w-]+):\s*(.*)$/);
        if (kv) (s as Record<string, string>)[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
      }
      return s;
    });
}

const [cmd] = process.argv.slice(2);
const { root, dir } = findUp(process.cwd());
const all = load(dir);
const line = (s: Story) => `${s.id}  [${s.persona ?? "?"} ${s.kind ?? "?"}]${s.sequence ? "  " + s.sequence : ""}`;

switch (cmd) {
  case undefined:
    all.forEach((s) => console.log(line(s)));
    break;
  case "unwalked":
    all.filter((s) => !s.sequence).forEach((s) => console.log(line(s)));
    break;
  case "check": {
    let bad = 0;
    const say = (m: string) => (bad++, console.log(m));
    for (const s of all) {
      if (!s.persona) say(`${s.id}: no persona`);
      if (!s.kind || !KINDS.has(s.kind)) say(`${s.id}: kind must be one of ${[...KINDS].join(", ")}`);
      if (s.kind === "report" && !s.noticed) say(`${s.id}: report without noticed`);
      if (s.sequence && !existsSync(join(root, s.sequence))) say(`${s.id}: sequence ${s.sequence} does not exist`);
    }
    if (!bad) console.log("ok");
    else process.exitCode = 1;
    break;
  }
  default:
    console.log("usage: stories [unwalked | check]");
    process.exitCode = 2;
}
