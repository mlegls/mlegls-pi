#!/usr/bin/env bun
// Per-role time and cost of reconciler workers, from pi session files.
// bun docs/attachments/role-time-audit/audit.ts [--since 2026-10-01] [--until 2026-10-02] [--exclude calc-ops,math-ops]
// Reconciler workers are worktree sessions on the stance provider whose handle ends -<role>-<n>.
// active = model latency (gaps before an assistant message < 10 min) + tool time (gaps before a tool result < 30 min).
// Cost is list price; on subscription capacity read it as relative weight.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: o } = parseArgs({ options: { since: { type: "string" }, until: { type: "string" }, exclude: { type: "string", default: "calc-ops,math-ops" } } });
const since = o.since ? Date.parse(o.since) : 0, until = o.until ? Date.parse(o.until) : Infinity;
const exclude = new Set(o.exclude!.split(",").filter(Boolean));
const D = join(process.env.HOME!, ".pi/agent/sessions");

type Row = { run: string; slug: string; role: string; agent: string; exec: string; start: number; end: number; active: number; model: number; tool: number; turns: number; out: number; reason: number; cost: number; peak: number; checkpoint: boolean };
const rows: Row[] = [];
const drive: Record<string, [number, number]> = {};
for (const dir of readdirSync(D)) {
	if (!dir.includes("__worktrees")) continue;
	for (const f of readdirSync(join(D, dir)).filter(f => f.endsWith(".jsonl"))) {
		const lines = readFileSync(join(D, dir, f), "utf8").split("\n").flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
		const meta = lines.find(l => l.type === "custom" && l.customType === "session-meta")?.data;
		const m = meta?.handle && /^(.*)-(refine|implement|drive|review|handler)-[0-9a-z]+$/.exec(meta.handle);
		if (!m || exclude.has(meta.run) || !lines.some(l => l.type === "model_change" && l.provider === "stance")) continue;
		const t0 = Date.parse(lines[0].timestamp);
		if (t0 < since || t0 >= until) continue;
		const r: Row = { run: meta.run, slug: m[1], role: m[2] === "handler" ? "handle" : m[2], agent: meta.agent, exec: "", start: t0, end: t0, active: 0, model: 0, tool: 0, turns: 0, out: 0, reason: 0, cost: 0, peak: 0, checkpoint: false };
		const execs: Record<string, number> = {};
		let prev: number | null = null;
		for (const l of lines) {
			const t = Date.parse(l.timestamp);
			const msg = l.type === "message" ? l.message : undefined;
			if (msg?.role === "assistant") {
				const u = msg.usage ?? {};
				r.turns++; r.out += u.output ?? 0; r.reason += u.reasoning ?? 0; r.cost += u.cost?.total ?? 0;
				r.peak = Math.max(r.peak, (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0));
				const k = msg.model + ":" + (msg.thinkingLevel ?? "?"); execs[k] = (execs[k] ?? 0) + 1;
				const g = prev == null ? 0 : t - prev;
				if (g < 600_000) r.model += g;
				r.end = t;
				if (r.role === "drive") {
					const code = (msg.content ?? []).filter((c: any) => c.type === "toolCall").map((c: any) => JSON.stringify(c.arguments)).join(" ");
					const kind = /mcp__(chrome|cua)__(click|fill|press|type|navigate|hover|select|drag|key)/.test(code) ? "ui act"
						: /mcp__(chrome|cua)__/.test(code) ? "ui observe"
						: /docs\/attachments|write\(|edit\(/.test(code) ? "packet write"
						: /mise (run|exec)|seed|setup|local|convex|port|curl|lsof|ps /.test(code) ? "setup/env"
						: code ? "read/other" : "no tool";
					const d = (drive[kind] ??= [0, 0]); d[0]++; if (g < 600_000) d[1] += g;
				}
			} else if (msg?.role === "toolResult" && prev != null && t - prev < 1_800_000) r.tool += t - prev;
			else if (msg?.role === "user" && /^checkpoint \(\d+% context\)/.test(typeof msg.content === "string" ? msg.content : msg.content?.[0]?.text ?? "")) r.checkpoint = true;
			if (!isNaN(t)) prev = t;
		}
		r.exec = Object.entries(execs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
		r.active = r.model + r.tool;
		rows.push(r);
	}
}

const min = (ms: number) => (ms / 60000).toFixed(0);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
const row = (cells: (string | number)[]) => console.log("| " + cells.join(" | ") + " |");
function table(title: string, key: (r: Row) => string) {
	const g: Record<string, Row[]> = {};
	for (const r of rows) (g[key(r)] ??= []).push(r);
	const tot = rows.reduce((a, r) => a + r.active, 0), totc = rows.reduce((a, r) => a + r.cost, 0);
	console.log("\n## " + title + "\n");
	row(["group", "n", "active min", "%", "median min", "model:tool %", "s/turn", "checkpoint", "median peak ctx k", "$ %"]);
	row(Array(10).fill("---"));
	for (const [k, v] of Object.entries(g).sort()) {
		const s = (p: keyof Row) => v.reduce((a, r) => a + (r[p] as number), 0);
		row([k, v.length, min(s("active")), (100 * s("active") / tot).toFixed(0), min(med(v.map(r => r.active))),
			(100 * s("model") / s("active")).toFixed(0) + ":" + (100 * s("tool") / s("active")).toFixed(0),
			(s("model") / 1000 / s("turns")).toFixed(1), v.filter(r => r.checkpoint).length + "/" + v.length,
			(med(v.map(r => r.peak)) / 1000).toFixed(0), (100 * s("cost") / totc).toFixed(0)]);
	}
	console.log("\ntotal active " + min(tot) + " min over " + rows.length + " sessions, list cost $" + totc.toFixed(2));
}
table("by role", r => r.role);
table("by role, stance and execution", r => r.role + " " + r.agent + " " + r.exec);
console.log("\n## drive turns by kind\n");
row(["kind", "turns", "model min"]); row(["---", "---", "---"]);
for (const [k, [n, ms]] of Object.entries(drive).sort((a, b) => b[1][1] - a[1][1])) row([k, n, min(ms)]);
