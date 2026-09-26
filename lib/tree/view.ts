// Session rows shared by CLI and TUI.
//   tree      project headers, parentage, sibling subtrees sorted by urgency
//   projects  project headers, sessions by recency
//   status    state headers (needs you first), sessions by recency
// Filter terms: `key:value` (state, project, model, kind, orphan) or free text matched as a
// subsequence of the title/project/cwd, like fzf. A matching node keeps its ancestors in tree.

import type { Node, State } from "./graph";

export type Mode = "tree" | "projects" | "status";
export interface Row { kind: "header" | "node"; depth: number; label: string; node?: Node; count?: number; match?: boolean; urgency?: string; needs?: number }

const ACTIVE: State[] = ["working", "idle"];
export const STATE_ORDER: State[] = ["working", "idle", "resumable", "gone"];

export function attention(n: Node): "needs" | "blocked" | "done" | undefined {
	if (n.report?.tag === "needs-input" || n.report?.tag === "checkpoint") return "needs";
	if (n.report?.tag === "blocked") return "blocked";
	if (n.report?.tag === "done" && ACTIVE.includes(n.state)) return "done";
	return undefined;
}

function subsequence(needle: string, hay: string): boolean {
	let i = 0;
	for (const c of hay) if (c === needle[i]) i++;
	return i === needle.length;
}

export function matcher(query: string): (n: Node) => boolean {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	return (n: Node) => terms.every(term => {
		const neg = term.startsWith("!");
		const t = neg ? term.slice(1) : term;
		const colon = t.indexOf(":");
		let ok: boolean;
		if (colon > 0) {
			const key = t.slice(0, colon), value = t.slice(colon + 1);
			const field = key === "state" ? n.state + " " + (attention(n) ?? "") + (n.orphan ? " orphan" : "")
				: key === "project" ? n.project : key === "model" ? n.model ?? "" : key === "kind" ? n.parentKind ?? "root"
				: key === "orphan" ? String(!!n.orphan) : key === "run" ? n.run ?? "" : "";
			ok = field.toLowerCase().includes(value);
		} else ok = subsequence(t, (n.title + " " + n.project + " " + n.cwd).toLowerCase());
		return neg ? !ok : ok;
	});
}

const recent = (a: Node, b: Node) => b.updated.localeCompare(a.updated);

/** Attention order for a session and its descendants. */
export function priority(n: Node): string {
	return attention(n) === "needs" ? "needs you" : attention(n) === "blocked" ? "blocked" : n.orphan ? "orphan" : n.state;
}
/** Nodes worth showing without a filter: active ones, plus sessions ended in the last `hours`. */
export function visible(nodes: Map<string, Node>, opts: { all?: boolean; hours?: number } = {}): Set<string> {
	const cutoff = new Date(Date.now() - (opts.hours ?? 12) * 3_600_000).toISOString();
	const out = new Set<string>();
	for (const n of nodes.values()) {
		if (opts.all || ACTIVE.includes(n.state) || (n.state === "resumable" && n.updated >= cutoff)) out.add(n.id);
	}
	return out;
}

export function rows(nodes: Map<string, Node>, mode: Mode, opts: { query?: string; all?: boolean; hours?: number; collapsed?: Set<string> } = {}): Row[] {
	const match = opts.query ? matcher(opts.query) : undefined;
	const shown = match ? new Set([...nodes.values()].filter(match).map(n => n.id)) : visible(nodes, opts);
	const hits = new Set(shown);
	const collapsed = opts.collapsed ?? new Set<string>();
	const out: Row[] = [];

	if (mode === "tree") {
		// Keep same-project ancestors; cross-project children start a new project tree.
		for (const id of [...shown]) {
			let n = nodes.get(id)!;
			while (n.parent && nodes.get(n.parent)?.project === n.project && !shown.has(n.parent)) {
				shown.add(n.parent);
				n = nodes.get(n.parent)!;
			}
		}
		const children = (n: Node) => n.children.map(id => nodes.get(id)!).filter(c => shown.has(c.id) && c.project === n.project);
		type Summary = { urgency: string; needs: number; count: number; updated: string };
		const summaries = new Map<string, Summary>();
		const summary = (n: Node): Summary => {
			const cached = summaries.get(n.id);
			if (cached) return cached;
			const own = priority(n);
			const descendants = children(n).map(summary);
			const result = {
				urgency: [own, ...descendants.map(s => s.urgency)].sort((a, b) => rank(a) - rank(b))[0]!,
				needs: Number(own === "needs you") + descendants.reduce((sum, s) => sum + s.needs, 0),
				count: 1 + descendants.reduce((sum, s) => sum + s.count, 0),
				updated: [n.updated, ...descendants.map(s => s.updated)].sort().pop()!,
			};
			summaries.set(n.id, result);
			return result;
		};
		const compare = (a: Node, b: Node) => rank(summary(a).urgency) - rank(summary(b).urgency)
			|| summary(b).updated.localeCompare(summary(a).updated) || a.id.localeCompare(b.id);
		const roots = [...shown].map(id => nodes.get(id)!).filter(n => !n.parent || !shown.has(n.parent) || nodes.get(n.parent)?.project !== n.project);
		const byProject = group(roots, n => n.project);
		const projects = [...byProject].sort(([, a], [, b]) => compare(a.sort(compare)[0]!, b.sort(compare)[0]!));
		for (const [project, list] of projects) {
			const stats = list.map(summary);
			out.push({ kind: "header", depth: 0, label: project,
				count: stats.reduce((sum, s) => sum + s.count, 0),
				needs: stats.reduce((sum, s) => sum + s.needs, 0), urgency: summary(list[0]!).urgency });
			if (collapsed.has("tree:project:" + project)) continue;
			const walk = (n: Node, depth: number) => {
				out.push({ kind: "node", depth, label: n.title, node: n, match: hits.has(n.id), ...summary(n) });
				if (collapsed.has("tree:session:" + n.id)) return;
				for (const c of children(n).sort(compare)) walk(c, depth + 1);
			};
			for (const n of list) walk(n, 1);
		}
		return out;
	}
	const list = [...shown].map(id => nodes.get(id)!);
	const groups = mode === "projects" ? group(list, n => n.project)
		: new Map([...group(list, n => attention(n) === "needs" ? "needs you" : n.orphan ? "orphan" : n.state)]
			.sort(([a], [b]) => rank(a) - rank(b)));
	for (const [label, members] of groups) {
		out.push({ kind: "header", depth: 0, label, count: members.length });
		if (collapsed.has((mode === "projects" ? "project:" : "status:") + label)) continue;
		for (const n of members.sort(recent)) out.push({ kind: "node", depth: 1, label: n.title, node: n, match: true });
	}
	return out;
}

function rank(label: string): number {
	const order = ["needs you", "blocked", "orphan", ...STATE_ORDER];
	const i = order.indexOf(label);
	return i < 0 ? order.length : i;
}

/** Groups in order of their most recently updated member. */
function group(list: Node[], key: (n: Node) => string): Map<string, Node[]> {
	const m = new Map<string, Node[]>();
	for (const n of [...list].sort(recent)) {
		const k = key(n);
		if (!m.has(k)) m.set(k, []);
		m.get(k)!.push(n);
	}
	return m;
}

export function age(iso: string): string {
	const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
	return s < 60 ? Math.floor(s) + "s" : s < 3600 ? Math.floor(s / 60) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d";
}

export const ICON: Record<State, string> = { working: "●", idle: "○", resumable: "·", gone: "×" };

/** Plain-text line for a row, for the CLI and for tests. */
export function line(r: Row): string {
	if (r.kind === "header") return `${r.label} (${r.count})`;
	const n = r.node!;
	const flag = attention(n) === "needs" ? " !" : attention(n) === "blocked" ? " ⊘" : n.orphan ? " orphan" : "";
	const model = n.model ? " " + n.model.split("/").pop() : "";
	return "  ".repeat(r.depth) + `${ICON[n.state]} ${n.title.replace(/\s+/g, " ").slice(0, 70)}${flag}  ${age(n.updated)}${model}`;
}
