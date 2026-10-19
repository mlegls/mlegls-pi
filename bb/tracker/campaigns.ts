// The Campaigns page's model, computed on the server: docs/departments.md parsed, rolled up over the tracker snapshot,
// stage history from git, the reconcilers in flight, and the repository's own facts command (production, promises).
// It reads only; departments.md is changed by agents in threads the page starts.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { slugify, WEEKS, type Bar, type CampaignView, type Campaigns, type DepartmentView, type InFlight, type Issue, type Level, type PromiseView, type ReconcilerException, type Snapshot } from "./model";

const run = promisify(execFile);
const DAY = 86_400_000;
export const DEPARTMENTS = join("docs", "departments.md");

// ---- docs/departments.md

interface ParsedPromise { text: string; check: string | null; confirmed: string | null }
interface ParsedCampaign { title: string; outcome: string; bars: Bar[]; tracks: string[]; patterns: string[] }
interface ParsedDepartment { name: string; attention: string; promises: ParsedPromise[]; campaigns: ParsedCampaign[] }
export interface Parsed { facts: string | null; departments: ParsedDepartment[] }

const link = /\[\[(?:[^\]|]*\/)?([^/\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Departments are ## sections; each opens with its attention, may list Ops promises (- text check: name |
 * confirmed: date), then ranks campaigns as ### sections with an outcome line, - [ ] bars and a Tracks: line of issue
 * links and backticked slug patterns. Frontmatter facts: names the repository's facts command. */
export function parseDepartments(text: string): Parsed {
	const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
	const facts = fm ? (/^facts:\s*"?(.+?)"?\s*$/m.exec(fm[1])?.[1] ?? null) : null;
	const departments = (fm ? text.slice(fm[0].length) : text).split(/^## /m).slice(1).map((section) => {
		const [name = "", ...rest] = section.split("\n");
		const [intro = "", ...campaignTexts] = rest.join("\n").split(/^### /m);
		const promises = [...intro.matchAll(/^- (.+?)(?: check: (\S+)| confirmed: (\S+))?$/gm)].map((m) => ({ text: m[1], check: m[2] ?? null, confirmed: m[3] ?? null }));
		const campaigns = campaignTexts.map((body) => {
			const [title = "", ...lines] = body.split("\n");
			const paragraphs = lines.join("\n").split(/\n\s*\n/).map((p) => p.trim());
			const tracks = paragraphs.find((p) => p.startsWith("Tracks:")) ?? "";
			return {
				title: title.trim(),
				outcome: paragraphs.find((p) => p && !p.startsWith("- ") && !p.startsWith("Tracks:")) ?? "",
				bars: [...lines.join("\n").matchAll(/^- \[( |x)\] (.+)$/gm)].map((m) => ({ text: m[2], met: m[1] === "x" })),
				tracks: [...tracks.matchAll(link)].map((m) => m[1]),
				patterns: [...tracks.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
			};
		});
		return { name: name.trim(), attention: intro.trim().split(/\n\s*\n/)[0] ?? "", promises, campaigns };
	});
	return { facts, departments };
}

// ---- stage history from git, extended incrementally per HEAD

interface Change { date: string; slug: string; stage: string }
/** last: each issue's latest stage seen, so a file restored, moved or requoted isn't read as a change. */
interface History { head: string; since: string; changes: Change[]; last: Map<string, string> }
const histories = new Map<string, History>();
const pending = new Map<string, Promise<History>>();

function git(root: string, ...args: string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 }).trim();
}

/** Stage lines each commit on the first-parent line wrote (a merge as its net change), oldest first: per issue, the
 * stage it removed (if any) and the one it added. Branch commits would replay a branch's own restores as regressions. */
async function readStages(root: string, range: string[]): Promise<{ date: string; slug: string; from: string | null; to: string }[]> {
	const { stdout } = await run("git", ["-C", root, "log", "--first-parent", "--diff-merges=first-parent", ...range, "--format=%x01%cs", "-p", "--unified=0", "-G^stage:", "--", "docs/issues"], { maxBuffer: 256 * 1024 * 1024, timeout: 120_000 });
	const out: { date: string; slug: string; from: string | null; to: string }[] = [];
	const stageOf = (line: string) => line.replace(/^[+-]stage:\s*"?([^"\s]*).*$/, "$1");
	const slugOf = (line: string) => line.slice(4).replace(/^[ab]\//, "").split("/").pop()?.replace(/\.md$/, "") ?? "";
	for (const commit of stdout.split("\x01").slice(1).reverse()) {
		const date = commit.slice(0, 10);
		const from = new Map<string, string>();
		const to = new Map<string, string>();
		let minus = "";
		let plus = "";
		for (const line of commit.split("\n")) {
			if (line.startsWith("--- ")) minus = slugOf(line);
			else if (line.startsWith("+++ ")) plus = slugOf(line);
			else if (line.startsWith("-stage:") && minus) from.set(minus, stageOf(line));
			else if (line.startsWith("+stage:") && plus) to.set(plus, stageOf(line));
		}
		for (const [slug, stage] of to) out.push({ date, slug, from: from.get(slug) ?? null, to: stage });
	}
	return out;
}

/** The stage changes of the last WEEKS weeks, oldest first, or null while the first read is still running. */
export function history(root: string): Change[] | null {
	const head = git(root, "rev-parse", "HEAD");
	const known = histories.get(root);
	if (known?.head === head) return known.changes;
	if (!pending.has(root)) {
		const since = new Date(Date.now() - WEEKS * 7 * DAY).toISOString().slice(0, 10);
		const incremental = known && known.since <= since && git(root, "merge-base", "--is-ancestor", known.head, head) === "" ? known : null;
		const job = readStages(root, incremental ? [known!.head + ".." + head] : ["--since=" + since])
			.then((stages) => {
				const last = new Map(incremental?.last ?? []);
				const fresh: Change[] = [];
				for (const s of stages) {
					if (s.to !== (last.get(s.slug) ?? s.from)) fresh.push({ date: s.date, slug: s.slug, stage: s.to });
					last.set(s.slug, s.to);
				}
				const changes = [...(incremental?.changes ?? []), ...fresh].filter((c) => c.date >= since);
				const h = { head, since: incremental?.since ?? since, changes, last };
				histories.set(root, h);
				return h;
			})
			.finally(() => pending.delete(root));
		job.catch(() => {});
		pending.set(root, job);
	}
	return known?.changes ?? null;
}
export const historyReady = (root: string) => pending.get(root);

// ---- reconcilers in flight

function alive(pid: unknown): boolean {
	try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

export function reconcilers(root: string): { inFlight: Map<string, InFlight>; exceptions: ReconcilerException[] } {
	const inFlight = new Map<string, InFlight>();
	const exceptions: ReconcilerException[] = [];
	let dir: string;
	try { dir = join(resolve(root, git(root, "rev-parse", "--git-common-dir")), "reconcile"); } catch { return { inFlight, exceptions }; }
	for (const file of existsSync(dir) ? readdirSync(dir) : []) {
		if (!file.endsWith(".json")) continue;
		let state: { root?: string; pid?: unknown; owner?: string; chains?: Record<string, { phase?: string; handle?: { bb?: string } }>; exceptions?: Record<string, unknown> };
		try { state = JSON.parse(readFileSync(join(dir, file), "utf8")); } catch { continue; }
		if (!state.pid || !alive(state.pid)) continue;
		for (const [slug, chain] of Object.entries(state.chains ?? {})) inFlight.set(slug, { slug, phase: chain.phase ?? "running", threadId: chain.handle?.bb ?? null });
		const owner = state.owner?.startsWith("thr_") ? state.owner : null;
		for (const node of Object.keys(state.exceptions ?? {})) exceptions.push({ root: state.root ?? file.replace(/\.json$/, ""), node, ownerThread: owner });
	}
	return { inFlight, exceptions };
}

// ---- the repository's facts command: { checks: { name: { level, note } }, notes: { department: [markdown line] } }

export interface Facts { at: number | null; error: string | null; checks: Record<string, { level: Level; note: string }>; notes: Record<string, string[]> }
const facts = new Map<string, { command: string; value: Facts }>();
const factsRunning = new Map<string, Promise<void>>();
const FACTS_TTL = 10 * 60_000;
const levels = new Set(["ok", "risk", "broken", "unknown"]);

export function readFacts(root: string, command: string | null, force: boolean, onFresh: () => void): Facts {
	const empty: Facts = { at: null, error: null, checks: {}, notes: {} };
	if (!command) return empty;
	const known = facts.get(root);
	const stale = !known || known.command !== command || Date.now() - (known.value.at ?? 0) > FACTS_TTL;
	if ((stale || force) && !factsRunning.has(root)) {
		const job = run(process.env.SHELL || "/bin/zsh", ["-lc", command], { cwd: root, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
			.then(({ stdout }) => {
				const raw = JSON.parse(stdout) as { checks?: Record<string, { level?: string; note?: string }>; notes?: Record<string, unknown> };
				const checks: Facts["checks"] = {};
				for (const [name, c] of Object.entries(raw.checks ?? {})) checks[name] = { level: (levels.has(String(c.level)) ? c.level : "unknown") as Level, note: String(c.note ?? "") };
				const notes: Facts["notes"] = {};
				for (const [name, lines] of Object.entries(raw.notes ?? {})) if (Array.isArray(lines)) notes[name] = lines.map(String);
				facts.set(root, { command, value: { at: Date.now(), error: null, checks, notes } });
			}, (e: unknown) => {
				const error = (e instanceof Error ? e.message : String(e)).slice(0, 400);
				facts.set(root, { command, value: { ...(known?.value ?? empty), at: Date.now(), error } });
			})
			.finally(() => { factsRunning.delete(root); onFresh(); });
		factsRunning.set(root, job);
	}
	return known?.command === command ? known.value : empty;
}

// ---- the rollup

const glob = (pattern: string) => new RegExp("^" + pattern.replace(/[.+?^$(){}|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const isDone = (i: Issue) => i.done || i.archived;
const bucket = (i: Issue): "done" | "settled" | "idea" | null => (isDone(i) ? "done" : i.legacy || !i.ownStage ? null : i.ownStage === "idea" ? "idea" : "settled");

export function rollup(snap: Snapshot, parsed: Parsed | null, changes: Change[] | null, flight: ReturnType<typeof reconcilers>, f: Facts, command: string | null): Campaigns {
	const bySlug = new Map(snap.issues.map((i) => [i.slug, i]));
	const kids = new Map<string, string[]>();
	for (const i of snap.issues) if (i.partOf) kids.set(i.partOf, [...(kids.get(i.partOf) ?? []), i.slug]);
	const subtree = (slug: string, into: Set<string>) => {
		if (into.has(slug)) return;
		into.add(slug);
		for (const k of kids.get(slug) ?? []) subtree(k, into);
	};
	const now = Date.now();
	const weekAgo = new Date(now - 7 * DAY).toISOString().slice(0, 10);
	const lastChange = new Map<string, string>();
	const doneOn = new Map<string, string>();
	for (const c of changes ?? []) {
		lastChange.set(c.slug, c.date);
		if (c.stage === "done") doneOn.set(c.slug, c.date);
	}
	const covered = new Set<string>();

	const departments: DepartmentView[] = (parsed?.departments ?? []).map((d) => {
		const dkey = slugify(d.name);
		const promises: PromiseView[] = d.promises.map((p) => {
			const key = dkey + "/" + slugify(p.text);
			if (p.confirmed) {
				const days = Math.floor((now - Date.parse(p.confirmed)) / DAY);
				return { key, text: p.text, level: days > 30 ? "risk" : "ok", note: days > 30 ? "last confirmed " + p.confirmed + "; confirm again" : "confirmed " + p.confirmed };
			}
			const c = p.check ? f.checks[p.check] : undefined;
			return { key, text: p.text, level: c?.level ?? "unknown", note: c?.note ?? (p.check ? (f.at ? "the facts command has no check " + p.check : "checking…") : "no check or confirmation") };
		});
		const campaigns: CampaignView[] = d.campaigns.map((c, n) => {
			const roots = [...new Set([...c.tracks.filter((s) => bySlug.has(s)), ...snap.issues.filter((i) => c.patterns.some((p) => glob(p).test(i.slug))).map((i) => i.slug)])];
			const members = new Set<string>();
			for (const r of roots) subtree(r, members);
			for (const m of members) covered.add(m);
			const counts = { done: 0, settled: 0, idea: 0 };
			const weekly = Array.from({ length: WEEKS }, () => 0);
			let moved: string | null = null;
			let landedThisWeek = 0;
			for (const slug of members) {
				const i = bySlug.get(slug);
				if (!i) continue;
				const b = bucket(i);
				if (b) counts[b]++;
				const last = lastChange.get(slug);
				if (last && (!moved || last > moved)) moved = last;
				const done = isDone(i) ? doneOn.get(slug) : undefined;
				if (done) {
					const week = Math.floor((now - Date.parse(done)) / (7 * DAY));
					if (week < WEEKS) weekly[WEEKS - 1 - week]++;
					if (done >= weekAgo) landedThisWeek++;
				}
			}
			const met = c.bars.filter((b) => b.met).length;
			return {
				key: dkey + "/" + slugify(c.title), rank: n + 1, title: c.title, outcome: c.outcome, bars: c.bars,
				state: !c.bars.length ? "ongoing" : met === c.bars.length ? "done" : met + " of " + c.bars.length + " bars met",
				roots, members: [...members].sort(), missing: c.tracks.filter((s) => !bySlug.has(s)),
				counts, landedThisWeek, moved, weekly,
				inFlight: [...members].flatMap((s) => (flight.inFlight.has(s) ? [flight.inFlight.get(s)!] : [])),
			};
		});
		return { key: dkey, name: d.name, attention: d.attention, promises, campaigns, notes: f.notes[d.name] ?? [] };
	});

	const openParent = (i: Issue) => { const p = i.partOf ? bySlug.get(i.partOf) : undefined; return !!p && !isDone(p); };
	const loose = snap.issues.filter((i) => !isDone(i) && !i.legacy && i.ownStage && !covered.has(i.slug) && !openParent(i)).map((i) => i.slug).sort();
	return {
		root: snap.root, repo: snap.repo, file: parsed ? DEPARTMENTS : null, at: now, departments, loose,
		exceptions: flight.exceptions, history: changes !== null,
		facts: { at: f.at, error: f.error, command },
	};
}

/** What a thread about one element of the page needs to know: the element, where it comes from, and how to change it. */
export function mentionContext(c: Campaigns, snap: Snapshot, kind: string, key: string): string {
	const repo = snap.repo;
	const wikilink = (slug: string) => "[[projects/" + repo + "/issues/" + slug + "]]";
	const file = join(c.root, DEPARTMENTS);
	const preface = "From the Campaigns page over " + file + ": the maintainer's departments (perspectives on the project) and each one's ranked campaigns, top-down progress views over the tracker. The file records the maintainer's decisions; change it when a decision is made in conversation, and keep counts out of it (the page computes them).";
	if (kind === "loose") return preface + "\n\nOpen issues no campaign tracks (" + c.loose.length + "). Propose, for each, the campaign that should track it (a Tracks: entry), or why none should:\n" + c.loose.map((s) => "- " + wikilink(s)).join("\n");
	const d = c.departments.find((x) => key === x.key || key.startsWith(x.key + "/"));
	if (!d) throw new Error("no " + kind + " " + key);
	const campaignLines = (x: CampaignView) => [
		"### " + x.rank + ". " + x.title + " (" + x.state + ")",
		x.outcome,
		...x.bars.map((b) => "- [" + (b.met ? "x" : " ") + "] " + b.text),
		"Progress: " + x.counts.done + " done, " + x.counts.settled + " settled (goal/spec/ticket), " + x.counts.idea + " ideas; " + x.landedThisWeek + " landed this week; last moved " + (x.moved ?? "over " + WEEKS + " weeks ago") + ".",
		x.inFlight.length ? "In flight: " + x.inFlight.map((f) => f.slug + " (" + f.phase + ")").join(", ") : "",
		"Tracks: " + x.roots.map(wikilink).join(" "),
	].filter(Boolean).join("\n");
	const head = "## " + d.name + "\n" + d.attention;
	if (kind === "department") return [preface, head, ...d.promises.map((p) => "- " + p.text + ": " + p.level + ", " + p.note), ...d.notes, ...d.campaigns.map(campaignLines)].join("\n\n");
	if (kind === "promise") {
		const p = d.promises.find((x) => x.key === key);
		if (!p) throw new Error("no promise " + key);
		return [preface, head, "Promise: " + p.text + "\nStatus: " + p.level + ", " + p.note + (c.facts.command ? "\nChecked by the facts command: " + c.facts.command : "")].join("\n\n");
	}
	const x = d.campaigns.find((y) => y.key === key);
	if (!x) throw new Error("no campaign " + key);
	const open = snap.issues.filter((i) => x.members.includes(i.slug) && !isDone(i));
	const openLines = open.map((i) => "- " + wikilink(i.slug) + " (" + (i.ownStage ?? "container") + (i.assignee ? ", " + i.assignee : "") + ")");
	return [preface, head, campaignLines(x), open.length ? "Open members:\n" + openLines.join("\n") : "No open members."].join("\n\n");
}
