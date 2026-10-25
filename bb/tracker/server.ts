// Tracker: a read-only view of a project's vault tracker (docs/issues, the tracker skill) with the agent actions that
// matter: send a ready issue tree to a new or existing supervisor, start a shaping session on one that isn't, and
// discuss selected issues in a new thread with them mentioned. Issues are only written by agents, through the tracker.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync, watch, type FSWatcher } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { bun, pinTracker, pinnedTop, readIssue, snapshot, tracker, trackerRoot, type Cli } from "./tracker";
import { CAMPAIGN_MENTION, CHANGED, MENTION_PROVIDER, notReady, stageLabel, type Campaigns, type Snapshot } from "./model";
import { DEPARTMENTS, history, historyReady, mentionContext, parseDepartments, readFacts, reconcilers, rollup } from "./campaigns";

const projectSchema = z.object({ id: z.string(), name: z.string(), root: z.string(), hostId: z.string() });
export type TrackerProject = z.infer<typeof projectSchema>;
const supervisorSchema = z.object({
	threadId: z.string().nullable(),
	title: z.string(),
	status: z.string(),
	/** Issues this plugin sent it; empty for a role holder it didn't start. */
	issues: z.array(z.string()),
	/** Holds the supervisor role in desk/ROLES.md. */
	role: z.boolean(),
});
export type Supervisor = z.infer<typeof supervisorSchema>;
const slugs = z.array(z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i)).min(1).max(50);
const target = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("new") }),
	z.object({ kind: z.literal("thread"), threadId: z.string() }),
	z.object({ kind: z.literal("role") }),
]);
export type SuperviseTarget = z.infer<typeof target>;

export const rpcContract = defineRpcContract({
	projects: { input: z.null(), output: z.object({ projects: z.array(projectSchema) }) },
	snapshot: { input: z.object({ projectId: z.string() }), output: z.custom<Snapshot>() },
	issue: { input: z.object({ projectId: z.string(), slug: z.string() }), output: z.object({ frontmatter: z.string(), body: z.string(), path: z.string() }) },
	resolveLinks: { input: z.object({ projectId: z.string(), slug: z.string(), hrefs: z.array(z.string().max(8192)).max(200) }), output: z.array(z.object({ href: z.string(), target: z.union([z.object({ kind: z.literal("host"), hostId: z.string(), path: z.string() }), z.object({ kind: z.literal("workspace"), environmentId: z.string(), path: z.string() })]).nullable(), reason: z.string().nullable() })) },
	supervisors: { input: z.object({ projectId: z.string() }), output: z.object({ supervisors: z.array(supervisorSchema) }) },
	supervise: { input: z.object({ projectId: z.string(), slugs, target }), output: z.object({ threadId: z.string().nullable(), note: z.string() }) },
	refine: { input: z.object({ projectId: z.string(), slugs }), output: z.object({ threadId: z.string() }) },
	campaigns: { input: z.object({ projectId: z.string(), refresh: z.boolean().optional() }), output: z.custom<Campaigns>() },
});

const run = promisify(execFile);
const wikilink = (repo: string, slug: string) => "[[projects/" + repo + "/issues/" + slug + "]]";

export default async function plugin(bb: BbPluginApi) {
	const settings = bb.settings.define({
		trackerScript: { type: "string", label: "Tracker CLI", description: "The tracker skill's issues.ts; run from a copy pinned at its checkout's HEAD.", default: "~/.pi/agent/skills/tracker/scripts/issues.ts" },
		bun: { type: "string", label: "bun", description: "Path to bun; empty finds it through your login shell.", default: "" },
	});

	async function cli(): Promise<Cli> {
		const s = await settings.get();
		const live = String(s.trackerScript || "~/.pi/agent/skills/tracker/scripts/issues.ts").replace(/^~\//, homedir() + "/");
		return { bun: bun(String(s.bun ?? "")), script: pinTracker(live) };
	}

	// Projects: a bb project is tracked when one of its sources resolves to a vault.
	const roots = new Map<string, TrackerProject>();
	async function projects(): Promise<TrackerProject[]> {
		const list = await bb.sdk.projects.list();
		const out: TrackerProject[] = [];
		for (const p of list as unknown as { id: string; name: string; sources?: { path?: string | null; hostId: string }[] }[]) {
			for (const s of p.sources ?? []) {
				const root = s.path ? trackerRoot(s.path) : undefined;
				if (root) { const t = { id: p.id, name: p.name, root, hostId: s.hostId }; roots.set(p.id, t); out.push(t); break; }
			}
		}
		return out;
	}
	async function project(projectId: string): Promise<TrackerProject> {
		const hit = roots.get(projectId) ?? (await projects(), roots.get(projectId));
		if (!hit) throw new Error("project " + projectId + " has no docs/issues tracker");
		return hit;
	}

	// Snapshots are cached per root and dropped when anything under docs/issues changes.
	const cache = new Map<string, Promise<Snapshot>>();
	/** The last good snapshot per root, kept across invalidation so mention search never waits on the CLI. */
	const latest = new Map<string, Snapshot>();
	const watchers = new Map<string, FSWatcher>();
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	function watchRoot(root: string) {
		if (watchers.has(root)) return;
		try {
			const w = watch(join(root, "docs", "issues"), { recursive: true }, (_event, file) => {
				if (file && !String(file).endsWith(".md")) return;
				clearTimeout(timers.get(root));
				timers.set(root, setTimeout(() => { cache.delete(root); bb.realtime.publish(CHANGED, { root }); }, 300));
			});
			w.on("error", (e) => { bb.log.warn("watch " + root + ": " + e); watchers.delete(root); });
			watchers.set(root, w);
		} catch (e) { bb.log.warn("watch " + root + ": " + e); }
	}
	async function snap(root: string): Promise<Snapshot> {
		watchRoot(root);
		let hit = cache.get(root);
		if (!hit) {
			hit = cli().then((c) => snapshot(c, root));
			cache.set(root, hit);
			hit.then((s) => latest.set(root, s), (e) => { cache.delete(root); bb.log.warn("snapshot " + root + ": " + e); });
		}
		return hit;
	}
	bb.onDispose(() => { for (const w of watchers.values()) w.close(); for (const t of timers.values()) clearTimeout(t); });

	// Campaigns: docs/departments.md over the snapshot, git history, reconcilers and the repository's facts command.
	const ping = (root: string) => bb.realtime.publish(CHANGED, { root });
	function watchDepartments(root: string) {
		const key = root + "#departments";
		if (watchers.has(key)) return;
		try {
			const w = watch(join(root, "docs"), (_event, file) => { if (String(file) === "departments.md") ping(root); });
			w.on("error", () => watchers.delete(key));
			watchers.set(key, w);
		} catch (e) { bb.log.warn("watch departments " + root + ": " + e); }
	}
	async function campaigns(projectId: string, refresh = false): Promise<{ view: Campaigns; snap: Snapshot }> {
		const p = await project(projectId);
		watchDepartments(p.root);
		const s = await snap(p.root);
		const file = join(p.root, DEPARTMENTS);
		const parsed = existsSync(file) ? parseDepartments(readFileSync(file, "utf8")) : null;
		const changes = history(p.root);
		if (!changes) historyReady(p.root)?.then(() => ping(p.root), (e) => bb.log.warn("history " + p.root + ": " + e));
		const facts = readFacts(p.root, parsed?.facts ?? null, refresh, () => ping(p.root));
		return { view: rollup(s, parsed, changes, reconcilers(p.root), facts, parsed?.facts ?? null), snap: s };
	}

	/** Whether each slug can go to a supervisor now: the tracker's frontier (ready subtree, unblocked, unclaimed). */
	async function requireReady(root: string, wanted: string[]): Promise<Snapshot> {
		cache.delete(root);
		const s = await snap(root);
		const bySlug = new Map(s.issues.map((i) => [i.slug, i]));
		const why = wanted.flatMap((slug) => {
			const i = bySlug.get(slug);
			if (!i) return [slug + " not found"];
			return i.frontier ? [] : [slug + ": " + notReady(i)];
		});
		if (why.length) throw new Error("not ready for supervision. " + why.join("; "));
		return s;
	}

	// Supervisors: threads this plugin started, plus the standing role in the main checkout's desk/ROLES.md.
	async function roleHolder(root: string): Promise<string | undefined> {
		const c = await cli();
		const top = pinnedTop(c.script, String((await settings.get()).trackerScript || "~/.pi/agent/skills/tracker/scripts/issues.ts"));
		const code = "const { roleThread } = await import(process.argv[1]); console.log(roleThread('supervisor', process.argv[2]) ?? '');";
		const { stdout } = await run(c.bun, ["-e", code, join(top, "lib/desk.ts"), root], { timeout: 15_000 });
		return stdout.trim() || undefined;
	}
	async function supervisors(projectId: string): Promise<Supervisor[]> {
		const p = await project(projectId);
		const listed = (await bb.sdk.threads.list({ projectId, archived: false, includeHidden: true })) as unknown as { id: string; title: string | null; titleFallback?: string | null; status: string; providerId?: string; runtime?: { displayStatus?: string } }[];
		const out = new Map<string, Supervisor>();
		for (let at = 0; at < listed.length; at += 200) {
			const { threads } = await bb.sdk.threads.experimental_listPluginMetadata({ threadIds: listed.slice(at, at + 200).map((t) => t.id) });
			for (const row of threads) {
				if (row.metadata?.role !== "supervisor") continue;
				const t = listed.find((x) => x.id === row.threadId)!;
				out.set(t.id, { threadId: t.id, title: t.title || t.titleFallback || t.id, status: t.runtime?.displayStatus ?? t.status, issues: Array.isArray(row.metadata.issues) ? row.metadata.issues.map(String) : [], role: false });
			}
		}
		const id = await roleHolder(p.root).catch((e) => { bb.log.warn("desk role: " + e); return undefined; });
		const match = listed.find(t => t.id === id);
		if (match) {
			const prev = out.get(match.id);
			out.set(match.id, { threadId: match.id, title: match.title || match.titleFallback || match.id, status: match.runtime?.displayStatus ?? match.status, issues: prev?.issues ?? [], role: true });
		}
		return [...out.values()].sort((a, b) => Number(b.role) - Number(a.role));
	}

	async function spawn(projectId: string, prompt: string, title: string, metadata: Record<string, string | string[]>): Promise<string> {
		const t = await bb.sdk.threads.spawn({ projectId, environment: { type: "project-default" }, providerId: "pi", prompt, title, pluginMetadata: metadata });
		return (t as unknown as { id: string }).id;
	}

	bb.rpc.register(rpcContract, {
		projects: async () => ({ projects: await projects() }),
		snapshot: async ({ projectId }) => snap((await project(projectId)).root),
		issue: async ({ projectId, slug }) => {
			const p = await project(projectId);
			const i = (await snap(p.root)).issues.find((x) => x.slug === slug);
			if (!i) throw new Error("no issue " + slug);
			return { ...readIssue(p.root, i.path), path: join(p.root, i.path) };
		},
		resolveLinks: async ({ projectId, slug, hrefs }) => {
			const p = await project(projectId);
			const issue = (await snap(p.root)).issues.find(i => i.slug === slug);
			if (!issue) throw new Error("no issue " + slug);
			const known = await bb.sdk.projects.list();
			// A file inside a checkout bb knows opens as part of that workspace, so a Markdown opener (Obsidian at Home)
			// resolves the file's own links against the whole repository rather than the file's directory.
			const environments = new Map<string, Promise<{ id: string; path: string | null; isWorktree?: boolean }[]>>();
			const workspaceOf = async (hostId: string, path: string) => {
				if (!environments.has(hostId)) environments.set(hostId, bb.sdk.environments.list({ hostId }).catch(() => []));
				const inside = (await environments.get(hostId)!).filter(e => e.path && (path === e.path || path.startsWith(e.path.replace(/\/$/, "") + "/")));
				const best = inside.sort((a, b) => b.path!.length - a.path!.length || Number(!!a.isWorktree) - Number(!!b.isWorktree))[0];
				return best ? { kind: "workspace" as const, environmentId: best.id, path: relative(best.path!, path) } : null;
			};
			return Promise.all(hrefs.map(async href => {
				let path: string | undefined;
				let hostId = p.hostId;
				try {
					if (href.startsWith("#tracker-file=")) {
						const wiki = decodeURIComponent(href.slice("#tracker-file=".length)).split("#")[0];
						const match = /^projects\/([^/]+)\/(.+)$/.exec(wiki);
						if (match) {
							const sources = known.flatMap(project => project.sources ?? []).filter(s => basename(trackerRoot(s.path) ?? s.path) === match[1]);
							// Prefer the issue host when a project has checkouts on several machines.
							const source = sources.find(s => s.hostId === p.hostId) ?? sources[0];
							const root = match[1] === basename(p.root) ? p.root : source && (trackerRoot(source.path) ?? source.path);
							hostId = match[1] === basename(p.root) ? p.hostId : source?.hostId ?? "";
							if (root) path = resolve(root, "docs", match[2] + (extname(match[2]) ? "" : ".md"));
						}
					} else if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) {
						path = resolve(dirname(join(p.root, issue.path)), decodeURIComponent(href.split(/[?#]/)[0]));
					}
					const exists = path && (hostId === p.hostId ? statSync(path).isFile() : (await bb.sdk.hosts.pathsExist({ hostId, paths: [path] })).existence[path]);
					if (exists) return { href, target: (await workspaceOf(hostId, path!)) ?? { kind: "host" as const, hostId, path: path! }, reason: null };
				} catch { /* Malformed or missing paths are inert, not broken navigation. */ }
				return { href, target: null, reason: path ? "File does not exist: " + path : "Unresolved file: " + href };
			}));
		},
		supervisors: async ({ projectId }) => ({ supervisors: await supervisors(projectId) }),
		supervise: async ({ projectId, slugs, target }) => {
			const p = await project(projectId);
			const s = await requireReady(p.root, slugs);
			const links = slugs.map((slug) => wikilink(s.repo, slug)).join(" ");
			if (target.kind === "new") {
				const threadId = await spawn(projectId, "/skill:supervise " + links, "supervise " + slugs.join(", "), { role: "supervisor", issues: slugs, repo: s.repo });
				return { threadId, note: "started a supervisor" };
			}
			const body = "Also supervise " + links + " (sent from the bb tracker; the tracker lists " + (slugs.length > 1 ? "them" : "it") + " as ready).";
			const threadId = target.kind === "role"
				? (await supervisors(projectId)).find(s => s.role)?.threadId
				: target.threadId;
			if (!threadId) throw new Error("No live supervisor in desk/ROLES.md");
			await bb.sdk.threads.send({ threadId, mode: "queue-if-active", input: [{ type: "text", text: body, mentions: [] }] });
			try {
				const meta = await bb.sdk.threads.getPluginMetadata({ threadId });
				const prior = Array.isArray(meta.issues) ? meta.issues.map(String) : [];
				await bb.sdk.threads.updatePluginMetadata({ threadId, set: { role: "supervisor", repo: s.repo, issues: [...new Set([...prior, ...slugs])] } });
			} catch (e) { bb.log.warn("tag supervisor: " + e); }
			return { threadId, note: "queued to the supervisor" };
		},
		refine: async ({ projectId, slugs }) => {
			const p = await project(projectId);
			cache.delete(p.root);
			const s = await snap(p.root);
			const lines = slugs.map((slug) => {
				const i = s.issues.find((x) => x.slug === slug);
				return "- " + wikilink(s.repo, slug) + (i ? ": " + notReady(i) : "");
			});
			const prompt = "/skill:shape " + slugs.map((slug) => wikilink(s.repo, slug)).join(" ") + "\n\nOpened from the bb tracker to bring " + (slugs.length > 1 ? "these trees" : "this tree") + " to agent-ready specs or tickets for supervision. Where it stands now:\n" + lines.join("\n");
			return { threadId: await spawn(projectId, prompt, "shape " + slugs.join(", "), { role: "refine", issues: slugs, repo: s.repo }) };
		},
		campaigns: async ({ projectId, refresh }) => (await campaigns(projectId, refresh)).view,
	});

	// Mentions of a department, campaign or promise: the Campaigns page's Discuss, or ! in any composer.
	bb.ui.registerMentionProvider({
		id: CAMPAIGN_MENTION,
		label: "Campaigns",
		triggers: ["!"],
		async search({ query, projectId }) {
			const scope = projectId && roots.has(projectId) ? [roots.get(projectId)!] : [...roots.values()];
			const q = query.toLowerCase();
			const items: { id: string; title: string; subtitle: string }[] = [];
			for (const p of scope) {
				if (!existsSync(join(p.root, DEPARTMENTS))) continue;
				const { view } = await campaigns(p.id).catch(() => ({ view: null }));
				for (const d of view?.departments ?? []) {
					const add = (kind: string, key: string, title: string, subtitle: string) => { if (title.toLowerCase().includes(q)) items.push({ id: p.id + "/" + kind + ":" + key, title, subtitle }); };
					add("department", d.key, d.name, "department");
					for (const c of d.campaigns) add("campaign", c.key, c.title, d.name + " · " + c.state);
					for (const pr of d.promises) add("promise", pr.key, pr.text, d.name + " promise · " + pr.level);
				}
			}
			return items.slice(0, 30);
		},
		async resolve(itemId) {
			const at = itemId.indexOf("/");
			const [kind, key] = [itemId.slice(at + 1, itemId.indexOf(":", at)), itemId.slice(itemId.indexOf(":", at) + 1)];
			const { view, snap: s } = await campaigns(itemId.slice(0, at));
			return { context: mentionContext(view, s, kind, key) };
		},
	});

	// Warm every tracked project so the first #mention search has something to show.
	setTimeout(() => { projects().then((ps) => { for (const p of ps) void snap(p.root).catch(() => {}); }, (e) => bb.log.warn("preload: " + e)); }, 0);

	// #issue mentions in any composer: the agent gets the issue's path, state, subtree and contract.
	bb.ui.registerMentionProvider({
		id: MENTION_PROVIDER,
		label: "Issues",
		triggers: ["#"],
		async search({ query, projectId }) {
			// An untracked or personal project searches every tracked one.
			const scope = projectId && roots.has(projectId) ? [roots.get(projectId)!] : [...roots.values()];
			const q = query.toLowerCase().replace(/\s+/g, "-");
			const items: { id: string; title: string; subtitle: string; rank: number }[] = [];
			for (const p of scope) {
				const s = latest.get(p.root);
				void snap(p.root).catch(() => {});
				for (const i of s?.issues ?? []) {
					if (i.archived || !i.slug.includes(q)) continue;
					items.push({ id: p.id + "/" + i.slug, title: i.slug, subtitle: [stageLabel(i), i.assignee, scope.length > 1 ? p.name : ""].filter(Boolean).join(" · "), rank: (i.done ? 2 : 0) + (i.slug.startsWith(q) ? 0 : 1) });
				}
			}
			// Open issues and prefix matches first.
			return items.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title)).slice(0, 30).map(({ rank: _, ...item }) => item);
		},
		async resolve(itemId) {
			const at = itemId.indexOf("/");
			const p = await project(itemId.slice(0, at));
			const slug = itemId.slice(at + 1);
			const s = await snap(p.root);
			const i = s.issues.find((x) => x.slug === slug);
			if (!i) throw new Error("no issue " + slug + " in " + p.name);
			const c = await cli();
			const tree = await tracker(c, p.root, ["tree", slug]).catch(() => "");
			const { frontmatter, body } = readIssue(p.root, i.path);
			return {
				context: [
					"Tracker issue " + wikilink(s.repo, slug) + " at " + join(p.root, i.path) + ". Read and write it through the tracker skill.",
					"State: " + stageLabel(i) + (i.frontier ? ", ready for supervision" : ", " + notReady(i)) + ".",
					tree.trim() ? "Subtree (issues.ts tree):\n" + tree.trim() : "",
					"---\n" + frontmatter + "\n---\n" + body,
				].filter(Boolean).join("\n\n"),
			};
		},
	});
}

