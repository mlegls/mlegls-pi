// A life's present is independent of its copied past. All state is append-only in
// the shared records store; every read sees other processes' latest writes.
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fieldsOf, fieldTags, write } from "../../../lib/records/store.ts";
import type { LifePresence, LifeRun } from "./contracts.ts";
import { ofLife } from "./log.ts";

const exec = promisify(execFile);

interface Place {
	run: LifeRun;
	ended: boolean;
	hold: string;
	detached: boolean;
}

interface Thread {
	id: string;
	title: string | null;
	titleFallback?: string;
	status: string;
	archivedAt: number | null;
	deletedAt?: number | null;
	updatedAt: number;
}

function alive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try { process.kill(pid, 0); return true; }
	catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}

/** No SessionManager: even its file loader may repair a file being written elsewhere. */
async function currentRun(file: string): Promise<SessionEntry[]> {
	const text = await readFile(file, "utf8");
	const lines = text.split("\n");
	const entries: SessionEntry[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i]!.trim()) continue;
		let entry;
		try { entry = JSON.parse(lines[i]!); }
		catch (error) {
			// An append can be in flight. Only its incomplete final line is ignored.
			if (i === lines.length - 1) break;
			throw error;
		}
		if (entry.type !== "session" && typeof entry.id === "string") entries.push(entry);
	}
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const branch: SessionEntry[] = [];
	let entry = entries.at(-1);
	const seen = new Set<string>();
	while (entry && !seen.has(entry.id)) {
		seen.add(entry.id);
		branch.push(entry);
		entry = entry.parentId ? byId.get(entry.parentId) : undefined;
	}
	branch.reverse();
	for (let i = branch.length - 1; i >= 0; i--) {
		const e = branch[i]!;
		if (e.type === "message" && e.message.role === "assistant" && e.message.stopReason !== "toolUse")
			return branch.slice(i + 1);
	}
	return branch;
}

export function present(life: string): LifePresence {
	const records = (schema: string) => ofLife(schema, life);
	const save = (schema: string, fields: Record<string, unknown>, body = "") => write({
		schema, body, tags: fieldTags("life", { ...fields, id: life }),
	});

	const places = (): Place[] => {
		const latest = new Map<string, { run: LifeRun; seq: number }>();
		for (const record of records("life.run")) {
			const f = fieldsOf("life", record.tags);
			const run: LifeRun = {
				id: record.id, time: f.time as string, session: f.session as string,
				sessionFile: f.sessionFile as string, pid: f.pid as number,
				...(f.thread ? { thread: f.thread as string } : {}),
			};
			latest.set(run.session, { run, seq: record.seq });
		}
		const detached = new Map<string, number>();
		for (const r of records("life.detach")) detached.set(fieldsOf("life", r.tags).session as string, r.seq);
		const ended = new Set(records("life.end").map((r) => fieldsOf("life", r.tags).run as string));
		const holds = new Map<string, string>();
		for (const r of records("life.hold")) holds.set(fieldsOf("life", r.tags).session as string, r.body);
		return [...latest.values()]
			.sort((a, b) => a.seq - b.seq)
			.map(({ run, seq }) => ({ run, ended: ended.has(run.id), hold: holds.get(run.session) ?? "",
				detached: (detached.get(run.session) ?? 0) > seq }));
	};

	// A bb thread can have replaced its pi session. The newest attachment owns its present.
	const currentPlaces = () => {
		const latest = new Map<string, Place>();
		for (const place of places()) latest.set(place.run.thread ?? place.run.session, place);
		return [...latest.values()].filter((place) => !place.detached);
	};

	return {
		start(run) {
			write({ id: run.id, schema: "life.run", tags: fieldTags("life", {
				...run, id: life,
			}) });
		},
		end(run) { save("life.end", { run }); },
		detach(session) {
			save("life.detach", { session });
			save("life.hold", { session });
		},
		hold(session, text) {
			save("life.hold", { session }, text.replace(/[\r\n]+/g, " ").trim());
		},
		threads() {
			// Keep historical membership for recognizing messages already sent by this life.
			return [...new Set(records("life.run").flatMap((r) => {
				const thread = fieldsOf("life", r.tags).thread;
				return typeof thread === "string" ? [thread] : [];
			}))];
		},
		async snapshot() {
			const ps = currentPlaces();
			const ids = ps.flatMap(({ run }) => run.thread ? [run.thread] : []);
			let threads: Thread[] = [];
			if (ids.length) {
				const { stdout } = await exec(process.env.BB_CLI || "bb", [
					"thread", "list", ...ids.flatMap((id) => ["--thread", id]), "--include-hidden", "--json",
				], { maxBuffer: 8 << 20, timeout: 30_000 });
				const result = JSON.parse(stdout);
				if (!Array.isArray(result)) throw new Error("bb thread list: " + stdout);
				threads = result;
			}
			const byId = new Map(threads.map((t) => [t.id, t]));
			const working: string[] = [], open: string[] = [];
			for (const { run, ended, hold } of ps) {
				const t = run.thread ? byId.get(run.thread) : undefined;
				if (run.thread && (!t || t.archivedAt || t.deletedAt)) continue;
				const isWorking = t ? ["starting", "active", "stopping"].includes(t.status) : !ended && alive(run.pid);
				if (!isWorking && t?.status !== "idle") continue;
				const since = isWorking ? run.time : new Date(t!.updatedAt).toISOString();
				const name = t ? (t.title || t.titleFallback || t.id) : run.session;
				const line = JSON.stringify(name) + " [" + (run.thread ?? "session:" + run.session) + "] since " + since
					+ (hold ? " — holding: " + hold : "");
				(isWorking ? working : open).push(line);
			}
			return [
				"Working:", ...(working.length ? working : ["(none)"]),
				"Open:", ...(open.length ? open : ["(none)"]),
			].join("\n");
		},
		async readRun(thread) {
			const place = currentPlaces().find(({ run }) => run.thread === thread);
			if (!place || place.ended) return [];
			return currentRun(place.run.sessionFile);
		},
	};
}
