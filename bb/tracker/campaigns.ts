// The Campaigns page's model, computed on the server: docs/departments.md parsed, rolled up over the tracker snapshot,
// stage history from git, the reconcilers in flight, and the repository's own facts command (production, promises).
// It reads only; departments.md is changed by agents in threads the page starts.
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { chartStart, kindOf, slugify, weekIndex, WEEKS, type Activity, type Bar, type CampaignView, type Campaigns, type DepartmentView, type InFlight, type Issue, type Level, type PromiseView, type ReconcilerException, type Snapshot } from "./model";

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

/** base: the tip main moved from, when it moved onto commit without extending it (a fast-forward onto a branch). */
interface Change { date: string; slug: string; stage: string; commit: string; base: string | null }
/** last: each issue's latest stage seen, so a file restored, moved or requoted isn't read as a change. */
interface History { head: string; upto: number; since: string; changes: Change[]; last: Map<string, string>; subjects: Map<string, string> }
const histories = new Map<string, History>();
const pending = new Map<string, Promise<History>>();

function git(root: string, ...args: string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 }).trim();
}

type Stage = { date: string; commit: string; subject: string; slug: string; from: string | null; to: string; added: boolean; base: string | null };

function gitIn(root: string, args: string[], input: string): Promise<string> {
	return new Promise((done, fail) => {
		const child = spawn("git", ["-C", root, ...args], { stdio: ["pipe", "pipe", "ignore"] });
		const chunks: Buffer[] = [];
		child.stdout.on("data", (c: Buffer) => chunks.push(c));
		child.on("error", fail);
		child.on("close", (code) => (code === 0 ? done(Buffer.concat(chunks).toString("utf8")) : fail(new Error("git " + args[0] + " exited " + code))));
		child.stdin.end(input);
	});
}

interface Step { hash: string; date: string; base: string | null; record: boolean; action: string }

const localDay = (ms: number) => { const d = new Date(ms); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/** Each time main's tip moved after the step at stopAt (or since the window opened), oldest first, dated when it
 * moved: main's reflog records fast-forwards onto branches, merges and direct commits alike, so a change is dated
 * when it reached main and diffed against the tip before it. Resets and rebases move the tip without landing work.
 * Without a reflog, first parents stand in. */
async function mainSteps(root: string, since: string, stopAt: number): Promise<{ steps: Step[]; upto: number }> {
	let log = "";
	try { log = (await run("git", ["-C", root, "reflog", "show", "--date=unix", "--format=%H%x1f%gd%x1f%gs", "main"], { maxBuffer: 64 * 1024 * 1024 })).stdout; } catch {}
	const entries = log.split("\n").filter(Boolean).map((l) => {
		const [hash = "", selector = "", action = ""] = l.split("\x1f");
		return { hash, at: Number(/\{(\d+)\}/.exec(selector)?.[1] ?? 0) * 1000, action };
	}).reverse();
	if (entries.length > 1) {
		const steps: Step[] = [];
		for (let i = 1; i < entries.length; i++) {
			const e = entries[i];
			if (e.at <= stopAt || localDay(e.at) < since) continue;
			steps.push({ hash: e.hash, date: localDay(e.at), base: entries[i - 1].hash, record: !/^(reset|rebase)/.test(e.action), action: e.action });
		}
		return { steps, upto: entries.at(-1)!.at };
	}
	const { stdout } = await run("git", ["-C", root, "log", "--first-parent", "--format=%H%x1f%P%x1f%ct", "HEAD"], { maxBuffer: 64 * 1024 * 1024 });
	const steps: Step[] = [];
	for (const l of stdout.split("\n").filter(Boolean)) {
		const [hash = "", parents = "", ct = "0"] = l.split("\x1f");
		const at = Number(ct) * 1000;
		if (at <= stopAt || localDay(at) < since) break;
		steps.push({ hash, date: localDay(at), base: parents.split(" ")[0] || null, record: true, action: "" });
	}
	return { steps: steps.reverse(), upto: Date.now() };
}

/** Stage lines each step wrote against the tip before it, oldest first: per issue, the stage it removed (if any), the
 * one it added, and whether the file was new. A step whose tip extends the one before is read in one batched log. */
async function readStages(root: string, since: string, stopAt: number): Promise<{ stages: Stage[]; upto: number }> {
	const { steps, upto } = await mainSteps(root, since, stopAt);
	const recorded = steps.filter((s) => s.record && s.base);
	const format = "--format=%x01%H%x1f%s";
	const patch = ["-p", "--unified=0", "-G^stage:", "--", "docs/issues"];
	const parents = new Map<string, string>();
	if (recorded.length) {
		const text = await gitIn(root, ["log", "--stdin", "--no-walk=unsorted", "--format=%H %P"], recorded.map((s) => s.hash).join("\n") + "\n");
		for (const l of text.split("\n")) { const [h, p] = l.split(" "); if (h && p) parents.set(h, p); }
	}
	const extends_ = (s: Step) => parents.get(s.hash) === s.base;
	const blocks = new Map<string, string>();
	const ordinary = [...new Set(recorded.filter(extends_).map((s) => s.hash))];
	const text = ordinary.length ? await gitIn(root, ["log", "--stdin", "--no-walk=unsorted", "--diff-merges=first-parent", format, ...patch], ordinary.join("\n") + "\n") : "";
	for (const block of text.split("\x01").slice(1)) blocks.set(block.slice(0, 40), block);
	// A jump (main moved onto a commit that doesn't extend its tip, as a fast-forward onto a branch) is the landing of
	// everything between: label it with the reflog's account of the move, not the tip's own subject.
	const jumps = new Map<string, string>();
	const pendingJumps = [...new Map(recorded.filter((x) => !extends_(x)).map((s) => [s.base + ".." + s.hash, s])).values()];
	const diffJump = async (s: Step) => {
		const { stdout: diff } = await run("git", ["-C", root, "diff", "--unified=0", "-G^stage:", s.base!, s.hash, "--", "docs/issues"], { maxBuffer: 64 * 1024 * 1024 });
		jumps.set(s.base + ".." + s.hash, s.hash + "\x1f" + (s.action || "landed " + s.hash.slice(0, 8)) + "\n" + diff);
	};
	for (let i = 0; i < pendingJumps.length; i += 8) await Promise.all(pendingJumps.slice(i, i + 8).map(diffJump));
	const stages: Stage[] = [];
	const stageOf = (l: string) => l.replace(/^[+-]stage:\s*"?([^"\s]*).*$/, "$1");
	const slugOf = (l: string) => l.slice(4).replace(/^[ab]\//, "").split("/").pop()?.replace(/\.md$/, "") ?? "";
	for (const s of recorded) {
		const jump = !extends_(s);
		const block = jump ? jumps.get(s.base + ".." + s.hash) : blocks.get(s.hash);
		if (!block) continue;
		const [commit = "", subject = ""] = block.slice(0, block.indexOf("\n")).split("\x1f");
		const from = new Map<string, string>();
		const to = new Map<string, string>();
		const added = new Set<string>();
		let minus = "";
		let plus = "";
		let fresh = false;
		for (const l of block.split("\n")) {
			if (l.startsWith("--- ")) { minus = slugOf(l); fresh = l === "--- /dev/null"; }
			else if (l.startsWith("+++ ")) { plus = slugOf(l); if (fresh) added.add(plus); }
			else if (l.startsWith("-stage:") && minus) from.set(minus, stageOf(l));
			else if (l.startsWith("+stage:") && plus) to.set(plus, stageOf(l));
		}
		for (const [slug, stage] of to) stages.push({ date: s.date, commit, subject, slug, from: from.get(slug) ?? null, to: stage, added: added.has(slug) && !from.has(slug), base: jump ? s.base : null });
	}
	return { stages, upto };
}

/** The stage changes of the last WEEKS weeks, oldest first, or null while the first read is still running. */
export function history(root: string): Change[] | null {
	const head = git(root, "rev-parse", "HEAD");
	const known = histories.get(root);
	if (known?.head === head) return known.changes;
	if (!pending.has(root)) {
		const since = new Date(chartStart()).toISOString().slice(0, 10);
		const incremental = known && known.since === since ? known : null;
		const job = readStages(root, since, incremental?.upto ?? 0)
			.then(({ stages, upto }) => {
				const last = new Map(incremental?.last ?? []);
				const subjects = new Map(incremental?.subjects ?? []);
				const fresh: Change[] = [];
				for (const s of stages) {
					// A stage line added to an existing file is a format migration, not a change of stage.
					const migrated = s.from === null && !s.added && !last.has(s.slug);
					if (!migrated && s.to !== (last.get(s.slug) ?? s.from)) {
						fresh.push({ date: s.date, slug: s.slug, stage: s.to, commit: s.commit, base: s.base });
						subjects.set(s.commit, s.subject);
					}
					last.set(s.slug, s.to);
				}
				const changes = [...(incremental?.changes ?? []), ...fresh].filter((c) => c.date >= since);
				const h = { head, upto, since, changes, last, subjects };
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

/** Commit subjects, whether each is on origin/main yet, and a web link prefix for GitHub origins. */
export function commitLinks(root: string, hashes: Iterable<string>): { commits: Campaigns["commits"]; commitUrl: string | null } {
	const subjects = histories.get(root)?.subjects ?? new Map<string, string>();
	let unpushed = new Set<string>();
	try { unpushed = new Set(git(root, "rev-list", "origin/main..HEAD").split("\n").filter(Boolean)); } catch {}
	const changes = new Map((histories.get(root)?.changes ?? []).map((c) => [c.commit, c]));
	const commits: Campaigns["commits"] = {};
	for (const h of hashes) {
		const c = changes.get(h);
		commits[h] = { subject: subjects.get(h) ?? "", date: c?.date ?? "", pushed: !unpushed.has(h), base: c?.base ?? null };
	}
	let commitUrl: string | null = null;
	try {
		const m = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(git(root, "remote", "get-url", "origin"));
		if (m) commitUrl = "https://github.com/" + m[1] + "/" + m[2];
	} catch {}
	return { commits, commitUrl };
}

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
	const cited = new Set<string>();
	const scale = { day: 1, week: 1 };

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
				if (done && done >= weekAgo) landedThisWeek++;
			}
			const activity: Activity[] = (changes ?? []).flatMap((ch) => {
				const kind = members.has(ch.slug) ? kindOf(ch.stage) : null;
				return kind ? [{ date: ch.date, slug: ch.slug, kind, commit: ch.commit }] : [];
			});
			const perDay = new Map<string, number>();
			const perWeek = new Map<number, number>();
			for (const a of activity) {
				perDay.set(a.date, (perDay.get(a.date) ?? 0) + 1);
				const week = weekIndex(a.date);
				perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
				cited.add(a.commit);
			}
			scale.day = Math.max(scale.day, ...perDay.values());
			scale.week = Math.max(scale.week, ...perWeek.values());
			const met = c.bars.filter((b) => b.met).length;
			return {
				key: dkey + "/" + slugify(c.title), rank: n + 1, title: c.title, outcome: c.outcome, bars: c.bars,
				state: !c.bars.length ? "ongoing" : met === c.bars.length ? "done" : met + " of " + c.bars.length + " bars met",
				roots, members: [...members].sort(), missing: c.tracks.filter((s) => !bySlug.has(s)),
				counts, landedThisWeek, moved, activity,
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
		...commitLinks(snap.root, cited), scale,
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
