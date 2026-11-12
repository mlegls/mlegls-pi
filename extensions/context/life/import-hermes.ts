// One-time migration of a Hermes profile's own history into its life.
import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Kind, LifeInput } from "./contracts.ts";
import { clip, lifeId, lifeLog, pages } from "./log.ts";

interface Session {
	id: string;
	source: string;
	title: string | null;
	model: string | null;
	model_config: string | null;
}
interface Row {
	id: number;
	session_id: string;
	role: string;
	content: string | null;
	tool_calls: string | null;
	timestamp: number;
	display_kind: string | null;
	message_uid: string | null;
	_compressed_summary: number;
}
interface Run {
	session: string;
	end: number;
	lastRow: number;
	messages: LifeInput[];
}

const workKinds = new Set(["model_switch", "async_delegation_complete", "internal_notification", "process_complete"]);

function convert(row: Row, profile: string, session: Session, model: string): LifeInput[] {
	if (!row.message_uid) throw new Error("Missing message_uid at Hermes row " + row.id);
	const out: LifeInput[] = [];
	let k = 0;
	const push = (kind: Kind, text: string) => {
		if (text.trim()) out.push({
			kind, text, date: new Date(row.timestamp * 1000).toISOString(), model,
			place: "Hermes " + session.source + ": " + (session.title ?? ""),
			source: "hermes:" + profile + "/" + session.id + "/" + row.message_uid + "#" + k++,
		});
	};
	const many = (kind: Kind, text: string) => { for (const page of pages(text)) push(kind, page); };
	const content = row.content ?? "";
	switch (row.role) {
		case "user":
			many(workKinds.has(row.display_kind ?? "") || /^(?:\[Cronjob|\[System:|Message from )/.test(content) ? "work" : "user", content);
			break;
		case "assistant":
			many("agent", content);
			for (const call of JSON.parse(row.tool_calls ?? "[]")) {
				const f = call.function;
				const args = typeof f.arguments === "string" ? JSON.parse(f.arguments) : f.arguments;
				many("tool", f.name + " " + JSON.stringify(args ?? {}));
			}
			break;
		case "tool": push("echo", clip(content)); break;
	}
	return out;
}

/** Read a consistent snapshot, including original rows made inactive by compaction. */
export function hermesHistory(profile: string) {
	const path = join(homedir(), ".hermes", "profiles", profile, "state.db");
	const db = new Database(path, { readonly: true });
	try {
		return db.transaction(() => {
			const sessions = db.query("SELECT id, source, title, model, model_config FROM sessions ORDER BY started_at, id").all() as Session[];
			const originals = new Map((db.query("SELECT message_uid AS uid, min(id) AS id FROM messages GROUP BY message_uid").all() as { uid: string; id: number }[]).map((r) => [r.uid, r.id]));
			const runs: Run[] = [];
			const displayKinds = new Map<string | null, number>();
			const markers: { session: string; row: number; uid: string | null; content: string }[] = [];
			let rowCount = 0;
			let excludedSessions = 0;
			for (const session of sessions) {
				const config = JSON.parse(session.model_config ?? "{}");
				if (session.source === "subagent" || Object.hasOwn(config, "_delegate_from")) {
					excludedSessions++;
					continue;
				}
				const rows = db.query(
					"SELECT id, session_id, role, content, tool_calls, timestamp, display_kind, message_uid, _compressed_summary " +
					"FROM messages WHERE session_id = ? ORDER BY id",
				).all(session.id) as Row[];
				let model = session.model ?? "";
				let run: Run | undefined;
				for (const row of rows) {
					if (!row.message_uid) {
						if (row._compressed_summary) continue;
						throw new Error("Missing message_uid at Hermes row " + row.id);
					}
					if (originals.get(row.message_uid) !== row.id) continue;
					if (row._compressed_summary) continue;
					rowCount++;
					displayKinds.set(row.display_kind, (displayKinds.get(row.display_kind) ?? 0) + 1);
					if (/^\[(?:PRIOR CONTEXT|CONTEXT COMPACTION)/.test(row.content ?? "")) {
						markers.push({ session: session.id, row: row.id, uid: row.message_uid, content: row.content! });
					}
					if (!run || row.role === "user") {
						run = { session: session.id, end: row.timestamp, lastRow: row.id, messages: [] };
						runs.push(run);
					}
					if (row.display_kind === "model_switch") {
						const change = /The active model for this chat has changed to (.+?) via provider (\S+)/.exec(row.content ?? "");
						if (!change) throw new Error("Unrecognized model switch at Hermes row " + row.id);
						model = change[2].replace(/\.$/, "") + "/" + change[1];
					}
					run.end = row.timestamp;
					run.lastRow = row.id;
					run.messages.push(...convert(row, profile, session, model));
				}
			}
			runs.sort((a, b) => a.end - b.end || a.lastRow - b.lastRow || a.session.localeCompare(b.session));
			return { path, sessions: sessions.length - excludedSessions, excludedSessions, rowCount, displayKinds, markers, runs };
		})();
	} finally {
		db.close();
	}
}

function main(args: string[]) {
	const usage = "bun extensions/context/life/import-hermes.ts <profile> [--life /<name>] [--dry-run]";
	if (args.includes("--help")) {
		console.log(usage + "\nReads ~/.hermes/profiles/<profile>/state.db read-only. Life defaults to /<profile>.\n" +
			"PI_BOARD_DIR selects an isolated destination. --dry-run never opens the destination.\n" +
			"Re-import skips existing sources; new messages append without moving existing positions.");
		return;
	}
	const profile = args.shift();
	if (!profile || profile === "." || profile === ".." || /[/\\]/.test(profile) || profile.startsWith("-")) throw new Error(usage);
	let name = "/" + profile;
	let dry = false;
	while (args.length) {
		const arg = args.shift();
		if (arg === "--dry-run") dry = true;
		else if (arg === "--life" && args[0] && !args[0].startsWith("--")) name = args.shift()!;
		else throw new Error(usage);
	}
	const id = lifeId(name, process.cwd());
	if (!id) throw new Error("Invalid life name: " + name);
	const history = hermesHistory(profile);
	console.log(JSON.stringify({
		source: history.path, life: id, dryRun: dry, sessions: history.sessions,
		excludedSessions: history.excludedSessions, rows: history.rowCount, runs: history.runs.length,
		messages: history.runs.reduce((n, r) => n + r.messages.length, 0),
		displayKinds: [...history.displayKinds].map(([kind, rows]) => ({ kind, rows })),
		survivingContextMarkers: history.markers,
	}, null, 2));
	if (dry) return;
	const log = lifeLog(id);
	let added = 0;
	for (const run of history.runs) added += log.append(run.messages).length;
	console.log("Appended " + added + " messages to " + id + ".");
}

if (import.meta.main) {
	try { main(process.argv.slice(2)); }
	catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
