// Recursive readiness over issue frontmatter, vault-wide. Pure: input is {path, frontmatter} per note.
// Semantics follow the tracker skill's references/lifecycle.md; the CLI (issues.ts) computes the same
// per project and lib/tracker-views.test.ts keeps them in agreement.

export const STAGES = ["idea", "goal", "spec", "ticket", "done"] as const;
export type Stage = (typeof STAGES)[number];

export type Note = { path: string; frontmatter?: Record<string, unknown> | null };

export type Issue = {
  id: string; slug: string; project: string; legacy: boolean; archived: boolean;
  ownStage: unknown; assignee: unknown; priority?: number; priority_: number;
  next: unknown; partOf: string | null; blockedBy: string[]; claimedBy: unknown;
  assignment: Assignment; children: Issue[]; errors: string[]; fm: Record<string, unknown>;
  effectiveStage: string; subtreeDone: boolean; ownReady: boolean; subtreeReady: boolean;
  openBlockers: string[]; internalDependencies: string[]; claims: Issue[]; dependencyCycle: boolean;
  agentEligible: boolean; deferred: boolean; actor: "me" | "agent" | "nobody"; unblocksAll: number;
};

export type Assignment = { valid: boolean; agent: boolean; human: boolean };

export type Model = {
  issues: Map<string, Issue>; open: Issue[]; roots: Issue[]; frontier: Issue[]; mine: Issue[];
  done: Issue[]; legacy: Issue[]; invalid: Issue[]; projects: string[];
};

export function refPath(v: unknown): string | null {
  if (v == null) return null;
  const raw = typeof v === "string" ? v.replace(/^\[\[|\]\]$/g, "").split("|")[0] : (v as { path?: string }).path;
  return raw ? raw.replace(/\.md$/, "") : null;
}
const list = (v: unknown): unknown[] => v == null ? [] : Array.isArray(v) ? v : [v];

export function assignment(value: unknown): Assignment {
  if (value === undefined) return { valid: true, agent: false, human: false };
  if (typeof value !== "string") return { valid: false, agent: false, human: false };
  const parts = value.split(",").map((s) => s.trim());
  const stance = /^agent:[a-z][a-z0-9-]*$/;
  const model = /^model:[^\s,:/]+\/[^\s,:]+:([a-z]+)$/;
  if (parts.length === 2) return { valid: (stance.test(parts[0]) && model.test(parts[1])) || (model.test(parts[0]) && stance.test(parts[1])), agent: true, human: false };
  if (parts.length !== 1) return { valid: false, agent: false, human: false };
  const s = parts[0];
  if (s !== value) return { valid: false, agent: false, human: false };
  const human = s === "human" || /^user:[^\s,]+$/.test(s);
  return { valid: human || s === "agent" || /^session:[^\s,]+$/.test(s) || stance.test(s) || model.test(s), human, agent: s === "agent" || stance.test(s) || model.test(s) };
}

// Legacy activity records never acquire readiness from an activity label.
export function model(notes: Note[], { includeDeferred = false } = {}): Model {
  const issues = new Map<string, Issue>();
  for (const n of notes) {
    const id = n.path.replace(/\.md$/, "");
    const m = id.match(/^projects\/([^/]+)\/issues\/(?:archive\/)?([^/]+)$/);
    if (!m || m[2] === "index") continue;
    const fm = n.frontmatter ?? {};
    const legacy = fm.next !== undefined || fm.status !== undefined;
    const priority = fm.priority;
    const validPriority = typeof priority === "number" && [1, 2, 3, 4].includes(priority);
    issues.set(id, {
      id, slug: m[2], project: m[1], legacy, ownStage: fm.stage, assignee: fm.assignee,
      archived: id.includes("/issues/archive/"), next: fm.next ?? fm.status,
      partOf: refPath(fm["part-of"] ?? fm.parent),
      blockedBy: list(fm["blocked-by"] ?? fm.blockedBy).map(refPath).filter((x): x is string => !!x),
      claimedBy: fm["claimed-by"],
      priority: validPriority ? priority : undefined,
      priority_: validPriority ? priority : 2.5,
      assignment: assignment(fm.assignee), children: [], errors: [], fm,
      effectiveStage: "invalid", subtreeDone: false, ownReady: false, subtreeReady: false,
      openBlockers: [], internalDependencies: [], claims: [], dependencyCycle: false,
      agentEligible: false, deferred: false, actor: "nobody", unblocksAll: 0,
    });
  }
  for (const i of issues.values()) if (i.partOf && issues.has(i.partOf)) issues.get(i.partOf)!.children.push(i);
  const evaluated = new Set<string>();
  function evaluate(i: Issue, visiting = new Set<string>()) {
    if (evaluated.has(i.id)) return;
    if (visiting.has(i.id)) { i.errors.push("parent cycle"); return; }
    const path = new Set(visiting).add(i.id);
    for (const c of i.children) evaluate(c, path);
    if (i.legacy && i.ownStage !== undefined) i.errors.push("legacy next cannot mix with stage");
    if (i.fm.priority !== undefined && !(typeof i.fm.priority === "number" && [1, 2, 3, 4].includes(i.fm.priority))) i.errors.push("invalid priority");
    if (i.archived) {
      if (!i.legacy && i.ownStage !== "done") i.errors.push("archive requires own stage done");
      i.subtreeDone = !i.errors.length; i.effectiveStage = i.errors.length ? "invalid" : "done";
      i.ownReady = false; i.subtreeReady = false; evaluated.add(i.id); return;
    }
    if (i.legacy) { i.subtreeDone = false; i.effectiveStage = "legacy"; evaluated.add(i.id); return; }
    if (i.ownStage !== undefined && !(STAGES as readonly unknown[]).includes(i.ownStage)) i.errors.push("invalid stage (null is not omission)");
    if (i.ownStage === undefined && !i.children.length) i.errors.push("stage omitted on leaf");
    if (!i.assignment.valid) i.errors.push("invalid assignee");
    if (i.partOf && issues.get(i.partOf)?.archived) i.errors.push("live issue has archived parent");
    if (i.partOf && !issues.has(i.partOf)) i.errors.push("parent is not an issue (indexes are links)");
    const ranks = [i.ownStage === undefined ? 4 : STAGES.indexOf(i.ownStage as Stage), ...i.children.map((c) => STAGES.indexOf(c.effectiveStage as Stage))];
    i.effectiveStage = i.errors.length || ranks.some((r) => r < 0) ? "invalid" : STAGES[Math.min(...ranks)];
    i.subtreeDone = i.effectiveStage === "done";
    i.ownReady = i.ownStage === "spec" || i.ownStage === "ticket";
    i.subtreeReady = i.effectiveStage === "spec" || i.effectiveStage === "ticket";
    evaluated.add(i.id);
  }
  for (const i of issues.values()) evaluate(i);
  function descendants(i: Issue, seen = new Set<string>()): Issue[] {
    if (seen.has(i.id)) return [];
    seen.add(i.id);
    return [i, ...i.children.filter((c) => !c.archived).flatMap((c) => descendants(c, seen))];
  }
  for (const i of issues.values()) {
    const tree = descendants(i);
    const ids = new Set(tree.map((n) => n.id));
    const remaining = tree.filter((n) => !n.subtreeDone);
    i.openBlockers = [...new Set(remaining.flatMap((n) => n.blockedBy).filter((id) => !ids.has(id) && !issues.get(id)?.subtreeDone))];
    i.internalDependencies = remaining.flatMap((n) => n.blockedBy.filter((id) => ids.has(id) && !issues.get(id)?.subtreeDone).map((id) => `${n.slug} after ${issues.get(id)!.slug}`));
    i.claims = tree.filter((n) => !n.archived).filter((n) => n.claimedBy !== undefined && n.claimedBy !== null && n.claimedBy !== "");
    const visiting = new Set<string>(), visited = new Set<string>();
    const cycle = (n: Issue): boolean => {
      if (visiting.has(n.id)) return true;
      if (visited.has(n.id) || n.subtreeDone) return false;
      visiting.add(n.id);
      for (const id of [...n.blockedBy, ...n.children.filter((c) => !c.archived).map((c) => c.id)]) if (ids.has(id) && cycle(issues.get(id)!)) return true;
      visiting.delete(n.id); visited.add(n.id); return false;
    };
    i.dependencyCycle = !i.legacy && !i.archived && remaining.some((n) => cycle(n));
    if (i.dependencyCycle) i.errors.push("dependency cycle in subtree");
    i.agentEligible = !i.dependencyCycle && !i.archived && !i.legacy && i.subtreeReady && remaining.filter((n) => n.ownStage !== undefined && n.ownStage !== "done").every((n) => n.assignment.valid && n.assignment.agent) && !i.openBlockers.length && !i.claims.length;
    i.deferred = remaining.some((n) => n.priority === 4);
    i.actor = i.legacy ? "nobody" : i.assignment.human ? "me" : i.agentEligible ? "agent" : "nobody";
    i.children.sort((a, b) => a.slug.localeCompare(b.slug));
  }
  for (const i of issues.values()) if (!i.subtreeDone) for (const b of i.blockedBy) { const t = issues.get(b); if (t) t.unblocksAll++; }
  const byPriority = (a: Issue, b: Issue) => a.priority_ - b.priority_ || a.slug.localeCompare(b.slug);
  const all = [...issues.values()].sort(byPriority);
  const open = all.filter((i) => !i.legacy && !i.subtreeDone);
  return { issues, open,
    roots: all.filter((i) => !i.partOf || !issues.has(i.partOf)),
    frontier: open.filter((i) => i.agentEligible && (includeDeferred || !i.deferred)),
    mine: open.filter((i) => i.ownStage !== undefined && i.ownStage !== "done" && i.assignment.valid && i.assignment.human && !i.errors.length && !i.claimedBy && (includeDeferred || i.priority !== 4) && i.blockedBy.every((id) => issues.get(id)?.subtreeDone)),
    done: all.filter((i) => !i.legacy && i.subtreeDone && !i.archived),
    legacy: all.filter((i) => i.legacy),
    invalid: all.filter((i) => i.errors.length),
    projects: [...new Set(all.map((i) => i.project))].sort(),
  };
}
