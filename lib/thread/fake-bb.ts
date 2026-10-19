// A stand-in for the bb CLI (BB_CLI) for tests: bb is the only thread runtime, so thread, worker and reconciler tests
// run on this instead of a daemon. It answers the commands lib/thread/bb.ts issues, keeps each bb thread as a file
// under FAKE_BB_DIR and logs every call. A spawned thread stays "active" until stopped; no pi ever runs.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface FakeBbThread { id: string; status: string; archivedAt: number | null; parentThreadId: string | null; environment: string; title: string; prompt: string; tells: string[]; tellAt?: number[]; events?: { seq: number; type: string; createdAt: number; data: object }[]; output?: string }

const dir = () => process.env.FAKE_BB_DIR!;
const threadFile = (id: string) => join(dir(), "thread-" + id + ".json");

/** Point BB_CLI at a fresh fake under root; the caller's env isolation (BB_* cleared) comes first. */
export function fakeBb(root: string) {
	const state = join(root, "fake-bb");
	mkdirSync(state, { recursive: true });
	const cli = join(state, "bb");
	writeFileSync(cli, "#!/bin/sh\nexec " + JSON.stringify(process.execPath) + " " + JSON.stringify(import.meta.path) + ' "$@"\n');
	chmodSync(cli, 0o755);
	Object.assign(process.env, { BB_CLI: cli, FAKE_BB_DIR: state });
	return { dir: state, calls: () => calls(state), threads: () => threads(state), setStatus: (environment: string, status: string) => setStatus(state, environment, status),
		completeTurn: (environment: string, text: string, status = "completed") => completeTurn(state, environment, text, status),
		addThread: (id: string, environment?: string) => addThread(state, id, environment) };
}

export const calls = (state: string): string[][] => existsSync(join(state, "calls.log"))
	? readFileSync(join(state, "calls.log"), "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l) as string[]) : [];
export const threads = (state: string): FakeBbThread[] => readdirSync(state).filter(f => f.startsWith("thread-")).map(f => JSON.parse(readFileSync(join(state, f), "utf8")) as FakeBbThread);

/** What bb reports once a pi has ended its turn: the thread in environment is no longer working. */
export function setStatus(state: string, environment: string, status: string): void {
	for (const t of threads(state)) if (t.environment === environment) writeFileSync(join(state, "thread-" + t.id + ".json"), JSON.stringify({ ...t, status }));
}

/** A pi ending its turn with text: bb logs a turn/completed event, keeps the text as the thread's output, and the thread goes idle.
 * With status failed the text is the provider's error, logged before the completion as bb does. */
export function completeTurn(state: string, environment: string, text: string, status = "completed"): void {
	for (const t of threads(state)) if (t.environment === environment) {
		const events = t.events ?? [];
		const seq = (events.at(-1)?.seq ?? 0) + 1;
		const added = [...(status === "failed" ? [{ seq, type: "provider/error", createdAt: Date.now(), data: { message: "Provider error", detail: text } }] : []),
			{ seq: seq + (status === "failed" ? 1 : 0), type: "turn/completed", createdAt: Date.now(), data: { status } }];
		writeFileSync(join(state, "thread-" + t.id + ".json"), JSON.stringify({ ...t, status: "idle", ...(status === "failed" ? {} : { output: text }), events: [...events, ...added] }));
	}
}

/** A bb thread that exists without a spawn, e.g. the thread that owns a reconciler. */
export function addThread(state: string, id: string, environment = ""): void {
	writeFileSync(join(state, "thread-" + id + ".json"), JSON.stringify({ id, status: "idle", archivedAt: null, parentThreadId: null, environment, title: id, prompt: "", tells: [] } satisfies FakeBbThread));
}

function main(argv: string[]) {
	const args = argv.filter(a => a !== "--json");
	appendFileSync(join(dir(), "calls.log"), JSON.stringify(args) + "\n");
	const flag = (name: string) => { const i = args.indexOf("--" + name); return i < 0 ? undefined : args[i + 1]; };
	const out = (value: unknown) => void console.log(JSON.stringify(value));
	const fail = (message: string) => { out({ ok: false, error: { message } }); process.exit(1); };
	const [group, action, id] = args;
	const load = (): FakeBbThread => existsSync(threadFile(id!)) ? JSON.parse(readFileSync(threadFile(id!), "utf8")) : fail("thread not found: " + id);
	const save = (t: FakeBbThread) => writeFileSync(threadFile(t.id), JSON.stringify(t));
	if (group === "project") {
		const file = join(dir(), "projects.json");
		const all: { id: string; sources: { path: string }[] }[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
		if (action === "list") return out(all);
		const project = { id: "project-" + all.length, sources: [{ path: flag("root")! }] };
		writeFileSync(file, JSON.stringify([...all, project]));
		return out(project);
	}
	if (group === "environment" && (action === "update" || action === "delete")) return out({ ok: true });
	if (group !== "thread") return fail("unsupported: " + args.join(" "));
	switch (action) {
		case "spawn": {
			const created: FakeBbThread = { id: "bbt-" + crypto.randomUUID().slice(0, 8), status: "active", archivedAt: null, parentThreadId: flag("parent-thread") ?? null,
				environment: flag("environment")!, title: flag("title") ?? "", prompt: readFileSync(flag("prompt-file")!, "utf8"), tells: [] };
			save(created);
			return out({ id: created.id, environmentId: created.environment });
		}
		case "list": return out(threads(dir()));
		case "show": { const t = load(); return out({ thread: { ...t, environmentId: t.environment } }); }
		case "stop": { const t = load(); save({ ...t, status: "idle" }); return out({ ok: true }); }
		case "archive": { const t = load(); save({ ...t, archivedAt: Date.now() }); return out({ ok: true }); }
		case "tell": { const t = load(); const file = flag("message-file"); save({ ...t, tells: [...t.tells, file ? readFileSync(file, "utf8") : args[3]!], tellAt: [...(t.tellAt ?? []), Date.now()] }); return out({ ok: true }); }
		case "output": return out({ output: load().output ?? "" });
		case "log": {
			const t = load();
			if (!argv.includes("--json")) return void console.log([t.prompt, ...t.tells].join("\n"));
			const after = Number(flag("after-seq") ?? 0);
			return out((t.events ?? []).filter(e => e.seq > after));
		}
		case "wait": case "open": return out({ ok: true });
		default: return fail("unsupported: " + args.join(" "));
	}
}
if (import.meta.main) main(process.argv.slice(2));
