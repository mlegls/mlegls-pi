import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { checkout, git } from "./thread/git.ts";

export function requireGithub(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error("GitHub tracker: " + message);
}

/** The account's shared GitHub API budget is exhausted until resetAt (epoch ms). Neither a failed observation nor
 * a node problem: callers hold their work until the reset (see reconcile/rate-limit.ts). */
export class GithubRateLimited extends Error {
	constructor(readonly resetAt: number) {
		super("GitHub tracker: API rate limit exhausted until " + new Date(resetAt).toISOString() + "; retry after the reset (partial mutations retain private replay intent)");
	}
}
const limitFile = (project: { directory: string }) => join(project.directory, "rate-limit.json");
/** One exhausted budget serves every process on this repository: skip gh until the recorded reset. */
export function assertWithinBudget(project: GithubProject): void {
	let resetAt = 0;
	try { resetAt = JSON.parse(readFileSync(limitFile(project), "utf8")).resetAt; } catch { /* no recorded limit */ }
	if (resetAt > Date.now()) throw new GithubRateLimited(resetAt);
}
/** Classifies gh's failure text; the reset comes from the rate_limit endpoint (free of charge), else a minute (secondary limits). */
export function rateLimited(project: GithubProject, text: string, resource: "graphql" | "core"): GithubRateLimited | undefined {
	if (!/RATE_LIMITED|rate limit/i.test(text)) return undefined;
	let resetAt = Date.now() + 60_000;
	try {
		const limit = JSON.parse(execFileSync("gh", ["api", "--hostname", project.host, "rate_limit"], { cwd: project.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 })).resources?.[resource];
		if (limit?.remaining === 0 && Number.isFinite(limit.reset)) resetAt = limit.reset * 1000;
	} catch { /* keep the conservative default */ }
	mkdirSync(project.directory, { recursive: true, mode: 0o700 });
	const tmp = limitFile(project) + "." + randomUUID() + ".tmp";
	writeFileSync(tmp, JSON.stringify({ resetAt }), { mode: 0o600 });
	renameSync(tmp, limitFile(project));
	return new GithubRateLimited(resetAt);
}

export const triageRoles = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"] as const;
export type TriageRole = typeof triageRoles[number];
export interface GithubProject {
	cwd: string;
	host: string;
	repository: string;
	directory: string;
	roles: Record<TriageRole, string>;
}

function remoteIdentity(value: string): { host: string; repository: string } {
	try {
		const url = new URL(value.includes("://") ? value : value.replace(/^([^@]+@)?([^:]+):/, "ssh://$1$2/"));
		const repository = url.pathname.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
		requireGithub(/^[\w.-]+\/[\w.-]+$/.test(repository), "invalid remote repository " + value);
		return { host: url.hostname.toLowerCase(), repository };
	} catch { throw new Error("GitHub tracker: cannot resolve exact repository from remote " + value); }
}

/** Always read conventions from checkout().project, including from linked worktrees. */
export function githubProject(cwd: string): GithubProject | undefined {
	const project = checkout(cwd).project;
	const convention = join(project, "docs/agents/issue-tracker.md");
	if (!existsSync(convention)) return undefined;
	const text = readFileSync(convention, "utf8");
	if (!/^#+\s*Issue tracker:\s*GitHub\s*$/im.test(text)) return undefined;
	const table = join(project, "docs/agents/triage-labels.md");
	requireGithub(existsSync(table), "selected GitHub but missing " + table);
	const roles = {} as Record<TriageRole, string>;
	for (const line of readFileSync(table, "utf8").split(/\r?\n/)) {
		const cells = line.split("|").slice(1, -1).map(cell => cell.trim().replace(/^\x60(.*)\x60$/, "$1"));
		if (!triageRoles.includes(cells[0] as TriageRole)) continue;
		const role = cells[0] as TriageRole;
		requireGithub(cells[1] && !roles[role], table + ": missing/duplicate mapping for " + role);
		roles[role] = cells[1]!;
	}
	for (const role of triageRoles) requireGithub(roles[role], table + ": missing mapping for " + role);
	requireGithub(new Set(Object.values(roles)).size === triageRoles.length, table + ": contradictory role mappings (labels must be distinct)");
	const remotes = git(project, "remote").split("\n").filter(Boolean);
	requireGithub(remotes.length, "selected GitHub but no repository remote configured");
	const candidates = remotes.includes("origin") ? ["origin"] : remotes;
	const identities = candidates.flatMap(name => git(project, "remote", "get-url", "--all", name).split("\n").map(remoteIdentity));
	const distinct = new Map(identities.map(identity => [identity.host + "/" + identity.repository.toLowerCase(), identity]));
	requireGithub(distinct.size === 1, "ambiguous repository remotes; configure one exact origin");
	const identity = [...distinct.values()][0]!;
	// An explicit convention locator, when supplied, must agree with the remote.
	const explicit = text.match(/^Repository:\s*(\S+)\s*$/im)?.[1];
	if (explicit) {
		const named = explicit.includes("://") || explicit.includes("@") ? remoteIdentity(explicit) : { host: identity.host, repository: explicit };
		requireGithub(named.host === identity.host && named.repository.toLowerCase() === identity.repository.toLowerCase(),
			"convention repository disagrees with the canonical project's remote");
	}
	const common = git(project, "rev-parse", "--path-format=absolute", "--git-common-dir");
	const key = createHash("sha256").update(identity.host + "/" + identity.repository.toLowerCase()).digest("hex").slice(0, 20);
	return { cwd: project, ...identity, roles, directory: join(common, "reconcile", "github-tracker", key) };
}

export function githubApi<T>(project: GithubProject, query: string, variables: Record<string, unknown>): T {
	assertWithinBudget(project);
	let raw: string;
	try {
		raw = execFileSync("gh", ["api", "--hostname", project.host, "graphql", "--input", "-"], {
			cwd: project.cwd, input: JSON.stringify({ query, variables }), encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"], timeout: 120_000, maxBuffer: 64 << 20,
		});
	} catch (error) {
		const e = error as Error & { stderr?: string; stdout?: string };
		throw rateLimited(project, (e.stderr ?? "") + (e.stdout ?? ""), "graphql") ?? new Error("GitHub tracker transport: " + (e.stderr?.trim() || e.message));
	}
	let result: { data?: T; errors?: { message: string }[] };
	try { result = JSON.parse(raw); }
	catch { throw new Error("GitHub tracker: invalid JSON response"); }
	const limited = result?.errors?.length ? rateLimited(project, result.errors.map(e => e.message).join("; "), "graphql") : undefined;
	if (limited) throw limited;
	requireGithub(result && !result.errors?.length && result.data, "GraphQL observation failed: " + (result?.errors?.map(e => e.message).join("; ") || "missing data"));
	return result.data;
}

export interface GithubIdentity { id: string; login: string }
export interface GithubRelation {
	id: string; databaseId?: number; number: number; url: string; state: "OPEN" | "CLOSED";
	repository: { id: string; nameWithOwner: string; url: string };
}
export interface GithubComment { id: string; body: string; createdAt: string; author: { login: string } | null; url: string }
export interface GithubLabel { id: string; name: string }
export interface GithubIssue extends GithubRelation {
	title: string; body: string; stateReason: string | null; author: { login: string } | null;
	parent: GithubRelation | null;
	subIssues: GithubRelation[];
	blockedBy: GithubRelation[];
	labels: GithubLabel[];
	assignees: GithubIdentity[];
	comments: GithubComment[];
}
export interface GithubSnapshot {
	repository: { id: string; nameWithOwner: string; url: string };
	viewer: GithubIdentity;
	labels: GithubLabel[];
	issues: GithubIssue[];
}
interface Page<T> { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] }
type RawIssue = Omit<GithubIssue, "subIssues" | "blockedBy" | "labels" | "assignees" | "comments"> & {
	subIssues: Page<GithubRelation>; blockedBy: Page<GithubRelation>; labels: Page<GithubLabel>;
	assignees: Page<GithubIdentity>; comments: Page<GithubComment>;
};

const relationSelection = "id databaseId number url state repository { id nameWithOwner url }";
/** Per-issue connections; each is drained by node id after the repository page. */
const issueConnections = {
	subIssues: relationSelection, blockedBy: relationSelection, labels: "id name", assignees: "id login",
	comments: "id body createdAt url author { login }",
} as const;
const connection = (field: string, selection: string, size: number, args = "") =>
	field + "(first:" + size + args + ") { totalCount pageInfo { hasNextPage endCursor } nodes { " + selection + " } }";
const issueOrder = ", orderBy:{field:CREATED_AT,direction:ASC}";
const fragments = (size: number) => [
	"fragment TrackerRelation on Issue { " + relationSelection + " }",
	"fragment TrackerIssue on Issue { ...TrackerRelation title body stateReason author { login } parent { ...TrackerRelation } "
		+ Object.entries(issueConnections).map(([field, selection]) => connection(field, selection, size)).join(" ") + " }",
].join("\n");

/** Page one of the single logical refresh; fetchSnapshot drains every connection by cursor. */
export const trackerSnapshotQuery = (size = 100) => [
	"query TrackerSnapshot($owner: String!, $name: String!) {",
	" viewer { id login }",
	" repository(owner: $owner, name: $name) { id nameWithOwner url",
	"  " + connection("labels", "id name", size),
	"  " + connection("issues", "...TrackerIssue", size, issueOrder),
	" }",
	"}",
	fragments(size),
].join("\n");

/** Follows cursors to the end; the unique node count must then equal totalCount. */
function drain<T extends { id: string }>(first: Page<T>, locator: string, more: (after: string) => Page<T>): T[] {
	const nodes = new Map<string, T>();
	let page = first, previous: string | null = null;
	for (;;) {
		requireGithub(page && Number.isInteger(page.totalCount) && page.totalCount === first.totalCount && Array.isArray(page.nodes)
			&& page.pageInfo && typeof page.pageInfo.hasNextPage === "boolean", locator + ": missing/inconsistent connection page");
		for (const node of page.nodes) {
			requireGithub(node && typeof node.id === "string" && node.id, locator + ": null/malformed node");
			requireGithub(!nodes.has(node.id), locator + ": node repeated across pages " + node.id);
			nodes.set(node.id, node);
		}
		if (!page.pageInfo.hasNextPage) break;
		const cursor = page.pageInfo.endCursor;
		requireGithub(cursor && cursor !== previous && page.nodes.length > 0, locator + ": connection cursor did not advance");
		previous = cursor; page = more(cursor);
	}
	requireGithub(nodes.size === first.totalCount, locator + ": incomplete connection: " + nodes.size + "/" + first.totalCount + " unique nodes");
	return [...nodes.values()];
}

function relation(value: GithubRelation, locator: string): void {
	requireGithub(value && value.id && Number.isSafeInteger(value.number) && value.number > 0
		&& ["OPEN", "CLOSED"].includes(value.state) && value.repository?.id && value.repository.nameWithOwner
		&& typeof value.url === "string" && typeof value.repository.url === "string", locator + ": malformed native issue identity");
}

/** size is the page size (production 100; a smaller one exercises the cursors live). */
export function fetchSnapshot(project: GithubProject, size = 100): GithubSnapshot {
	type RawRepository = GithubSnapshot["repository"] & { labels: Page<GithubLabel>; issues: Page<RawIssue> };
	const [owner, name] = project.repository.split("/");
	const data = githubApi<{ viewer: GithubIdentity; repository: RawRepository }>(project, trackerSnapshotQuery(size), { owner, name });
	const repo = data.repository;
	requireGithub(repo?.id && repo.nameWithOwner?.toLowerCase() === project.repository.toLowerCase()
		&& new URL(repo.url).hostname.toLowerCase() === project.host, "response repository differs from selected " + project.host + "/" + project.repository);
	requireGithub(data.viewer?.id && data.viewer.login, "missing authenticated viewer identity");
	const repositoryPage = <T>(field: "labels" | "issues", selection: string) => (after: string) => {
		const result = githubApi<{ repository: ({ id: string } & Record<string, Page<T>>) | null }>(project,
			"query " + (field === "labels" ? "TrackerLabels" : "TrackerIssues") + "($owner: String!, $name: String!, $after: String) { repository(owner: $owner, name: $name) { id "
			+ connection(field, selection, size, ", after:$after" + (field === "issues" ? issueOrder : "")) + " } }" + (field === "issues" ? "\n" + fragments(size) : ""), { owner, name, after });
		requireGithub(result.repository?.id === repo.id, "repository changed identity while paging " + field);
		return result.repository[field]!;
	};
	const nodePage = <T>(id: string, field: keyof typeof issueConnections) => (after: string) => {
		const result = githubApi<{ node: Record<string, Page<T>> | null }>(project,
			"query TrackerConnection($id: ID!, $after: String) { node(id: $id) { ... on Issue { " + connection(field, issueConnections[field], size, ", after:$after") + " } } }", { id, after });
		requireGithub(result.node?.[field], "issue " + id + " vanished while paging " + field);
		return result.node[field]!;
	};
	const labels = drain(repo.labels, project.repository + ".labels", repositoryPage<GithubLabel>("labels", "id name"));
	const issues = drain(repo.issues, project.repository + ".issues", repositoryPage<RawIssue>("issues", "...TrackerIssue")).map(issue => {
		const locator = project.repository + "#" + issue.number;
		relation(issue, locator);
		requireGithub(issue.repository.id === repo.id && issue.repository.nameWithOwner.toLowerCase() === repo.nameWithOwner.toLowerCase()
			&& issue.repository.url === repo.url && typeof issue.title === "string" && typeof issue.body === "string"
			&& (issue.stateReason === null || typeof issue.stateReason === "string") && "parent" in issue, locator + ": incomplete issue");
		const { subIssues: children, blockedBy: blockers, labels: labelPage, assignees: assigneePage, comments: commentPage, ...base } = issue;
		const subIssues = drain(children, locator + ".subIssues", nodePage<GithubRelation>(issue.id, "subIssues"));
		const blockedBy = drain(blockers, locator + ".blockedBy", nodePage<GithubRelation>(issue.id, "blockedBy"));
		for (const edge of [base.parent, ...subIssues, ...blockedBy]) if (edge) relation(edge, locator);
		const comments = drain(commentPage, locator + ".comments", nodePage<GithubComment>(issue.id, "comments"));
		for (const comment of comments) requireGithub(typeof comment.body === "string" && Number.isFinite(Date.parse(comment.createdAt))
			&& typeof comment.url === "string" && (comment.author === null || typeof comment.author?.login === "string"), locator + ": malformed comment");
		const assignees = drain(assigneePage, locator + ".assignees", nodePage<GithubIdentity>(issue.id, "assignees"));
		for (const user of assignees) requireGithub(typeof user.login === "string" && user.login, locator + ": malformed assignee");
		const issueLabels = drain(labelPage, locator + ".labels", nodePage<GithubLabel>(issue.id, "labels"));
		for (const label of issueLabels) requireGithub(typeof label.name === "string", locator + ": malformed label");
		return { ...base, subIssues, blockedBy, labels: issueLabels, assignees,
			comments: comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) };
	});
	requireGithub(new Set(issues.map(issue => issue.number)).size === issues.length, "duplicate issue numbers in repository");
	return { repository: { id: repo.id, nameWithOwner: repo.nameWithOwner, url: repo.url }, viewer: data.viewer, labels, issues };
}

export function withGithubLock<T>(project: GithubProject, change: () => T): T {
	mkdirSync(project.directory, { recursive: true, mode: 0o700 });
	const db = new Database(join(project.directory, "lock.sqlite"), { create: true });
	try {
		db.exec("PRAGMA busy_timeout = 130000");
		return db.transaction(change).immediate();
	} finally { db.close(); }
}

const cacheVersion = 1;
export const githubCacheLifetime = 60_000;
/** No in-memory alias: every call observes atomic publication/invalidation by
 * other CLI processes. SQLite's process-owned lock is released even on a crash. */
export function loadGithubSnapshot(project: GithubProject): GithubSnapshot {
	return withGithubLock(project, () => loadGithubSnapshotLocked(project));
}

/** Caller already holds withGithubLock. */
export function loadGithubSnapshotLocked(project: GithubProject): GithubSnapshot {
		const file = join(project.directory, "snapshot.json");
		if (existsSync(file)) {
			let cache;
			try { cache = JSON.parse(readFileSync(file, "utf8")); } catch { /* refresh a damaged cache */ }
			if (cache?.version === cacheVersion && cache.repository === project.repository.toLowerCase()
				&& cache.fetchedAt <= Date.now() && Date.now() - cache.fetchedAt < githubCacheLifetime) return cache.snapshot as GithubSnapshot;
		}
		const snapshot = fetchSnapshot(project);
		const tmp = file + "." + randomUUID() + ".tmp";
		try {
			writeFileSync(tmp, JSON.stringify({ version: cacheVersion, repository: project.repository.toLowerCase(), fetchedAt: Date.now(), snapshot }), { mode: 0o600 });
			renameSync(tmp, file);
		} finally { if (existsSync(tmp)) unlinkSync(tmp); }
		return snapshot;
}

/** Writers call inside their serialization lock after every remote mutation,
 * including an uncertain outcome. Publication and invalidation share the lock. */
export function invalidateGithubSnapshot(project: GithubProject): void {
	const file = join(project.directory, "snapshot.json");
	if (existsSync(file)) unlinkSync(file);
}
