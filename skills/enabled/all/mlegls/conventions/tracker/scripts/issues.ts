#!/usr/bin/env bun
// Queries over docs/issues/ frontmatter. See ../references/issue-tracker-vault.md.
//
//   issues frontier [slug]  an agent can start: next is research/implement/simplify, unblocked, unclaimed
//   issues mine [slug]      needs me: next is grill/prototype/measure, unblocked; by priority, then dependents
//   issues tree [slug]      subtree under slug (or every root), children in dependency order
//   issues check            dangling links and anchors across docs/, blockers already done, done outside archive
//
// [slug] scopes to that issue's subtree.
//
// Run from anywhere inside a project; the nearest docs/issues/ upward is used.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { isAlias, isMap, isScalar, parseDocument, visit } from "yaml";

type Issue = {
  slug: string;
  file: string;
  archived: boolean;
  next: string;
  partOf?: string;
  blockedBy: string[];
  claimedBy?: string;
  priority?: number;
};

const slugOf = (link: string) => basename(link.replace(/^\[\[|\]\]$/g, "").split("|")[0]);

function parseFrontmatter(text: string, file: string): Omit<Issue, "slug" | "file" | "archived"> {
  try {
    const m = text.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m);
    if (!m || m.index !== 0) throw new Error("missing or unterminated frontmatter");
    const doc = parseDocument(m[1], { uniqueKeys: true, merge: false });
    if (doc.errors.length || doc.warnings.length) throw new Error([...doc.errors, ...doc.warnings].map((e) => e.message).join("; "));
    if (!isMap(doc.contents)) throw new Error("frontmatter must be a mapping");
    visit(doc, {
      Node(_, node) {
        if (isAlias(node) || node.tag) throw new Error("YAML aliases and explicit tags are not supported");
      },
      Pair(_, pair) {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string") throw new Error("YAML keys must be strings");
        if (pair.key.value === "<<") throw new Error("YAML merge keys are not supported");
      },
    });
    const fm = doc.toJS({ maxAliasCount: 0 });
    const link = (value: unknown): string => {
      if (typeof value !== "string" || !/^\[\[projects\/[^/\[\]#|\s]+\/issues\/(?:archive\/)?[^/\[\]#|\s]+(?:\|[^\[\]\r\n]+)?\]\]$/.test(value))
        throw new Error("relations must be vault-absolute issue wikilinks");
      return slugOf(value);
    };
    if (!KINDS.includes(fm.next)) throw new Error("next must be one of " + KINDS.join(" "));
    if ("blocked-by" in fm && !Array.isArray(fm["blocked-by"])) throw new Error("blocked-by must be a list of issue wikilinks");
    if ("claimed-by" in fm && (typeof fm["claimed-by"] !== "string" || !fm["claimed-by"].trim())) throw new Error("claimed-by must be a nonempty string");
    if ("priority" in fm && ![1, 2, 3].includes(fm.priority)) throw new Error("priority must be 1, 2 or 3");
    return {
      next: fm.next,
      partOf: "part-of" in fm ? link(fm["part-of"]) : undefined,
      blockedBy: (fm["blocked-by"] ?? []).map(link),
      claimedBy: fm["claimed-by"],
      priority: fm.priority,
    };
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : error}`);
  }
}

function findIssuesDir(from: string): string {
  let dir = resolve(from);
  for (;;) {
    for (const cand of [join(dir, "docs", "issues"), join(dir, "issues")]) {
      if (existsSync(cand) && statSync(cand).isDirectory()) return cand;
    }
    const up = dirname(dir);
    if (up === dir) throw new Error("no docs/issues/ found upward from " + from);
    dir = up;
  }
}

function load(dir: string): Map<string, Issue> {
  const issues = new Map<string, Issue>();
  const walk = (d: string, archived: boolean) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name !== "attachments") walk(p, archived || name === "archive");
      } else if (name.endsWith(".md")) {
        const fm = parseFrontmatter(readFileSync(p, "utf8"), p);
        const slug = name.slice(0, -3);
        issues.set(slug, { slug, file: p, archived, ...fm });
      }
    }
  };
  walk(dir, false);
  return issues;
}

const KINDS = ["grill", "research", "prototype", "measure", "simplify", "implement", "wait", "done"];
const AGENT = new Set(["research", "implement", "simplify"]);
const ME = new Set(["grill", "prototype", "measure"]);

function hasOpenChildren(slug: string, all: Map<string, Issue>): boolean {
  for (const i of all.values()) if (i.partOf === slug && i.next !== "done") return true;
  return false;
}

function actor(i: Issue, all: Map<string, Issue>): "agent" | "me" | "nobody" {
  if (hasOpenChildren(i.slug, all)) return "nobody"; // its open children carry it
  if (AGENT.has(i.next)) return "agent";
  if (ME.has(i.next)) return "me";
  return "nobody";
}

function effectivePriority(i: Issue, all: Map<string, Issue>): number {
  let cur: Issue | undefined = i;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.slug)) {
    if (cur.priority !== undefined) return cur.priority;
    seen.add(cur.slug);
    cur = cur.partOf ? all.get(cur.partOf) : undefined;
  }
  return 3;
}

function dependents(slug: string, all: Map<string, Issue>): number {
  let n = 0;
  for (const i of all.values()) if (i.next !== "done" && i.blockedBy.includes(slug)) n++;
  return n;
}

function openBlockers(i: Issue, all: Map<string, Issue>): string[] {
  return i.blockedBy.filter((b) => all.get(b)?.next !== "done");
}

function line(i: Issue, all: Map<string, Issue>): string {
  const bits = [i.next];
  if (i.claimedBy) bits.push("claimed:" + i.claimedBy);
  const ob = openBlockers(i, all);
  if (ob.length) bits.push("blocked:" + ob.join(","));
  const d = dependents(i.slug, all);
  return `${i.slug}  [${bits.join(" ")}] p${effectivePriority(i, all)}${d ? " unblocks:" + d : ""}`;
}

// children in dependency order: an issue after everything in blocked-by it shares a parent with
function ordered(xs: Issue[]): Issue[] {
  const slugs = new Set(xs.map((x) => x.slug));
  const out: Issue[] = [];
  const seen = new Set<string>();
  const visit = (x: Issue) => {
    if (seen.has(x.slug)) return;
    seen.add(x.slug);
    for (const b of x.blockedBy) if (slugs.has(b)) visit(xs.find((y) => y.slug === b)!);
    out.push(x);
  };
  for (const x of [...xs].sort((a, b) => a.slug.localeCompare(b.slug))) visit(x);
  return out;
}

function within(slug: string | undefined, all: Map<string, Issue>): (i: Issue) => boolean {
  if (!slug) return () => true;
  if (!all.has(slug)) throw new Error("no issue " + slug);
  return (i) => {
    for (let c: Issue | undefined = i; c; c = c.partOf ? all.get(c.partOf) : undefined) if (c.slug === slug) return true;
    return false;
  };
}

function tree(root: Issue | undefined, all: Map<string, Issue>, depth = 0): string[] {
  const out: string[] = [];
  const children = [...all.values()].filter((c) => (root ? c.partOf === root.slug : !c.partOf || !all.has(c.partOf)));
  if (root) out.push("  ".repeat(depth) + line(root, all));
  for (const c of ordered(children)) {
    out.push(...tree(c, all, root ? depth + 1 : 0));
  }
  return out;
}

// Every [[link]] and [[link#Heading]] under docs/, resolved as Obsidian does: by
// basename, disambiguated by the link's trailing path segments; fenced code ignored.
function checkLinks(docs: string, say: (s: string) => void) {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".md")) files.push(p);
    }
  };
  walk(docs);
  // Top-level vault notes (project pages, ideas) are link targets too; only the vault root, not its project symlinks.
  const vault = process.env.TRACKER_VAULT ?? join(process.env.HOME ?? "", "obsidian");
  const targets = [...files];
  if (existsSync(vault)) for (const name of readdirSync(vault)) if (name.endsWith(".md")) targets.push(join(vault, name));
  const byBase = new Map<string, string[]>();
  for (const f of targets) {
    const b = basename(f, ".md");
    byBase.set(b, [...(byBase.get(b) ?? []), f]);
  }
  const resolveLink = (target: string): string | undefined => {
    const segs = target.split("/");
    const cands = byBase.get(segs[segs.length - 1]) ?? [];
    if (cands.length <= 1) return cands[0];
    const tail = segs.slice(-2).join("/") + ".md";
    return cands.find((c) => c.endsWith("/" + tail)) ?? cands.find((c) => c.endsWith(target + ".md"));
  };
  const headings = new Map<string, Set<string>>();
  const headingsOf = (f: string) => {
    let h = headings.get(f);
    if (!h) {
      h = new Set([...readFileSync(f, "utf8").matchAll(/^#+\s+(.+?)\s*$/gm)].map((m) => m[1]));
      headings.set(f, h);
    }
    return h;
  };
  const seen = new Set<string>();
  for (const f of files) {
    const text = readFileSync(f, "utf8").replace(/^```[\s\S]*?^```/gm, "");
    const rel = f.slice(docs.length + 1);
    for (const m of text.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|[^\]]*)?\]\]/g)) {
      const target = m[1].trim();
      if (seen.has(rel + m[0])) continue;
      seen.add(rel + m[0]);
      const to = resolveLink(target);
      if (!to) say(`${rel}: [[${target}]] does not exist`);
      else if (m[2] && !m[2].startsWith("^") && !headingsOf(to).has(m[2].trim()))
        say(`${rel}: [[${target}#${m[2]}]] has no such heading`);
    }
  }
}

const [cmd, arg] = process.argv.slice(2);
const dir = findIssuesDir(process.cwd());
const all = load(dir);
const open = [...all.values()].filter((i) => i.next !== "done" && within(arg, all)(i));

switch (cmd) {
  case "frontier": {
    open
      .filter((i) => actor(i, all) === "agent" && !openBlockers(i, all).length && !i.claimedBy)
      .sort((a, b) => effectivePriority(a, all) - effectivePriority(b, all) || dependents(b.slug, all) - dependents(a.slug, all))
      .forEach((i) => console.log(line(i, all)));
    break;
  }
  case "mine": {
    open
      .filter((i) => actor(i, all) === "me" && !openBlockers(i, all).length)
      .sort((a, b) => effectivePriority(a, all) - effectivePriority(b, all) || dependents(b.slug, all) - dependents(a.slug, all))
      .forEach((i) => console.log(line(i, all)));
    break;
  }
  case "tree": {
    if (arg && !all.has(arg)) throw new Error("no issue " + arg);
    console.log(tree(arg ? all.get(arg) : undefined, all).join("\n"));
    break;
  }
  case "check": {
    let bad = 0;
    const say = (s: string) => (bad++, console.log(s));
    for (const i of all.values()) {
      if (i.partOf && !all.has(i.partOf)) say(`${i.slug}: part-of ${i.partOf} does not exist`);
      for (const b of i.blockedBy) {
        if (!all.has(b)) say(`${i.slug}: blocked-by ${b} does not exist`);
        else if (all.get(b)!.next === "done") say(`${i.slug}: blocked-by ${b} is done; remove it`);
      }
      if (i.next === "done" && !i.archived) say(`${i.slug}: done but not in archive/`);
      if (i.next !== "done" && i.archived) say(`${i.slug}: in archive/ but ${i.next}`);
      if (!KINDS.includes(i.next)) say(`${i.slug}: next is ${i.next}; one of ${KINDS.join(" ")}`);
    }
    checkLinks(dirname(dir), say);
    if (!bad) console.log("ok");
    else process.exitCode = 1;
    break;
  }
  default:
    console.log("usage: issues frontier [slug] | mine [slug] | tree [slug] | check");
    process.exitCode = 2;
}
