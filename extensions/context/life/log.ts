// A life's copied messages, independent of their source session files. Each append holds
// SQLite's write lock while deduplicating sources and assigning contiguous permanent positions.
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { entryRef } from "../../../lib/records/branch.ts";
import { db, fieldsOf, fieldTags, immediate, select, write } from "../../../lib/records/store.ts";
import { commonDir } from "../../../lib/thread/git.ts";
import type { AppendContext, Kind, LifeInput, LifeLog, LifeMessage, LifeMessages } from "./contracts.ts";

export type { Kind } from "./contracts.ts";

export const SCHEMA = "life";

/** /name is machine-wide; a bare name belongs to this repository, shared by its worktrees. */
export function lifeId(name: string, cwd: string): string | undefined {
	name = name.trim();
	if (!name || name === "/") return;
	if (name.startsWith("/")) return name;
	const project = commonDir(cwd);
	return project && project + ":" + name;
}

/** Records of one schema that belong to a life. */
export function ofLife(schema: string, id: string, options: { after?: number; where?: string; params?: (string | number)[] } = {}) {
	return select(schema, {
		after: options.after,
		where: "r.seq IN (SELECT record FROM tags WHERE key = 'life.id' AND value = ?)" + (options.where ? " AND (" + options.where + ")" : ""),
		params: [id, ...(options.params ?? [])],
	});
}

export function lifeLog(id: string): LifeLog {
	return {
		id,
		read(from = 0) {
			return ofLife(SCHEMA, id, from > 0 ? {
				where: "r.seq IN (SELECT record FROM tags WHERE key = 'life.pos' AND value >= ?)", params: [from],
			} : {}).map((r) => {
				const { id: _id, ...message } = fieldsOf("life", r.tags);
				return { ...message, text: r.body } as unknown as LifeMessage;
			}).sort((a, b) => a.pos - b.pos);
		},
		append(messages) {
			if (!messages.length) return [];
			return immediate((d) => {
				const sources = new Set<string>();
				const remembered = d.query(
					// Start from the source tag: it is nearly unique, while every message of the life has the id tag.
					"SELECT 1 FROM tags s CROSS JOIN tags i ON i.record = s.record AND i.key = 'life.id' AND i.value = ? " +
					"JOIN records r ON r.seq = s.record WHERE s.key = 'life.source' AND s.value = ? AND r.schema = ? LIMIT 1",
				);
				let pos = (d.query(
					"SELECT coalesce(max(p.value), -1) AS pos FROM records r " +
					"JOIN tags i ON i.record = r.seq AND i.key = 'life.id' AND i.value = ? " +
					"JOIN tags p ON p.record = r.seq AND p.key = 'life.pos' WHERE r.schema = ?",
				).get(id, SCHEMA) as { pos: number }).pos + 1;
				const added: LifeMessage[] = [];
				for (const m of messages) {
					if (sources.has(m.source) || remembered.get(id, m.source, SCHEMA)) continue;
					const message = { ...m, pos: pos++ };
					write({
						schema: SCHEMA, body: m.text,
						tags: fieldTags("life", {
							id, pos: message.pos, kind: m.kind, place: m.place,
							date: m.date, model: m.model, source: m.source,
						}),
					}, d);
					sources.add(m.source);
					added.push(message);
				}
				return added;
			});
		},
	};
}

/** A parsed message before lifeMessages assigns its durable source. */
export interface Msg {
	kind: Kind;
	text: string;
	/** Session entry id it came from, and its position among that entry's messages. */
	entry: string;
	k: number;
	date: string;
}

export const ECHO_CHARS = 30_000;
export const PAGE_CHARS = 30_000;

export function clip(text: string, max = ECHO_CHARS): string {
	if (text.length <= max) return text;
	const half = Math.floor(max / 2);
	return text.slice(0, half) + "\n…[" + (text.length - 2 * half) + " characters clipped]…\n" + text.slice(-half);
}

export function pages(text: string, max = PAGE_CHARS): string[] {
	if (text.length <= max) return [text];
	const out: string[] = [];
	for (let at = 0; at < text.length; at += max) out.push(text.slice(at, at + max));
	return out;
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((c: any) => c?.type === "text" ? c.text : c?.type === "image" ? "[image]" : "").filter(Boolean).join("\n");
}

function incoming(text: string, fallback: Kind, selfThreads: readonly string[]): Kind {
	const thread = /^\[bb message from thread:([^\]]+)\]/.exec(text)?.[1];
	return thread ? selfThreads.includes(thread) ? "self" : "work" : fallback;
}

/** The branch's messages, oldest first, each with its entry index and historical model. */
export function messagesOf(branch: readonly SessionEntry[], context?: Pick<AppendContext, "model" | "selfThreads">): (Msg & { at: number; model: string })[] {
	const out: (Msg & { at: number; model: string })[] = [];
	let model = context?.model ?? "";
	const selfThreads = context?.selfThreads ?? [];
	branch.forEach((e, at) => {
		if (e.type === "model_change") model = e.provider + "/" + e.modelId;
		if (e.type === "message" && e.message.role === "assistant") {
			if (e.message.provider && e.message.model) model = e.message.provider + "/" + e.message.model;
		}
		const date = e.timestamp;
		let k = 0;
		const push = (kind: Kind, text: string) => { if (text.trim()) out.push({ kind, text, entry: e.id, k: k++, date, at, model }); };
		const many = (kind: Kind, text: string) => { for (const p of pages(text)) push(kind, p); };
		const received = (fallback: Kind, content: unknown) => {
			const text = textOf(content);
			many(incoming(text, fallback, selfThreads), text);
		};
		if (e.type === "custom_message") received("work", e.content);
		if (e.type !== "message") return;
		const m: any = e.message;
		switch (m.role) {
			case "user": received("user", m.content); break;
			case "assistant":
				for (const c of m.content ?? []) {
					if (c.type === "text") many("agent", c.text);
					else if (c.type === "toolCall") many("tool", c.name + " " + JSON.stringify(c.arguments ?? {}));
				}
				break;
			case "toolResult": push("echo", clip((m.isError ? "[error] " : "") + textOf(m.content))); break;
			case "bashExecution": push("echo", clip("!" + m.command + "\n" + (m.output ?? ""))); break;
			case "custom": received("work", m.content); break;
		}
	});
	return out;
}

/** Previously remembered inherited entries keep their original refs after a session fork. */
function inheritedSources(sessions: readonly string[]): Map<string, string> {
	const sources = new Map<string, string>();
	if (!sessions.length) return sources;
	const prefixes = sessions.map((s) => entryRef(s, ""));
	const rows = db().query(
		"SELECT s.value AS source FROM records r JOIN tags s ON s.record = r.seq AND s.key = 'life.source' " +
		"WHERE r.schema = ? AND (" + prefixes.map(() => "substr(s.value, 1, ?) = ?").join(" OR ") + ") ORDER BY r.seq",
	).all(SCHEMA, ...prefixes.flatMap((p) => [p.length, p])) as { source: string }[];
	for (const { source } of rows) {
		const key = source.slice(source.indexOf("/") + 1);
		if (!sources.has(key)) sources.set(key, source);
	}
	return sources;
}

export const lifeMessages: LifeMessages = (branch, context) => {
	const inherited = inheritedSources((context.sessions ?? []).filter((s) => s !== context.session));
	return messagesOf(branch, context).map((m) => ({
		kind: m.kind, text: m.text, date: m.date, model: m.model, place: context.place,
		source: inherited.get(m.entry + "#" + m.k) ?? entryRef(context.session, m.entry) + "#" + m.k,
	}));
};

/** The text a leaf compresses, credited to where it happened. */
export const source = (m: LifeInput) => m.kind + "@" + m.place + ": " + m.text;
