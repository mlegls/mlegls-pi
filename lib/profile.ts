// Profile pi sessions for wall time and cost: where a session (and the workers it spawned) spent
// its clock and its money. Feeds the retro profile pass; see skills/enabled/profile.
//   bun lib/profile.ts                      this session ($PI_SESSION_ID) and its descendants
//   bun lib/profile.ts SESSION [--json]     a session id (or unique fragment) and its descendants
//   bun lib/profile.ts --project P --last N one line per recent root session in a project
//
// Timing comes from the session log: an assistant entry's message.timestamp is when the request
// started and its entry timestamp when the reply finished; a toolResult's entry timestamp is when the
// tool finished. Gaps before a user message are waiting on the user, gaps before a board message are
// waiting on workers/peers. codemode's nestedCalls carry per-call durations.
import { readFileSync } from "node:fs";
import { graph, type Node } from "./tree/graph";
import { GENERATED } from "./prompts";

export interface Profile {
	id: string; title: string; agent?: string; model?: string;
	start: number; end: number;
	/** ms: model generation, tool execution, waiting on the user, waiting on board (workers/peers), other harness gaps. */
	time: { model: number; tool: number; user: number; board: number; other: number };
	cost: number; costByModel: Record<string, number>;
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextPeak: number; compactions: number; turns: number;
	/** Human-authored turns (skill bodies stripped; generated preambles and spawned sessions' prompts count as generated) and their words. */
	user: { turns: number; words: number; generated: number };
	tools: Record<string, { n: number; ms: number; errors: number }>;
	/** Inner calls keyed by tool, or "bash: <first word>". */
	inner: Record<string, { n: number; ms: number }>;
	children: Profile[];
}

const ts = (s: unknown) => typeof s === "number" ? s : Date.parse(String(s));
const textOf = (c: unknown): string => typeof c === "string" ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === "text").map((x: any) => x.text).join("\n") : "";
const add = (m: Record<string, { n: number; ms: number }>, k: string, ms: number) => { const e = (m[k] ??= { n: 0, ms: 0 }); e.n++; e.ms += ms; };
/** Inner call key: the tool, or for bash its command and (when it looks like one) subcommand, after a leading cd. */
const innerKey = (c: any) => {
	if (c.name !== "bash") return c.name;
	const w = String(c.arguments?.command ?? "").trim().replace(/^cd \S+\s*(&&|;)\s*/, "").split(/\s+/);
	return "bash: " + w[0] + (w[1] && /^[a-z][\w-]*$/.test(w[1]) ? " " + w[1] : "");
};

export function profileFile(file: string, node: Pick<Node, "id" | "title" | "model" | "parentKind">): Omit<Profile, "children"> {
	const p: Omit<Profile, "children"> = {
		id: node.id, title: node.title, model: node.model, start: 0, end: 0,
		time: { model: 0, tool: 0, user: 0, board: 0, other: 0 }, cost: 0, costByModel: {},
		tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextPeak: 0, compactions: 0, turns: 0,
		user: { turns: 0, words: 0, generated: 0 }, tools: {}, inner: {},
	};
	// A spawned or invoked session's user turns are its assignment and steers from its parent, not the human.
	const spawned = node.parentKind === "spawn" || node.parentKind === "invoked";
	let prev = 0; // timestamp of the previous timed entry
	let lastAssistant: any;
	const toolCalls = new Map<string, string>();
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line) continue;
		let e: any; try { e = JSON.parse(line); } catch { continue; }
		const t = ts(e.timestamp);
		if (!Number.isFinite(t)) continue;
		if (!p.start) p.start = t;
		if (e.type === "custom" && e.customType === "session-meta" && e.data?.agent) p.agent = e.data.agent;
		if (e.type === "compaction") p.compactions++;
		const cost = (u: any, model: string) => {
			const c = u?.cost?.total ?? 0; p.cost += c; p.costByModel[model] = (p.costByModel[model] ?? 0) + c;
			for (const k of ["input", "output", "cacheRead", "cacheWrite"] as const) p.tokens[k] += u?.[k] ?? 0;
		};
		if (e.type === "usage") cost(e.usage, (e.kind ?? "usage") + ":" + e.model);
		if (e.type === "custom_message" && e.customType === "board" && prev) { p.time.board += t - prev; prev = t; }
		if (e.type !== "message") continue;
		const m = e.message;
		if (m.role === "user") {
			if (prev) p.time.user += Math.max(0, t - prev);
			const text = textOf(m.content).replace(/<skill[\s\S]*?<\/skill>/g, "").trim();
			if (spawned || !text || GENERATED.test(text)) p.user.generated++; else { p.user.turns++; p.user.words += text.split(/\s+/).filter(Boolean).length; }
			prev = t;
		} else if (m.role === "assistant") {
			const start = ts(m.timestamp);
			if (prev && Number.isFinite(start)) p.time.other += Math.max(0, start - prev);
			p.time.model += Math.max(0, t - (Number.isFinite(start) ? start : prev || t));
			p.turns++;
			cost(m.usage, m.model ?? "?");
			const u = m.usage ?? {};
			p.contextPeak = Math.max(p.contextPeak, (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0));
			for (const c of Array.isArray(m.content) ? m.content : []) if (c?.type === "toolCall") toolCalls.set(c.id, c.name);
			lastAssistant = m; prev = t;
		} else if (m.role === "toolResult") {
			const name = m.toolName ?? toolCalls.get(m.toolCallId) ?? "?";
			const ms = prev ? Math.max(0, t - prev) : 0;
			const r = (p.tools[name] ??= { n: 0, ms: 0, errors: 0 });
			r.n++; r.ms += ms; if (m.isError) r.errors++;
			p.time.tool += ms;
			const nested = m.nestedCalls?.calls ?? m.details?.calls;
			if (Array.isArray(nested)) for (const c of nested) add(p.inner, innerKey({ ...c, arguments: c.arguments ?? safe(c.args) }), c.durationMs ?? 0);
			else add(p.inner, name === "bash" ? innerKey({ name, arguments: findArgs(lastAssistant, m.toolCallId) }) : name, ms);
			prev = t;
		} else if (prev) { p.time.other += Math.max(0, t - prev); prev = t; }
		p.end = Math.max(p.end, t);
	}
	return p;
}
const safe = (s: unknown) => { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return {}; } };
const findArgs = (a: any, id: string) => (Array.isArray(a?.content) ? a.content : []).find((c: any) => c?.id === id)?.arguments;

export async function profile(ref?: string, days = 30): Promise<Profile> {
	const nodes = await graph({ days });
	const ref2 = (ref ?? process.env.PI_SESSION_ID ?? "").replace(/^(session|mail)\//, "");
	const hits = ref2 ? [...nodes.keys()].filter(k => k === ref2 || k.endsWith(ref2) || k.startsWith(ref2)) : [];
	if (hits.length !== 1) throw new Error((hits.length ? "ambiguous: " : "no session matches ") + (ref ?? "$PI_SESSION_ID") + (days < 365 ? " (within --days " + days + ")" : ""));
	const id = hits[0]!;
	if (!id) throw new Error("no session matches " + (ref ?? "$PI_SESSION_ID"));
	const build = (n: Node): Profile => ({ ...profileFile(n.file, n), children: n.children.map(c => nodes.get(c)!).filter(Boolean).map(build) });
	return build(nodes.get(id)!);
}

// ---- rendering
const dur = (ms: number) => ms < 60e3 ? (ms / 1e3).toFixed(0) + "s" : ms < 3600e3 ? (ms / 60e3).toFixed(1) + "m" : (ms / 3600e3).toFixed(1) + "h";
const usd = (c: number) => "$" + c.toFixed(c < 1 ? 3 : 2);
const k = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : String(n);
const flat = (p: Profile): Profile[] => [p, ...p.children.flatMap(flat)];
const top = (r: Record<string, { n: number; ms: number }>, n = 8) => Object.entries(r).sort((a, b) => b[1].ms - a[1].ms).slice(0, n)
	.map(([k, v]) => k + " " + dur(v.ms) + "/" + v.n).join(", ");
const merge = <T extends { n: number; ms: number }>(rs: Record<string, T>[]) => { const o: Record<string, { n: number; ms: number }> = {}; for (const r of rs) for (const [k, v] of Object.entries(r)) { const e = (o[k] ??= { n: 0, ms: 0 }); e.n += v.n; e.ms += v.ms; } return o; };

const sum = (p: Profile): number => p.cost + p.children.reduce((s, c) => s + sum(c), 0);
const TOP = 12;

export function render(root: Profile): string {
	const all = flat(root);
	const span = Math.max(...all.map(p => p.end)) - root.start;
	const active = all.reduce((s, p) => s + p.time.model + p.time.tool, 0);
	const cost = all.reduce((s, p) => s + p.cost, 0);
	const byModel: Record<string, number> = {};
	for (const p of all) for (const [m, c] of Object.entries(p.costByModel)) byModel[m] = (byModel[m] ?? 0) + c;
	const out = [
		"tree: " + all.length + " sessions, span " + dur(span) + ", active " + dur(active) + " (concurrency " + (active / Math.max(1, span)).toFixed(2) + "), " + usd(cost),
		"cost by model: " + Object.entries(byModel).sort((a, b) => b[1] - a[1]).map(([m, c]) => m + " " + usd(c)).join(", "),
		"tools: " + top(merge(all.map(p => p.tools)), 6),
		"inner: " + top(merge(all.map(p => p.inner)), 12),
		"by agent: " + Object.entries(all.slice(1).reduce((o, p) => { const a = p.agent ?? "?", e = (o[a] ??= { n: 0, ms: 0, cost: 0 }); e.n++; e.ms += p.time.model + p.time.tool; e.cost += p.cost; return o; }, {} as Record<string, { n: number; ms: number; cost: number }>))
			.sort((a, b) => b[1].cost - a[1].cost).map(([a, v]) => a + " " + v.n + "× " + dur(v.ms) + " " + usd(v.cost)).join(", "),
		"",
	];
	const line = (p: Profile, depth: number) => {
		const t = p.time;
		out.push("  ".repeat(depth) + "- " + p.id.slice(-8) + " " + (p.agent ? "[" + p.agent + "] " : "") + p.title.slice(0, 60).replace(/\n/g, " "));
		out.push("  ".repeat(depth) + "  " + dur(p.end - p.start) + " = model " + dur(t.model) + " + tool " + dur(t.tool) + " + user " + dur(t.user) + " + board " + dur(t.board) + " + other " + dur(t.other)
			+ " | " + usd(p.cost) + " " + p.turns + " turns, ctx peak " + k(p.contextPeak) + ", cache read " + k(p.tokens.cacheRead) + ", out " + k(p.tokens.output)
			+ (p.compactions ? ", " + p.compactions + " compactions" : "") + " | user " + p.user.turns + " turns/" + p.user.words + "w");
		// Children by cost; the long tail collapses to one line.
		const kids = [...p.children].sort((a, b) => sum(b) - sum(a));
		for (const c of kids.slice(0, TOP)) line(c, depth + 1);
		const rest = kids.slice(TOP);
		if (rest.length) out.push("  ".repeat(depth + 1) + "- … " + rest.length + " more, " + usd(rest.reduce((s, c) => s + sum(c), 0)));
	};
	line(root, 0);
	return out.join("\n");
}

export async function recent(project: string, last = 10, days = 14): Promise<Profile[]> {
	const nodes = await graph({ days });
	const roots = [...nodes.values()].filter(n => !n.parent && n.project.toLowerCase().includes(project.toLowerCase()))
		.sort((a, b) => b.created.localeCompare(a.created)).slice(0, last);
	const build = (n: Node): Profile => ({ ...profileFile(n.file, n), children: n.children.map(c => nodes.get(c)!).filter(Boolean).map(build) });
	return roots.map(build);
}

export function renderRecent(ps: Profile[]): string {
	return ps.map(r => {
		const all = flat(r), cost = all.reduce((s, p) => s + p.cost, 0), span = Math.max(...all.map(p => p.end)) - r.start;
		const active = all.reduce((s, p) => s + p.time.model + p.time.tool, 0), user = all.reduce((s, p) => s + p.user.turns, 0);
		return new Date(r.start).toISOString().slice(0, 16) + " " + r.id.slice(-8) + " " + usd(cost).padStart(7) + " span " + dur(span).padStart(5) + " active " + dur(active).padStart(5)
			+ " " + all.length + "s " + user + "u  " + r.title.slice(0, 60).replace(/\n/g, " ");
	}).join("\n");
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	const flag = (f: string) => { const i = args.indexOf(f); return i < 0 ? undefined : args.splice(i, 2)[1]; };
	const json = args.includes("--json"); if (json) args.splice(args.indexOf("--json"), 1);
	const project = flag("--project"), last = flag("--last"), days = flag("--days");
	if (project) {
		const ps = await recent(project, Number(last ?? 10), Number(days ?? 14));
		console.log(json ? JSON.stringify(ps) : renderRecent(ps));
	} else {
		const p = await profile(args[0], Number(days ?? 30));
		console.log(json ? JSON.stringify(p) : render(p));
	}
}
