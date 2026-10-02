// Profile pi sessions for wall time and cost: where a session (and the workers it spawned) spent
// its clock and its money. Feeds the retro profile pass; see skills/enabled/profile.
//   bun lib/profile.ts                      this session ($PI_SESSION_ID) and its descendants
//   bun lib/profile.ts SESSION [--json] [--fast]  a session id (or unique fragment) and its descendants
//   bun lib/profile.ts --project P --last N one line per recent root session in a project
//
// Timing comes from the session log: an assistant entry's message.timestamp is when the request
// started and its entry timestamp when the reply finished; a toolResult's entry timestamp is when the
// tool finished. codemode's nestedCalls carry per-call durations.
//
// Gaps are classified by what preceded them. Before a user message: "stall" if the last reply ended in
// an error; else the reply's ask: "blocked" (work can't go on without you: a question, decision,
// approval), "offered" (done, with optional next steps) or "idle" (done). The decider (judgeWaits, Jev via lib/decide.ts) judges this,
// cached in ~/.cache/profile/waits.json; --fast, or no classifier, falls back to a regex. A spawned session's user messages come from its parent ("parent").
// Before a board message: "board" (waiting on workers/peers). Whether you were away or busy elsewhere
// during a "blocked" gap is a property of your global timeline (humanTurns), not of the session.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { graph, type Node } from "./tree/graph";
import { GENERATED } from "./prompts";

export interface Profile {
	id: string; title: string; agent?: string; model?: string;
	start: number; end: number;
	time: Record<Kind, number>;
	segments: Segment[];
	/** How the session's last reply left things: the kind its trailing gap would have. */
	ended?: { k: Kind; note: string; judge?: Judge };
	cost: number; costByModel: Record<string, number>;
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextPeak: number; compactions: number; turns: number;
	/** Human-authored turns (skill bodies stripped; generated preambles and spawned sessions' prompts count as generated) and their words. */
	user: { turns: number; words: number; generated: number };
	tools: Record<string, { n: number; ms: number; errors: number }>;
	/** Inner calls keyed by tool, or "bash: <first word>". */
	inner: Record<string, { n: number; ms: number }>;
	/** Waiting, keyed by what was waited on: "process: <command> [until <pattern>]" (process waits and wakes),
	 * "sleep → <what followed>" (bash sleeps, the pre-process idiom), "board". */
	waits: Record<string, { n: number; ms: number }>;
	children: Profile[];
}

export type Kind = "model" | "tool" | "blocked" | "offered" | "idle" | "stall" | "parent" | "board" | "process" | "other";
export interface Segment { k: Kind; s: number; e: number; note?: string; judge?: Judge }
/** A wait after a reply, for the decider: the reply's tail and a stable cache key (session/entry). */
interface Judge { key: string; reply: string }
const KINDS: Kind[] = ["model", "tool", "blocked", "offered", "idle", "stall", "parent", "board", "process", "other"];
/** A reply that leaves something pending on the human: the fallback when no classifier is available (judgeWaits). */
const ASKS = /\?\s*$|\?\s*\n|\b(blocked|needs-input|needs input|waiting (on|for) (you|your)|your (call|decision|go-ahead)|want me to|should i|shall i|let me know|which (one|do you))\b/i;

const ts = (s: unknown) => typeof s === "number" ? s : Date.parse(String(s));
const textOf = (c: unknown): string => typeof c === "string" ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === "text").map((x: any) => x.text).join("\n") : "";
const add = (m: Record<string, { n: number; ms: number }>, k: string, ms: number) => { const e = (m[k] ??= { n: 0, ms: 0 }); e.n++; e.ms += ms; };
/** Inner call key: the tool, or for bash its command and (when it looks like one) subcommand, after a leading cd. */
const innerKey = (c: any) => {
	if (c.name === "process") return "process " + (c.arguments?.action ?? "?");
	if (c.name !== "bash") return c.name;
	const w = String(c.arguments?.command ?? "").trim().replace(/^cd \S+\s*(&&|;)\s*/, "").split(/\s+/);
	return "bash: " + w[0] + (w[1] && /^[a-z][\w-]*$/.test(w[1]) ? " " + w[1] : "");
};

export function profileFile(file: string, node: Pick<Node, "id" | "title" | "model" | "parentKind">): Omit<Profile, "children"> {
	const p: Omit<Profile, "children"> = {
		id: node.id, title: node.title.replace(/^<skill name="([^"]+)"[\s\S]*/, "/$1"), model: node.model, start: 0, end: 0,
		time: Object.fromEntries(KINDS.map(k => [k, 0])) as Record<Kind, number>, segments: [], cost: 0, costByModel: {},
		tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextPeak: 0, compactions: 0, turns: 0,
		user: { turns: 0, words: 0, generated: 0 }, tools: {}, inner: {}, waits: {},
	};
	// A spawned or invoked session's user turns are its assignment and steers from its parent, not the human.
	const spawned = node.parentKind === "spawn" || node.parentKind === "invoked";
	let prev = 0; // timestamp of the previous timed entry
	let born = 0; // the session header's time: a fork copies its parent's earlier entries, which aren't this session's
	let lastAssistant: any, lastAssistantId = "";
	const seg = (k: Kind, a: number, b: number, note?: string) => {
		if (!a || b <= a) return;
		p.time[k] += b - a;
		const last = p.segments.at(-1);
		if (last && last.k === k && a - last.e < 1000 && !note) last.e = b; else p.segments.push({ k, s: a, e: b, note });
	};
	const snippet = (m: any) => textOf(m?.content).trim().slice(-240);
	const gapKind = (): Kind => spawned ? "parent" : lastAssistant?.stopReason === "error" ? "stall" : ASKS.test(snippet(lastAssistant)) ? "blocked" : "idle";
	const judged = (k: Kind) => k === "blocked" || k === "offered" || k === "idle";
	const judge = (): Judge | undefined => {
		const reply = textOf(lastAssistant?.content).trim().slice(-1500);
		return !spawned && reply && lastAssistant.stopReason !== "error" ? { key: node.id + "/" + lastAssistantId, reply } : undefined;
	};
	const toolCalls = new Map<string, string>();
	// pi-processes (@mjakl/pi-processes): process ids and names → their command, to say what a wait was for.
	const procs = new Map<string, string>();
	const procOf = (id: unknown) => procs.get(String(id ?? "").toLowerCase()) ?? String(id ?? "?");
	const call = (c: any, ms: number) => {
		const a = c.arguments ?? {};
		if (c.name === "process" && a.action === "start") procs.set(String(a.name ?? "").toLowerCase(), String(a.command ?? "").slice(0, 80));
		if (c.name === "process" && a.action === "wait") add(p.waits, "process: " + procOf(a.id) + (a.until === "output" ? " until " + a.pattern : ""), ms);
		if (c.name === "bash") {
			const cmd = String(a.command ?? "");
			const secs = [...cmd.matchAll(/\bsleep\s+([\d.]+)/g)].reduce((s, m) => s + Number(m[1]), 0);
			const next = cmd.split(/\bsleep\s+[\d.]+\s*(?:;|&&|\n)?\s*/)[1]?.trim().replace(/^cd \S+\s*(&&|;)\s*/, "").split(/\s+/).slice(0, 2).join(" ").slice(0, 40);
			if (secs) add(p.waits, "sleep → " + (next || "(end)"), Math.min(secs * 1000, ms || secs * 1000));
		}
		add(p.inner, innerKey(c), ms);
	};
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line) continue;
		let e: any; try { e = JSON.parse(line); } catch { continue; }
		const t = ts(e.timestamp);
		if (!Number.isFinite(t)) continue;
		if (e.type === "session") born = t;
		if (t < born) continue;
		if (!p.start) p.start = t;
		if (e.type === "custom" && e.customType === "session-meta" && e.data?.agent) p.agent = e.data.agent;
		if (e.type === "compaction") p.compactions++;
		const cost = (u: any, model: string) => {
			const c = u?.cost?.total ?? 0; p.cost += c; p.costByModel[model] = (p.costByModel[model] ?? 0) + c;
			for (const k of ["input", "output", "cacheRead", "cacheWrite"] as const) p.tokens[k] += u?.[k] ?? 0;
		};
		if (e.type === "usage") cost(e.usage, (e.kind ?? "usage") + ":" + e.model);
		if (e.type === "custom_message" && e.customType === "board" && prev) { seg("board", prev, t, textOf(e.content).slice(0, 160)); add(p.waits, "board", t - prev); prev = t; }
		if (e.type === "custom_message" && String(e.customType).startsWith("pi-processes:") && prev) {
			const d = e.details ?? {};
			if (d.processId && d.command) procs.set(String(d.processId).toLowerCase(), String(d.command).slice(0, 80));
			const what = "process: " + (d.command ? String(d.command).slice(0, 80) : procOf(d.processName ?? d.processId)) + (d.pattern ? " until " + d.pattern : "");
			seg("process", prev, t, what); add(p.waits, what, t - prev); prev = t;
		}
		if (e.type !== "message") continue;
		const m = e.message;
		if (m.role === "user") {
			const text = textOf(m.content).replace(/<skill[\s\S]*?<\/skill>/g, "").trim();
			const kind = gapKind();
			if (prev) seg(kind, prev, t, (kind === "stall" ? "error: " + (lastAssistant?.errorMessage ?? "") : snippet(lastAssistant)) + "\n→ " + text.slice(0, 160));
			const last = p.segments.at(-1);
			if (prev && last?.e === t && judged(kind)) last.judge = judge();
			if (spawned || !text || GENERATED.test(text)) p.user.generated++; else { p.user.turns++; p.user.words += text.split(/\s+/).filter(Boolean).length; }
			prev = t;
		} else if (m.role === "assistant") {
			const start = ts(m.timestamp);
			if (prev && Number.isFinite(start)) seg("other", prev, Math.min(start, t));
			seg("model", Number.isFinite(start) ? Math.max(start, prev) : prev, t);
			p.turns++;
			cost(m.usage, m.model ?? "?");
			const u = m.usage ?? {};
			p.contextPeak = Math.max(p.contextPeak, (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0));
			for (const c of Array.isArray(m.content) ? m.content : []) if (c?.type === "toolCall") toolCalls.set(c.id, c.name);
			lastAssistant = m; lastAssistantId = String(e.id ?? t); prev = t;
		} else if (m.role === "toolResult") {
			const name = m.toolName ?? toolCalls.get(m.toolCallId) ?? "?";
			const ms = prev ? Math.max(0, t - prev) : 0;
			const r = (p.tools[name] ??= { n: 0, ms: 0, errors: 0 });
			r.n++; r.ms += ms; if (m.isError) r.errors++;
			seg("tool", prev, t);
			const nested = m.nestedCalls?.calls ?? m.details?.calls;
			if (Array.isArray(nested)) for (const c of nested) call({ ...c, arguments: c.arguments ?? safe(c.args) }, c.durationMs ?? 0);
			else call({ name, arguments: findArgs(lastAssistant, m.toolCallId) ?? {} }, ms);
			prev = t;
		} else if (prev) { seg("other", prev, t); prev = t; }
		p.end = Math.max(p.end, t);
	}
	if (lastAssistant) { const k = gapKind(); p.ended = { k, note: k === "stall" ? "error: " + (lastAssistant.errorMessage ?? "") : snippet(lastAssistant), judge: judged(k) ? judge() : undefined }; }
	return p;
}
const safe = (s: unknown) => { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return {}; } };
const findArgs = (a: any, id: string) => (Array.isArray(a?.content) ? a.content : []).find((c: any) => c?.id === id)?.arguments;

/** Your own turns across every interactive session overlapping [from, to]: one shared timeline, since your attention is global. */
export function humanTurns(nodes: Map<string, Node>, from: number, to: number): { t: number; session: string; text: string }[] {
	const out: { t: number; session: string; text: string }[] = [];
	for (const n of nodes.values()) {
		if (!n.interactive || ts(n.created) > to || ts(n.updated) < from) continue;
		let body: string; try { body = readFileSync(n.file, "utf8"); } catch { continue; }
		for (const line of body.split("\n")) {
			if (!line.includes('"role":"user"')) continue;
			let e: any; try { e = JSON.parse(line); } catch { continue; }
			const t = ts(e.timestamp);
			if (e.type !== "message" || e.message?.role !== "user" || t < from || t > to) continue;
			const text = textOf(e.message.content).replace(/<skill[\s\S]*?<\/skill>/g, "").trim();
			if (text && !GENERATED.test(text)) out.push({ t, session: n.id, text: text.slice(0, 160) });
		}
	}
	return out.sort((a, b) => a.t - b.t);
}

export async function profile(ref?: string, days = 30, options: { judge?: boolean } = {}): Promise<Profile> {
	return (await profileWithGraph(ref, days, options)).profile;
}

const WAIT = {
	type: "choice" as const,
	instructions: "An AI coding agent's turn ended with this reply to its human user, and the agent did nothing more until the user wrote again. What did the reply leave with the user?",
	criteria: {
		blocked: "The agent cannot continue without the user: it asks a question, needs a decision, approval, credentials, or an action only the user can take.",
		offered: "The work is finished or reported; the agent offers optional next steps or asks whether to go on, but nothing is stuck.",
		done: "The work is finished or reported, and nothing is asked of the user.",
	},
};
const WAITS_CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "profile", "waits.json");

/** Reclassify blocked/offered/idle waits with the decider (lib/decide.ts); done → idle.
 * Judgments are cached by session/entry; without a classifier the regex classification stands. */
export async function judgeWaits(all: Profile[]): Promise<void> {
	type J = { choice: string; p: number };
	let cache: Record<string, J> = {};
	try { cache = JSON.parse(readFileSync(WAITS_CACHE, "utf8")); } catch {}
	const items: { p: Profile; s: { k: Kind; s: number; e: number; note?: string; judge?: Judge } }[] = [];
	for (const p of all) {
		for (const s of p.segments) if (s.judge) items.push({ p, s });
		if (p.ended?.judge) items.push({ p, s: { k: p.ended.k, s: 0, e: 0, judge: p.ended.judge, get note() { return p.ended!.note; }, set note(n) { p.ended!.note = n!; } } as any });
	}
	const todo = items.filter(i => !cache[i.s.judge!.key]);
	if (todo.length) {
		let decide: typeof import("./decide").decide;
		try { decide = (await import("./decide")).decide; } catch { return; }
		let failed = 0;
		const queue = [...todo];
		await Promise.all(Array.from({ length: 8 }, async () => {
			for (let i = queue.shift(); i; i = queue.shift()) {
				try { const { wait } = await decide({ reply: i.s.judge!.reply }, { wait: WAIT }); cache[i.s.judge!.key] = { choice: wait.choice, p: wait.p }; }
				catch { failed++; }
			}
		}));
		if (failed === todo.length) return; // no classifier: keep the regex kinds
		mkdirSync(dirname(WAITS_CACHE), { recursive: true });
		writeFileSync(WAITS_CACHE, JSON.stringify(cache));
	}
	for (const { p, s } of items) {
		const j = cache[s.judge!.key];
		if (!j) continue;
		const k: Kind = j.choice === "blocked" ? "blocked" : j.choice === "offered" ? "offered" : "idle";
		s.note = "[" + j.choice + " " + j.p.toFixed(2) + "] " + (s.note ?? "");
		if (s.e > s.s) { p.time[s.k] -= s.e - s.s; p.time[k] += s.e - s.s; s.k = k; }
		else if (p.ended) p.ended.k = k;
	}
}

export async function profileWithGraph(ref?: string, days = 30, options: { judge?: boolean } = {}): Promise<{ profile: Profile; nodes: Map<string, Node> }> {
	const nodes = await graph({ days });
	const ref2 = (ref ?? process.env.PI_SESSION_ID ?? "").replace(/^(session|mail)\//, "");
	const hits = ref2 ? [...nodes.keys()].filter(k => k === ref2 || k.endsWith(ref2) || k.startsWith(ref2)) : [];
	if (hits.length !== 1) throw new Error((hits.length ? "ambiguous: " : "no session matches ") + (ref ?? "$PI_SESSION_ID") + (days < 365 ? " (within --days " + days + ")" : ""));
	const id = hits[0]!;
	if (!id) throw new Error("no session matches " + (ref ?? "$PI_SESSION_ID"));
	const build = (n: Node): Profile => ({ ...profileFile(n.file, n), children: n.children.map(c => nodes.get(c)!).filter(Boolean).map(build) });
	const root = build(nodes.get(id)!);
	// An interactive session's last reply waits until your next turn anywhere: an overnight stall on a
	// question shows up here, since nothing more is written to the session itself.
	const all: Profile[] = []; const walk = (p: Profile) => { all.push(p); p.children.forEach(walk); }; walk(root);
	if (options.judge !== false) await judgeWaits(all);
	for (const p of all) { for (const s of p.segments) delete s.judge; if (p.ended) delete p.ended.judge; }
	const open = all.filter(p => p.ended && nodes.get(p.id)?.interactive);
	if (open.length) {
		const turns = humanTurns(nodes, root.start, Date.now());
		for (const p of open) {
			const next = turns.find(h => h.t > p.end + 1000);
			if (!next || next.session === p.id) continue;
			p.segments.push({ k: p.ended!.k, s: p.end, e: next.t, note: p.ended!.note + "\n→ (no reply here; your next turn was in " + next.session.slice(-8) + ") " + next.text });
			p.time[p.ended!.k] += next.t - p.end;
			p.end = next.t;
		}
	}
	return { profile: root, nodes };
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
		"waits: " + top(merge(all.map(p => p.waits)), 10),
		"by agent: " + Object.entries(all.slice(1).reduce((o, p) => { const a = p.agent ?? "?", e = (o[a] ??= { n: 0, ms: 0, cost: 0 }); e.n++; e.ms += p.time.model + p.time.tool; e.cost += p.cost; return o; }, {} as Record<string, { n: number; ms: number; cost: number }>))
			.sort((a, b) => b[1].cost - a[1].cost).map(([a, v]) => a + " " + v.n + "× " + dur(v.ms) + " " + usd(v.cost)).join(", "),
		"",
	];
	const line = (p: Profile, depth: number) => {
		const t = p.time;
		out.push("  ".repeat(depth) + "- " + p.id.slice(-8) + " " + (p.agent ? "[" + p.agent + "] " : "") + p.title.slice(0, 60).replace(/\n/g, " "));
		out.push("  ".repeat(depth) + "  " + dur(p.end - p.start) + " = " + KINDS.filter(k => t[k] >= 1000).map(k => k + " " + dur(t[k])).join(" + ")
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
	const fast = args.includes("--fast"); if (fast) args.splice(args.indexOf("--fast"), 1);
	const project = flag("--project"), last = flag("--last"), days = flag("--days");
	if (project) {
		const ps = await recent(project, Number(last ?? 10), Number(days ?? 14));
		console.log(json ? JSON.stringify(ps) : renderRecent(ps));
	} else {
		const p = await profile(args[0], Number(days ?? 30), { judge: !fast });
		console.log(json ? JSON.stringify(p) : render(p));
	}
}
