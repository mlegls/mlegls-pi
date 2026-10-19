// STATUS.md at the root of a reconciler's target checkout (docs/issues/reconciler-writes-status-md.md): progress the
// maintainer reads in bb without a supervisor turn. Regenerated whole from every run's state into that checkout on each
// state write, so reconcilers sharing a checkout never clobber each other.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { git } from "./checks.ts";
import { bbIndex } from "../thread/registry.ts";
import type { State } from "./reconcile.ts";

const DONE_SHOWN = 10;

/** The log line's timestamp and text, for its newest line naming slug as itself or one of its worker handles. */
function lastEvent(slug: string, log: string[]): { at: string; text: string } | undefined {
	const esc = slug.replace(/[.*+?^$\{}()|[\]\\]/g, "\\$&");
	const re = new RegExp("(?<![a-z0-9-])" + esc + "(?![a-z0-9-])|(?<![a-z0-9-])" + esc + "-(?:refine|implement|drive|review|handler|pr-repair)-[0-9a-z]+(?![a-z0-9-])");
	for (let i = log.length - 1; i >= 0; i--) {
		const line = log[i];
		const text = line.slice(20);
		if (re.test(text)) return { at: line.slice(0, 19), text };
	}
	return undefined;
}
const short = (at: string | undefined) => at ? at.slice(5, 16).replace("T", " ") : "";
const oneLine = (s: string, n = 160) => { const l = s.split("\n")[0].trim(); return l.length > n ? l.slice(0, n - 1) + "…" : l; };

export interface StatusOptions {
	/** bb thread ids by registry thread id (bbIndex()). */
	bb?: Record<string, { bb: string }>;
	/** Whether a run's process lives; unknown when omitted. */
	alive?: (pid: number) => boolean;
}

/** Markdown for every reconciler run into one checkout. Times are UTC, as the log records them. */
export function renderStatus(states: State[], o: StatusOptions = {}): string {
	const bb = o.bb ?? {};
	const worker = (threadId?: string) => threadId && bb[threadId] ? "@thread:" + bb[threadId].bb : undefined;
	const running = states.filter(s => !s.finished).sort((a, b) => (b.log?.at(-1) ?? "").localeCompare(a.log?.at(-1) ?? ""));
	const done = states.filter(s => s.finished).map(s => ({ s, at: s.landed?.[s.root]?.at?.slice(0, 19) ?? s.log?.at(-1)?.slice(0, 19) ?? "" }))
		.sort((a, b) => b.at.localeCompare(a.at));
	const out: string[] = ["# Reconciler status", "", "Written by the reconcilers into this checkout; what needs the maintainer is in ATTENTION.md. Times UTC.", ""];
	if (!running.length) out.push("No reconciler is running.", "");
	for (const s of running) {
		const stale = s.pid && o.alive && !o.alive(s.pid) ? " (reconciler not running; its state resumes on start)" : s.stopping ? " (stopping)" : "";
		out.push("## " + s.root + stale, "");
		const rows: { at: string; line: string }[] = [];
		const nodes = new Set([...Object.keys(s.chains ?? {}), ...Object.keys(s.exceptions ?? {})]);
		for (const slug of nodes) {
			const c = s.chains[slug], ex = s.exceptions[slug];
			const ev = lastEvent(slug, s.log ?? []);
			const parts = ["**" + slug + "**", c ? c.phase : "exception"];
			const w = worker(c?.handle?.threadId);
			if (w) parts.push(w);
			else if (c?.handle) parts.push(c.handle.handle);
			if (ex) parts.push(ex.level === "owner" ? "waiting on the supervisor: " + oneLine(ex.reason) : "exception (" + oneLine(ex.reason) + ") with the handler for " + ex.level + (worker(ex.handler?.threadId) ? " " + worker(ex.handler?.threadId) : ""));
			else if (c?.waitingSince) parts.push("waiting on its process since " + short(c.waitingSince));
			if (ev) parts.push(short(ev.at) + " " + oneLine(ev.text));
			const at = [ev?.at ?? "", ex?.at?.slice(0, 19) ?? "", c?.launchedAt ? new Date(c.launchedAt).toISOString().slice(0, 19) : ""].sort().at(-1)!;
			rows.push({ at, line: "- " + parts.join(" · ") });
		}
		for (const [slug, l] of Object.entries(s.landed ?? {})) if (!nodes.has(slug))
			rows.push({ at: l.at.slice(0, 19), line: "- **" + slug + "** · landed " + short(l.at) });
		rows.sort((a, b) => b.at.localeCompare(a.at));
		out.push(...(rows.length ? rows.map(r => r.line) : ["- (nothing launched yet)"]), "");
	}
	if (done.length) {
		out.push("## Done", "");
		for (const { s, at } of done.slice(0, DONE_SHOWN)) out.push("- " + s.root + " · " + (s.finished === "done" ? "landed" : s.finished) + " " + short(at));
		if (done.length > DONE_SHOWN) out.push("- …and " + (done.length - DONE_SHOWN) + " earlier");
		out.push("");
	}
	return out.join("\n");
}

const cache = new Map<string, { mtimeMs: number; state: State }>();
const excluded = new Set<string>();

/** Every run's state into cwd, from the repository's shared reconcile state directory. */
function statesInto(cwd: string): State[] {
	const dir = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "reconcile");
	if (!existsSync(dir)) return [];
	const out: State[] = [];
	for (const f of readdirSync(dir)) {
		if (!/^[^.]+\.json$/.test(f)) continue;
		const file = join(dir, f);
		try {
			const mtimeMs = statSync(file).mtimeMs;
			let hit = cache.get(file);
			if (!hit || hit.mtimeMs !== mtimeMs) { hit = { mtimeMs, state: JSON.parse(readFileSync(file, "utf8")) }; cache.set(file, hit); }
			if (resolve(hit.state.cwd) === cwd) out.push(hit.state);
		} catch {}
	}
	return out;
}

function ensureExcluded(cwd: string) {
	if (excluded.has(cwd)) return;
	const file = resolve(cwd, git(cwd, "rev-parse", "--git-path", "info/exclude"));
	const text = existsSync(file) ? readFileSync(file, "utf8") : "";
	if (!/^\/?STATUS\.md$/m.test(text)) { mkdirSync(dirname(file), { recursive: true }); appendFileSync(file, (text && !text.endsWith("\n") ? "\n" : "") + "STATUS.md\n"); }
	excluded.add(cwd);
}

const pidAlive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (e) { return (e as { code?: string }).code === "EPERM"; } };

/** Regenerate cwd's STATUS.md from every run into it; writes only on change. */
export function writeStatus(cwd: string): void {
	cwd = resolve(cwd);
	if (!existsSync(cwd)) return;
	ensureExcluded(cwd);
	const text = renderStatus(statesInto(cwd), { bb: bbIndex(), alive: pidAlive });
	const file = join(cwd, "STATUS.md");
	if (existsSync(file) && readFileSync(file, "utf8") === text) return;
	writeFileSync(file, text);
}
