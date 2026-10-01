// recall: one tool over everything remembered. q is a function name (id, entry, search) or a read-only SQL query
// over the records store, args its arguments or bound parameters. A bare id as q is `id`, so pointers in context
// ("recall 8156df2bcbd6") resolve in one short call. OM memory ids go to OM's recall (observation → reflection →
// source entries); elided outputs come back from the branch; any other record id returns the record with its tags
// and edges. SQL runs on a read-only connection with the current branch loaded as a temp table, so queries can
// scope to the branch or search across sessions.
import { getAgentDir, type ExtensionAPI, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { storePath } from "../../lib/records/store.ts";
import { recallElided } from "./elide.ts";
import { formatRecallRenderedResultForTui, recallObservationTool } from "./om/tools/recall-observation.ts";

const DESCRIPTION = "Recall anything remembered: OM memories, journal notes, elided tool outputs, board messages, session entries. " +
	"q is a function or a read-only SQL query; args are its arguments or the query's ? parameters.\n" +
	"Functions:\n" +
	"- id: q \"id\", args [id], or just q \"<id>\": a 12-hex memory id (OM observation/reflection, with its sources; an elided output, in full) or any record id (board message ids like muppbafa-6uviod), shown with tags and edges.\n" +
	"- entry: args [\"entry:<session>/<entry>\" or an entry id on this branch, ...]: the session entries' text.\n" +
	"- search: args [text, schema?]: records whose body contains text, newest first.\n" +
	"SQL (SQLite, read-only; at most 100 rows, long cells cut):\n" +
	"- records(seq, id, ts, schema, body): append-only; schema is om | journal | elided | board | cursor.\n" +
	"- tags(record → records.seq, key, value, ord): every record has session. om: om.kind (observation | reflection | drop), om.id (the 12-hex memory id), om.timestamp, om.relevance, om.tokenCount. journal: journal.via, journal.model. elided: tool, tokens. board: topic, name, cwd, free tags (decision, blocked, done, …) and board.<field> data.\n" +
	"- edges(record, src, rel, dst): at → entry:<session>/<entry> (where it was written); cites, source → entries; om reflects, drops → om:<memory id>; journal corrects → records.\n" +
	"- temp branch(pos, id, type, role, tool, text): this session's current branch, oldest first.\n" +
	"Examples: SELECT r.ts, r.body FROM records r JOIN tags t ON t.record = r.seq AND t.key = 'topic' WHERE r.schema = 'board' AND t.value LIKE 'run/%' ORDER BY r.seq DESC LIMIT 10\n" +
	"SELECT r.body FROM records r JOIN edges e ON e.record = r.seq AND e.rel = 'at' JOIN branch b ON e.dst LIKE '%/' || b.id WHERE r.schema = 'journal'\n" +
	"SELECT pos, tool, substr(text, 1, 200) FROM branch WHERE role = 'toolResult' AND text LIKE ?";

const MEMORY_ID = /^[a-f0-9]{12}$/;
const MAX_ROWS = 100, MAX_CELL = 2000, MAX_OUT = 50_000;

const textOf = (content: unknown): string => typeof content === "string" ? content
	: Array.isArray(content) ? content.map((c: any) => c.type === "text" ? c.text : c.type === "toolCall" ? c.name + " " + JSON.stringify(c.arguments) : c.type === "thinking" ? "" : "[" + c.type + "]").filter(Boolean).join("\n") : "";

function entryText(e: any): { type: string; role?: string; tool?: string; text: string } {
	if (e.type === "message") return { type: e.type, role: e.message.role, tool: e.message.toolName, text: textOf(e.message.content) };
	if (e.type === "custom_message") return { type: e.type, role: e.customType, text: textOf(e.content) };
	if (e.type === "compaction" || e.type === "branch_summary") return { type: e.type, text: e.summary ?? "" };
	return { type: e.type, text: "" };
}

function sessionFile(session: string): string | undefined {
	const root = join(getAgentDir(), "sessions");
	if (!existsSync(root)) return;
	for (const dir of readdirSync(root)) {
		const hit = readdirSync(join(root, dir)).find((f) => f.endsWith("_" + session + ".jsonl"));
		if (hit) return join(root, dir, hit);
	}
}

function entries(refs: string[], branch: SessionEntry[]): string {
	const files = new Map<string, Map<string, any>>();
	return refs.map((ref) => {
		const m = /^entry:([^/]+)\/(.+)$/.exec(ref);
		const id = m ? m[2] : ref;
		let e: any = branch.find((x) => x.id === id);
		if (!e && m) {
			if (!files.has(m[1])) {
				const f = sessionFile(m[1]);
				files.set(m[1], new Map(f ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { const j = JSON.parse(l); return [j.id, j]; }) : []));
			}
			e = files.get(m[1])!.get(id);
		}
		if (!e) return ref + ": not found";
		const t = entryText(e);
		return "## " + ref + " (" + [t.type, t.role, t.tool, e.timestamp].filter(Boolean).join(" ") + ")\n" + t.text;
	}).join("\n\n");
}

function open(branch: SessionEntry[]): Database {
	const d = new Database(storePath(), { readonly: true });
	d.exec("PRAGMA busy_timeout = 5000");
	d.exec("CREATE TEMP TABLE branch (pos INTEGER, id TEXT, type TEXT, role TEXT, tool TEXT, text TEXT)");
	const ins = d.query("INSERT INTO branch VALUES (?, ?, ?, ?, ?, ?)");
	d.transaction(() => branch.forEach((e: any, i) => { const t = entryText(e); ins.run(i, e.id, t.type, t.role ?? null, t.tool ?? null, t.text); }))();
	return d;
}

function table(rows: Record<string, unknown>[], total: number): string {
	if (!rows.length) return "(no rows)";
	const cell = (v: unknown) => {
		const s = v instanceof Uint8Array ? new TextDecoder().decode(v) : v === null ? "" : String(v);
		return s.length > MAX_CELL ? s.slice(0, MAX_CELL) + "…[" + s.length + " chars]" : s;
	};
	let out = rows.map((r) => JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)])))).join("\n");
	if (out.length > MAX_OUT) out = out.slice(0, MAX_OUT) + "\n…[output cut]";
	return out + (total > rows.length ? "\n[" + total + " rows; first " + rows.length + " shown]" : "");
}

function recordById(d: Database, id: string): string | undefined {
	// OM memory ids live in the om.id tag; this finds memories from other sessions, which OM's own recall can't see.
	const r = (d.query("SELECT seq, id, ts, schema, body FROM records WHERE id = ?").get(id)
		?? d.query("SELECT r.seq, r.id, r.ts, r.schema, r.body FROM records r JOIN tags t ON t.record = r.seq WHERE t.key = 'om.id' AND t.value = ? ORDER BY r.seq DESC LIMIT 1").get(id)) as any;
	if (!r) return;
	const tags = d.query("SELECT key, value FROM tags WHERE record = ? ORDER BY rowid").all(r.seq) as any[];
	const edges = d.query("SELECT rel, dst FROM edges WHERE record = ? ORDER BY rowid").all(r.seq) as any[];
	return [r.schema + " " + r.id + " " + r.ts, ...tags.map((t) => "  " + t.key + (t.value === null ? "" : " = " + (t.value instanceof Uint8Array ? new TextDecoder().decode(t.value) : t.value))),
		...edges.map((e) => "  → " + e.rel + " " + e.dst), "", r.body].join("\n");
}

const text = (s: string, details?: unknown) => ({ content: [{ type: "text" as const, text: s }], details });

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "recall",
		label: "recall",
		description: DESCRIPTION,
		promptSnippet: "Recall memories, elided outputs, board messages and session entries by id, search, or read-only SQL over the records store",
		promptGuidelines: [
			"Use recall <id> to resolve a memory id or elision pointer before acting on details it stands for.",
			"Use recall with SQL to answer questions about earlier work across sessions (decisions, board history, what an output said).",
		],
		parameters: Type.Object({
			q: Type.String({ description: "id | entry | search | a memory or record id | a SELECT/WITH query" }),
			args: Type.Optional(Type.Array(Type.Union([Type.String(), Type.Number()]), { description: "Function arguments, or the query's ? parameters" })),
		}),
		renderResult(result: any, options) {
			const d = result.details;
			if (d && typeof d === "object" && "memoryId" in d) return new Text(formatRecallRenderedResultForTui(result, options.expanded), 0, 0);
			const t = result.content?.[0]?.text ?? "";
			return new Text(options.expanded ? t : t.split("\n").slice(0, 12).join("\n"), 0, 0);
		},
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const branch = ctx.sessionManager.getBranch() as SessionEntry[];
			const q = params.q.trim(), args = params.args ?? [];
			const fn = /^\w+$/.test(q) && ["id", "entry", "search"].includes(q) ? q : /^(select|with)\b/i.test(q) ? "sql" : "id";
			const id = fn === "id" ? String(q === "id" ? args[0] ?? "" : q) : "";
			if (fn === "id" && MEMORY_ID.test(id)) {
				const om = await recallObservationTool.execute(toolCallId, { id }, signal, onUpdate as any, ctx);
				if ((om.details as any)?.status !== "not_found") return om;
				const elided = recallElided(branch, id);
				if (elided) return { content: elided.content, details: undefined };
			}
			if (fn === "entry") return text(args.length ? entries(args.map(String), branch) : "entry needs args: entry refs or ids");
			const d = open(branch);
			try {
				if (fn === "id") return text(recordById(d, id) ?? "No memory, elided output or record with id " + id + ".");
				if (fn === "search") {
					const [needle, schema] = args.map(String);
					if (!needle) return text("search needs args: [text, schema?]");
					const rows = d.query("SELECT id, ts, schema, substr(body, 1, 300) AS body FROM records WHERE body LIKE ? " + (schema ? "AND schema = ? " : "") + "ORDER BY seq DESC LIMIT 20")
						.all(...(["%" + needle + "%", ...(schema ? [schema] : [])] as string[])) as Record<string, unknown>[];
					return text(table(rows, rows.length));
				}
				const all = d.query(q).all(...(args as (string | number)[])) as Record<string, unknown>[];
				return text(table(all.slice(0, MAX_ROWS), all.length));
			} finally { d.close(); }
		},
	});
}
