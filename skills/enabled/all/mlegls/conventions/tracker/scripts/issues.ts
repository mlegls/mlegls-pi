#!/usr/bin/env bun
// Queries over docs/issues/ frontmatter. See ../references/issue-tracker-vault.md.
//
//   issues frontier [slug]  execution-ready agent-permitted subtrees, unblocked and unclaimed
//   issues mine [slug]      explicit human/user assignments, including shaping work
//   issues tree [slug]      subtree under slug (or every root), children in dependency order
//   issues check            dangling links and anchors across docs/, blockers already done, archive consistency, stale claims
//   issues outline          the project's outliner note against the tracker: each linked bullet's state, unlinked intent, uncovered issues
//
// [slug] scopes to that issue's subtree.
//
// Run from anywhere inside a project; the nearest docs/issues/ upward is used.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { isAlias, isMap, isScalar, parseDocument, visit } from "yaml";

import { cached, refresh, format } from "../../../../../../../lib/tracker-lint.ts";

type Issue = {
  slug: string;
  file: string;
  archived: boolean;
  next?: string;
  stage?: string;
  assignee?: string;
  author?: string;
  partOf?: string;
  blockedBy: string[];
  guards: string[];
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
    if ("next" in fm) {
      if (!KINDS.includes(fm.next)) throw new Error("next must be one of " + KINDS.join(" "));
      if ("stage" in fm) throw new Error("legacy next cannot mix with stage");
    }
    if ("stage" in fm && !STAGES.includes(fm.stage)) throw new Error("stage must be one of " + STAGES.join(" "));
    if ("assignee" in fm && (typeof fm.assignee !== "string" || !validAssignee(fm.assignee))) throw new Error("invalid assignee selector");
    if ("author" in fm && (typeof fm.author !== "string" || !fm.author.trim())) throw new Error("author must be a nonempty provenance string");
    if ("blocked-by" in fm && !Array.isArray(fm["blocked-by"])) throw new Error("blocked-by must be a list of issue wikilinks and guards");
    const isLink = (value: unknown) => typeof value === "string" && value.startsWith("[[");
    const guards = (fm["blocked-by"] ?? []).filter((value: unknown) => !isLink(value));
    for (const g of guards) if (typeof g !== "string" || !/^[a-z][a-z0-9-]*: \S/.test(g)) throw new Error("blocked-by entries must be issue wikilinks or quoted '<tag>: <value>' guards");
    if ("claimed-by" in fm && (typeof fm["claimed-by"] !== "string" || !fm["claimed-by"].trim())) throw new Error("claimed-by must be a nonempty string");
    if ("priority" in fm && ![1, 2, 3, 4].includes(fm.priority)) throw new Error("priority must be 1, 2, 3 or 4");
    return {
      next: fm.next,
      stage: fm.stage, assignee: fm.assignee, author: fm.author,
      partOf: "part-of" in fm ? link(fm["part-of"]) : undefined,
      blockedBy: (fm["blocked-by"] ?? []).filter(isLink).map(link),
      guards,
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
        if (issues.has(slug)) throw new Error(`${p}: duplicate issue slug ${slug}`);
        issues.set(slug, { slug, file: p, archived, ...fm });
      }
    }
  };
  walk(dir, false);
  return issues;
}

const KINDS = ["grill", "research", "prototype", "measure", "simplify", "implement", "wait", "done"];
const STAGES = ["idea", "goal", "spec", "ticket", "done"];
// Routing owns stance and model resolution; tracker validates selector syntax only.
function validAssignee(a: string): boolean {
  const parts = a.split(",").map(p => p.trim());
  const stance = (p: string) => /^agent:[a-z][a-z0-9-]*$/.test(p);
  const model = (p: string) => /^model:[^\s/,:]+\/[^\s,:]+:([a-z]+)$/.test(p);
  if (parts.length === 2) return (stance(parts[0]) && model(parts[1])) || (model(parts[0]) && stance(parts[1]));
  return parts.length === 1 && (/^(agent|human)$/.test(a) || /^(user|session):[^\s,]+$/.test(a) || stance(a) || model(a));
}
function children(i: Issue, all: Map<string, Issue>): Issue[] {
  return [...all.values()].filter(c => c.partOf === i.slug);
}
function effectiveStage(i: Issue, all: Map<string, Issue>, seen = new Set<string>()): string | null {
  if (i.archived) return "done";
  if (i.next) return null;
  if (seen.has(i.slug)) throw new Error(i.file + ": part-of cycle");
  const path = new Set(seen).add(i.slug);
  const stages = [i.stage ?? "done", ...children(i, all).map(c => effectiveStage(c, all, path))];
  if (stages.includes(null)) return null;
  return STAGES[Math.min(...stages.map(s => STAGES.indexOf(s!)))];
}
function complete(i: Issue, all: Map<string, Issue>): boolean {
  return i.next ? i.next === "done" : effectiveStage(i, all) === "done";
}
function subtree(i: Issue, all: Map<string, Issue>): Issue[] {
  return [i, ...children(i, all).filter(c => !c.archived).flatMap(c => subtree(c, all))];
}
function model(i: Issue, all: Map<string, Issue>, explicit = false) {
  const effective = effectiveStage(i, all);
  const nodes = subtree(i, all).filter(n => !n.archived && !complete(n, all));
  const remaining = nodes.filter(n => n.stage !== undefined && n.stage !== "done");
  const scope = new Set(subtree(i, all).map(n => n.slug));
  const blockers = [...new Set(nodes.flatMap(n => openBlockers(n, all)))].filter(slug => !scope.has(slug));
  const claims = subtree(i, all).filter(n => !n.archived).filter(n => n.claimedBy).map(n => ({ slug: n.slug, claimedBy: n.claimedBy }));
  const selectors = remaining.map(n => ({ slug: n.slug, assignee: n.assignee ?? null }));
  const eligible = !i.next && remaining.length > 0 && remaining.every(n => n.assignee === "agent" || n.assignee?.startsWith("agent:") || n.assignee?.startsWith("model:"));
  const ready = effective === "spec" || effective === "ticket";
  const deferred = nodes.some(n => n.priority === 4);
  return { slug: i.slug, file: i.file, archived: i.archived, legacy: !!i.next, next: i.next,
    ownStage: i.stage ?? null, effectiveStage: effective, assignee: i.assignee ?? null,
    author: i.author ?? null, priority: i.priority ?? null, partOf: i.partOf ?? null, blockedBy: i.blockedBy, guards: i.guards,
    ready, eligible, blockers, claims, selectors, deferred,
    frontier: !i.archived && ready && eligible && !blockers.length && !claims.length && (explicit || !deferred),
    done: !i.archived && complete(i, all) };
}
function effectivePriority(i: Issue, _all: Map<string, Issue>): number { return i.priority ?? 2.5; }

function dependents(slug: string, all: Map<string, Issue>): number {
  let n = 0;
  for (const i of all.values()) if (!complete(i, all) && i.blockedBy.includes(slug)) n++;
  return n;
}

function openBlockers(i: Issue, all: Map<string, Issue>): string[] {
  return [...i.blockedBy.filter((b) => !all.has(b) || !complete(all.get(b)!, all)), ...i.guards];
}

// A claim is carried by a worktree named for the slug, or for the run the claim names.
let worktrees: string[] | undefined;
function claimLive(i: Issue): boolean | undefined {
  if (!i.claimedBy) return undefined;
  if (!worktrees) {
    const p = spawnSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" });
    worktrees = p.status === 0 ? p.stdout.split("\n").filter((l) => /^(worktree|branch) /.test(l)) : [];
  }
  const runs = [...i.claimedBy.matchAll(/run_[0-9a-f]+/g)].map((m) => m[0]);
  const tokens = [i.slug, ...runs];
  if (!runs.length && (!i.next || !["research", "implement", "simplify"].includes(i.next))) return undefined;
  return worktrees.some((w) => tokens.some((t) => w.includes(t)));
}

function line(i: Issue, all: Map<string, Issue>): string {
  const bits = [i.next ? "legacy next:" + i.next : "own:" + (i.stage ?? "none") + " effective:" + effectiveStage(i, all)];
  if (i.assignee) bits.push("assignee:" + i.assignee);
  if (i.claimedBy) bits.push((claimLive(i) === false ? "stale-claim:" : "claimed:") + i.claimedBy);
  const ob = openBlockers(i, all).filter((b) => !i.guards.includes(b));
  if (ob.length) bits.push("prerequisites:" + ob.join(","));
  for (const g of i.guards) bits.push("guard:" + JSON.stringify(g));
  const d = dependents(i.slug, all);
  return `${i.slug}  [${bits.join(" ")}] p${i.priority ?? "?"}${d ? " unblocks:" + d : ""}`;
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
// A vault-absolute issue link left dangling by archiving (or un-archiving) is
// rewritten to where the issue now is, and reported as fixed.
function checkLinks(docs: string, say: (s: string) => void, fixed: (s: string) => void) {
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
    if (segs[0] === "projects" && existsSync(join(vault, ...segs.slice(0, 2)))) {
      // A note is named without its extension; any other file (an attachment script, an image) with it.
      return [join(vault, target + ".md"), join(vault, target)].find((p) => existsSync(p) && statSync(p).isFile());
    }
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
  // projects/<repo>/issues/<slug> <-> projects/<repo>/issues/archive/<slug>
  const moved = (target: string): string | undefined => {
    const m = target.match(/^(projects\/[^/]+\/issues\/)(archive\/)?([^/]+)$/);
    if (!m) return undefined;
    const alt = m[1] + (m[2] ? "" : "archive/") + m[3];
    return resolveLink(alt) ? alt : undefined;
  };
  const seen = new Set<string>();
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    const text = raw.replace(/^```[\s\S]*?^```/gm, "");
    const fixes = new Map<string, string>();
    const rel = f.slice(docs.length + 1);
    for (const m of text.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|[^\]]*)?\]\]/g)) {
      const target = m[1].trim().replace(/\\$/, ""); // [[x\|alias]] inside a table
      if (seen.has(rel + m[0])) continue;
      seen.add(rel + m[0]);
      const to = resolveLink(target);
      const alt = to ? undefined : moved(target);
      if (alt) fixes.set(target, alt);
      else if (!to) say(`${rel}: [[${target}]] does not exist`);
      else if (m[2] && to.endsWith(".md") && !m[2].startsWith("^") && !headingsOf(to).has(m[2].trim()))
        say(`${rel}: [[${target}#${m[2]}]] has no such heading`);
    }
    if (!fixes.size) continue;
    let out = raw;
    for (const [from, to] of fixes) {
      for (const end of ["]]", "#", "|", "\\|"]) out = out.split("[[" + from + end).join("[[" + to + end);
      fixed(`${rel}: [[${from}]] -> [[${to}]]`);
    }
    writeFileSync(f, out);
  }
}

// The vault note whose frontmatter directory is this project.
function outlineNote(root: string): string | undefined {
  const vault = process.env.TRACKER_VAULT ?? join(homedir(), "obsidian");
  if (!existsSync(vault)) return undefined;
  const real = (p: string) => { p = resolve(p.replace(/^~(?=$|\/)/, homedir())); return existsSync(p) ? realpathSync(p) : p; };
  for (const name of readdirSync(vault)) {
    if (!name.endsWith(".md")) continue;
    const text = readFileSync(join(vault, name), "utf8");
    const m = text.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---/m);
    const directory = m?.[1].match(/^directory:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1];
    if (directory && real(directory) === real(root)) return join(vault, name);
  }
  return undefined;
}

// Each top-level line of the outliner with its issues' state; unlinked lines in sections that link issues; open issues no bullet covers.
function outline(note: string, all: Map<string, Issue>): string[] {
  const out: string[] = [];
  const lines = readFileSync(note, "utf8").split(/\r?\n/);
  const linked = new Set<string>();
  const firstLine = new Map<string, number>();
  let section = "", sectionLinks = false, start = 0;
  const pending: { n: number; text: string }[] = [];
  const flushSection = () => {
    if (sectionLinks) for (const p of pending) out.push(`${p.n}: ${p.text}  [no issue]`);
    pending.length = 0; sectionLinks = false;
  };
  for (let n = 1; n <= lines.length; n++) {
    const raw = lines[n - 1];
    if (n === 1 && raw.trim() === "---") { start = lines.indexOf("---", 1) + 1; }
    if (n <= start) continue;
    const h = raw.match(/^#+\s+(.*)/);
    if (h) { flushSection(); section = h[1]; continue; }
    if (/^\s/.test(raw) || !raw.trim()) continue;
    const links = [...raw.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1]).filter((t) => t.includes("/issues/")).map(slugOf);
    const text = raw.replace(/^[-*+]\s+/, "").replace(/\s*·?\s*\[\[[^\]]+\]\]/g, "").trim().slice(0, 80);
    if (!links.length) { pending.push({ n, text }); continue; }
    sectionLinks = true;
    for (const slug of links) {
      const i = all.get(slug);
      if (!i) { out.push(`${n}: ${text}  [[${slug}]] does not exist`); continue; }
      if (firstLine.has(slug)) out.push(`${n}: ${text}  ${slug} also at ${firstLine.get(slug)}`);
      else firstLine.set(slug, n);
      linked.add(slug);
      out.push(`${n}: ${text}  ${line(i, all)}${complete(i, all) ? "  (done; review/digest)" : ""}`);
    }
  }
  flushSection();
  // A bullet covers the issue it links, that issue's subtree, and the parents it sits under.
  const covered = new Set<string>();
  for (const slug of linked) for (let c = all.get(slug); c; c = c.partOf ? all.get(c.partOf) : undefined) covered.add(c.slug);
  const isCovered = (i: Issue): boolean => {
    for (let c: Issue | undefined = i; c; c = c.partOf ? all.get(c.partOf) : undefined) if (linked.has(c.slug)) return true;
    return covered.has(i.slug);
  };
  for (const i of [...all.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (complete(i, all) || isCovered(i)) continue;
    const parent = i.partOf ? all.get(i.partOf) : undefined;
    if (parent && !complete(parent, all)) continue; // its topmost open ancestor is reported
    out.push(`uncovered: ${line(i, all)}`);
  }
  return out;
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const [cmd, arg] = args.filter(a => a !== "--json");
const dir = findIssuesDir(process.cwd());
const all = load(dir);
// Validate graph before any output, including legacy graphs.
for (const i of all.values()) {
  for (const relation of ["partOf", "blockedBy", "completion"] as const) {
    const visit = (n: Issue, path: Set<string>) => {
      if (path.has(n.slug)) throw new Error(i.file + ": " + relation + " cycle");
      const next = new Set(path).add(n.slug);
      const edges = relation === "partOf" ? (n.partOf ? [n.partOf] : []) : relation === "blockedBy" ? n.blockedBy : n.archived ? [] : [...n.blockedBy, ...children(n, all).filter(c => !c.archived).map(c => c.slug)];
      for (const edge of edges) if (all.has(edge)) visit(all.get(edge)!, next);
    };
    visit(i, new Set());
  }
  if (!i.next && !i.stage && !children(i, all).length) throw new Error(i.file + ": omitted stage requires children");
  if (!i.next && i.archived && i.stage !== "done") throw new Error(i.file + ": archive requires stage done");
}
const scoped = [...all.values()].filter(within(arg, all));
const open = scoped.filter(i => !i.archived && !complete(i, all));
const selected = (kind: string) => (kind === "done" ? scoped.filter(i => !i.next && !i.archived && complete(i, all)) : open.filter(i => {
  const m = model(i, all, !!arg);
  if (kind === "frontier") return m.frontier;
  return !i.next && i.stage !== undefined && i.stage !== "done" && (i.assignee === "human" || i.assignee?.startsWith("user:")) && !openBlockers(i, all).length && !i.claimedBy && (!!arg || i.priority !== 4);
})).sort((a, b) => effectivePriority(a, all) - effectivePriority(b, all) || dependents(b.slug, all) - dependents(a.slug, all));
if (arg && !all.has(arg)) throw new Error("no issue " + arg);
if (cmd === "lint") {
  const reports = [];
  for (const issue of scoped.filter(i => !i.archived)) {
    const report = await refresh(issue, all, dir);
    reports.push(report);
    if (!json) console.log(format(report, true));
  }
  if (json) console.log(JSON.stringify({ advisory: true, reports }, null, 2));
  if (reports.some(r => r.status === "error")) process.exitCode = 1;
} else if (json || cmd === "snapshot") {
  const rows = ["frontier", "mine", "done"].includes(cmd) ? selected(cmd) : scoped;
  console.log(JSON.stringify({ schemaVersion: 1, issues: rows.filter(i => !i.next).map(i => ({ ...model(i, all, !!arg), ...(["mine", "frontier"].includes(cmd) ? { lint: cached(i, all, dir) } : {}) })), legacy: scoped.filter(i => i.next).map(i => ({ slug: i.slug, next: i.next, archived: i.archived, partOf: i.partOf, blockedBy: i.blockedBy, claimedBy: i.claimedBy, priority: i.priority })) }, null, 2));
  process.exit(0);
}

if (cmd !== "lint") switch (cmd) {
  case "frontier":
  case "mine":
  case "done": {
    selected(cmd).forEach(i => console.log(line(i, all) + (["mine", "frontier"].includes(cmd) ? "\n  " + format(cached(i, all, dir)) : "")));
    const legacy = scoped.filter(i => i.next && !i.archived);
    if (legacy.length) console.log("Legacy (read/check only; no lifecycle frontier):\n" + legacy.map(i => line(i, all)).join("\n"));
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
      if (!i.archived && i.partOf && all.get(i.partOf)?.archived) say(`${i.slug}: live issue has archived parent ${i.partOf}`);
      for (const b of i.blockedBy) {
        if (!all.has(b)) say(`${i.slug}: blocked-by ${b} does not exist`);
        else if (complete(all.get(b)!, all)) say(`${i.slug}: blocked-by ${b} is done; remove it`);
      }
      if (i.next === "done" && !i.archived) say(`${i.slug}: done but not in archive/`);
      if (i.next && i.next !== "done" && i.archived) say(`${i.slug}: in archive/ but ${i.next}`);
      if (i.next && !KINDS.includes(i.next)) say(`${i.slug}: next is ${i.next}; one of ${KINDS.join(" ")}`);
      if (claimLive(i) === false) say(`${i.slug}: claimed by ${i.claimedBy} without a worktree; verify ownership before clearing`);
    }
    checkLinks(dirname(dir), say, (s) => console.log("fixed " + s));
    if (!bad) console.log("ok");
    else process.exitCode = 1;
    break;
  }
  case "outline": {
    const root = basename(dir) === "issues" && basename(dirname(dir)) === "docs" ? dirname(dirname(dir)) : dirname(dir);
    const note = outlineNote(root);
    if (!note) throw new Error("no vault note has directory: " + root);
    console.log(outline(note, all).join("\n"));
    break;
  }
  default:
    console.log("usage: issues frontier [slug] | mine [slug] | tree [slug] | done [slug] | snapshot [slug] | lint [slug] | check | outline [--json]");
    process.exitCode = 2;
}
