// Windowed project audits. Transport flat, exclusive session profiles: trees and thread rows are
// views over these same records, never independently costed copies of a descendant tree.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { graph, type Node } from "./graph";
import { profileFile, renderRecent, type Profile, type Window } from "./profile";
import { GENERATED } from "./prompts";
import { bbDataDir, bbPrompts } from "./thread/bb";
import { quote } from "./thread/process";

export interface ProjectQuery extends Window { project: string; days?: number; evidence?: boolean }
interface Session { host: string; thread?: string; parent?: string; parentKind?: Node["parentKind"]; file: string; profile: Profile }
interface Prompt { host: string; thread?: string; session?: string; at: number; text: string; link: string; msg?: number }
export interface ProjectPacket { hosts: { host: string; dataDir: string }[]; sessions: Session[]; prompts: Prompt[] }
export interface ThreadRow {
	id: string; thread?: string; title: string; hosts: string[]; sessions: string[];
	start: number; end: number; cost: number; activeMs: number; turns: number;
	costByModel: Record<string, number>;
}
const active = (p: Profile) => p.time.model + p.time.tool;
const matches = (p: string, project: string) => p.toLowerCase().includes(project.toLowerCase());
const inWindow = (t: number, q: Window) => t >= (q.since ?? 0) && t <= (q.until ?? Infinity);
const clean = (s: string) => s.replace(/<skill[\s\S]*?<\/skill>/g, "").trim();
const generated = (text: string) => GENERATED.test(text) || /^\[(?:reconcile |bb (?:automation|message)\b)/.test(text);

export async function collectProject(q: ProjectQuery): Promise<ProjectPacket> {
	const host = hostname();
	const days = Math.max(q.days ?? 14, (Date.now() - (q.since ?? q.until ?? Date.now())) / 86_400_000 + (q.since === undefined ? q.days ?? 14 : 1));
	const nodes = await graph({ days });
	const selected = new Map<string, Node>();
	// Include descendants even if a worker's cwd is outside the project, but visit each session once.
	const visit = (n: Node) => { if (selected.has(n.id)) return; selected.set(n.id, n); for (const id of n.children) { const c = nodes.get(id); if (c) visit(c); } };
	for (const n of nodes.values()) if (matches(n.project, q.project)) visit(n);
	const sessions: Session[] = [];
	for (const n of selected.values()) {
		const p: Profile = { ...profileFile(n.file, n, q), children: [] };
		if (!p.turns && !p.cost && !active(p) && !p.user.turns) continue;
		// Textual wait notes are not part of a project cost query or its transport.
		p.segments = []; delete p.ended;
		sessions.push({ host, thread: n.thread, parent: n.parent, parentKind: n.parentKind, file: n.file, profile: p });
	}
	const prompts: Prompt[] = [];
	if (q.evidence) {
		const threads = new Set(sessions.map(s => s.thread).filter(Boolean));
		for (const p of bbPrompts()) {
			const text = clean(p.text);
			if ((threads.has(p.thread) || matches(p.project, q.project)) && inWindow(p.at, q) && !p.sender && text && !generated(text))
				prompts.push({ host, thread: p.thread, at: p.at, text, msg: p.msg, link: "@thread:" + p.thread + "#msg=" + p.msg });
		}
		// Non-bb sessions have no bb message link; retain their actual file/entry anchor instead.
		for (const n of selected.values()) if (!n.thread && n.interactive) {
			const entries = readFileSync(n.file, "utf8").split("\n");
			for (const line of entries) {
				let e: any; try { e = JSON.parse(line); } catch { continue; }
				const at = Date.parse(e.timestamp);
				if (e.type !== "message" || e.message?.role !== "user" || at < Date.parse(n.created) || !inWindow(at, q)) continue;
				const c = e.message.content;
				const text = clean(typeof c === "string" ? c : Array.isArray(c) ? c.filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n") : "");
				if (text && !generated(text)) prompts.push({ host, session: n.id, at, text, link: n.file + "#" + e.id });
			}
		}
	}
	return { hosts: [{ host, dataDir: bbDataDir() }], sessions, prompts };
}

/** Send this checkout's read-only collector, not a possibly older checkout on the remote host.
 * The remote needs only bun, bb and its own session files. Its temporary bundle is removed on exit. */
export async function remoteProject(alias: string, q: ProjectQuery): Promise<ProjectPacket> {
	const build = await Bun.build({ entrypoints: [fileURLToPath(import.meta.url)], target: "bun", minify: true });
	if (!build.success) throw new Error("profile collector bundle: " + build.logs.join("\n"));
	const script = 'f=$(mktemp /tmp/mlegls-profile-XXXXXX.ts) || exit; trap \'rm -f "$f"\' EXIT HUP INT TERM; ' +
		'tee "$f" >/dev/null; export PATH="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.local/share/mise/shims:$PATH"; bun "$f" ' + quote(JSON.stringify(q));
	const proc = Bun.spawn(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "--", alias, 'exec "$SHELL" -lc ' + quote(script)], {
		stdin: build.outputs[0], stdout: "pipe", stderr: "pipe",
	});
	const [output, error, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
	if (code) throw new Error("--host " + alias + " failed (" + code + "): " + error.trim());
	try { return JSON.parse(output); } catch { throw new Error("--host " + alias + " returned invalid profile JSON: " + output.slice(0, 300)); }
}

export function mergeProjects(packets: ProjectPacket[]): ProjectPacket {
	const sessions = new Map<string, Session>(), prompts = new Map<string, Prompt>();
	for (const packet of packets) {
		for (const s of packet.sessions) {
			const prev = sessions.get(s.profile.id);
			// A moved/resumed file can be present on both hosts. Prefer its most complete window.
			if (!prev || s.profile.cost > prev.profile.cost || (s.profile.cost === prev.profile.cost && active(s.profile) > active(prev.profile)))
				sessions.set(s.profile.id, { ...s, thread: s.thread ?? prev?.thread });
			else if (!prev.thread) prev.thread = s.thread;
		}
		for (const p of packet.prompts) {
			const key = p.thread ? p.thread + "/" + p.msg : p.session + "/" + p.at;
			if (!prompts.has(key)) prompts.set(key, p);
		}
	}
	return {
		hosts: [...new Map(packets.flatMap(p => p.hosts).map(h => [h.host, h])).values()],
		sessions: [...sessions.values()], prompts: [...prompts.values()].sort((a, b) => a.at - b.at),
	};
}

export function threadRows(packet: ProjectPacket, trees = false): ThreadRow[] {
	const rows = new Map<string, ThreadRow>();
	const owners = new Map(packet.sessions.map(s => [s.profile.id, s]));
	if (trees) {
		// Project mode is a baseline of root trees. Collapse those roots by BB thread, without
		// charging a fork both here and under its parent. The evidence also retains exclusive rows.
		const assign = (p: Profile, owner: Session) => { owners.set(p.id, owner); p.children.forEach(c => assign(c, owner)); };
		for (const root of projectRoots(packet)) assign(root, packet.sessions.find(s => s.profile.id === root.id)!);
	}
	for (const s of packet.sessions) {
		const p = s.profile, owner = owners.get(p.id)!, id = owner.thread ?? owner.profile.id;
		const r = rows.get(id) ?? { id, thread: owner.thread, title: owner.profile.title, hosts: [], sessions: [], start: p.start, end: p.end, cost: 0, activeMs: 0, turns: 0, costByModel: {} };
		r.start = Math.min(r.start, p.start); r.end = Math.max(r.end, p.end);
		r.cost += p.cost; r.activeMs += active(p); r.turns += p.turns;
		for (const [m, c] of Object.entries(p.costByModel)) r.costByModel[m] = (r.costByModel[m] ?? 0) + c;
		r.sessions.push(p.id); if (!r.hosts.includes(s.host)) r.hosts.push(s.host);
		rows.set(id, r);
	}
	return [...rows.values()].sort((a, b) => b.start - a.start || a.id.localeCompare(b.id));
}

export function projectRoots(packet: ProjectPacket): Profile[] {
	const profiles = new Map(packet.sessions.map(s => [s.profile.id, { ...s.profile, children: [] as Profile[] }]));
	const roots: Profile[] = [];
	for (const s of packet.sessions) {
		const p = profiles.get(s.profile.id)!, parent = s.parent && s.parentKind !== "fork" ? profiles.get(s.parent) : undefined;
		if (parent) parent.children.push(p); else roots.push(p);
	}
	return roots.sort((a, b) => b.start - a.start);
}

export function renderThreads(rows: ThreadRow[]): string {
	return rows.map(r => new Date(r.start).toISOString().slice(0, 16) + " " + r.id + " $" + r.cost.toFixed(2) +
		" active " + (r.activeMs / 3600e3).toFixed(2) + "h " + r.sessions.length + " sessions " + r.hosts.join(",") + " " + r.title.replace(/\n/g, " ").slice(0, 70)).join("\n");
}

export function writeEvidence(dir: string, q: ProjectQuery, packet: ProjectPacket): void {
	mkdirSync(dir, { recursive: true });
	const json = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + "\n");
	const totals = (field: "tools" | "inner" | "waits") => {
		const out: Record<string, { n: number; ms: number; errors?: number }> = {};
		for (const s of packet.sessions) for (const [name, v] of Object.entries(s.profile[field])) {
			const t = out[name] ??= { n: 0, ms: 0 };
			t.n += v.n; t.ms += v.ms;
			if ("errors" in v) t.errors = (t.errors ?? 0) + Number(v.errors);
		}
		return Object.fromEntries(Object.entries(out).sort((a, b) => b[1].ms - a[1].ms));
	};
	json("query.json", { ...q, hosts: packet.hosts, generatedAt: new Date().toISOString() });
	json("sessions.json", packet.sessions);
	json("threads.json", threadRows(packet));
	json("roots.json", threadRows(packet, true));
	json("prompts.json", packet.prompts);
	json("tools.json", { tools: totals("tools"), inner: totals("inner"), waits: totals("waits") });
	writeFileSync(join(dir, "prompts.md"), "# User prompts\n\n" + packet.prompts.map(p =>
		"## " + new Date(p.at).toISOString() + " " + p.link + " (" + p.host + ")\n\n" + p.text).join("\n\n") + "\n");
	writeFileSync(join(dir, "index.md"), "# Project profile: " + q.project + "\n\n" +
		"Window: " + (q.since === undefined ? "unbounded" : new Date(q.since).toISOString()) + " → " +
		(q.until === undefined ? "unbounded" : new Date(q.until).toISOString()) + ".\n\n" +
		"Costs/counts belong to entries completed in the inclusive window; model/tool intervals are clipped to it. " +
		"Nested tool durations crossing a boundary are prorated (their logs carry durations, not start times). " +
		"threads.json contains exclusive per-thread costs; roots.json and --by-thread group root-session trees by BB thread, including descendants once. " +
		"Sessions are deduplicated across hosts by pi id, preferring the most complete window. " +
		"Non-bb sessions retain session ids and file anchors, not invented thread/message links.\n\n" +
		"[Root trees grouped by thread](roots.json) · [Exclusive threads](threads.json) · [Sessions and source files](sessions.json) · [User prompts](prompts.md) · [Prompt data](prompts.json) · [Tool-time totals](tools.json) · [Query and host databases](query.json)\n");
}

export async function projectReport(q: ProjectQuery, options: { hosts: string[]; byThread: boolean; last: number; json: boolean; evidence?: string }): Promise<string> {
	const packets = await Promise.all([collectProject(q), ...options.hosts.map(h => remoteProject(h, q))]);
	const packet = mergeProjects(packets);
	if (options.evidence) writeEvidence(options.evidence, q, packet);
	const rows = options.byThread ? threadRows(packet, true).slice(0, options.last) : projectRoots(packet).slice(0, options.last);
	return options.json ? JSON.stringify(rows) : options.byThread ? renderThreads(rows as ThreadRow[]) : renderRecent(rows as Profile[]);
}

if (import.meta.main) console.log(JSON.stringify(await collectProject(JSON.parse(process.argv[2]!))));
