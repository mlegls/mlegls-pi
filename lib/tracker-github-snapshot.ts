import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Database } from "bun:sqlite";
import { checkout, git } from "./thread/git.ts";

export function requireGithub(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error("GitHub tracker: " + message);
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
	let raw: string;
	try {
		raw = execFileSync("gh", ["api", "--hostname", project.host, "graphql", "--input", "-"], {
			cwd: project.cwd, input: JSON.stringify({ query, variables }), encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"], timeout: 120_000, maxBuffer: 64 << 20,
		});
	} catch (error) {
		const e = error as Error & { stderr?: string };
		throw new Error("GitHub tracker transport: " + (e.stderr?.trim() || e.message));
	}
	let result: { data?: T; errors?: { message: string }[] };
	try { result = JSON.parse(raw); }
	catch { throw new Error("GitHub tracker: invalid JSON response"); }
	requireGithub(result && !result.errors?.length && result.data, "GraphQL observation failed: " + (result?.errors?.map(e => e.message).join("; ") || "missing data"));
	return result.data;
}

export interface GithubIdentity { id: string; login: string }
export interface GithubRelation {
	id: string; number: number; url: string; state: "OPEN" | "CLOSED";
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
interface Connection<T> { totalCount: number; nodes: T[] }
type Paged<T> = { first: Connection<T>; last: Connection<T> };
type RawIssue = Omit<GithubIssue, "subIssues" | "blockedBy" | "labels" | "assignees" | "comments"> & {
	childrenFirst: Connection<GithubRelation>; childrenLast: Connection<GithubRelation>;
	blockersFirst: Connection<GithubRelation>; blockersLast: Connection<GithubRelation>;
	labelsFirst: Connection<GithubLabel>; labelsLast: Connection<GithubLabel>;
	assigneesFirst: Connection<GithubIdentity>; assigneesLast: Connection<GithubIdentity>;
	commentsFirst: Connection<GithubComment>; commentsLast: Connection<GithubComment>;
};

/** Every connection has both end pages in the SAME operation. Total unique IDs,
 * not pageInfo or summed page lengths, certify complete coverage (up to 200). */
export const trackerSnapshotQuery = [
	"query TrackerSnapshot($owner: String!, $name: String!) {",
	" viewer { id login }",
	" repository(owner: $owner, name: $name) { id nameWithOwner url",
	"  labelsFirst: labels(first:100) { totalCount nodes { id name } }",
	"  labelsLast: labels(last:100) { totalCount nodes { id name } }",
	"  issuesFirst: issues(first:100, orderBy:{field:CREATED_AT,direction:ASC}) { totalCount nodes { ...TrackerIssue } }",
	"  issuesLast: issues(last:100, orderBy:{field:CREATED_AT,direction:ASC}) { totalCount nodes { ...TrackerIssue } }",
	" }",
	"}",
	"fragment TrackerRelation on Issue { id number url state repository { id nameWithOwner url } }",
	"fragment TrackerIssue on Issue {",
	" ...TrackerRelation title body stateReason author { login } parent { ...TrackerRelation }",
	" childrenFirst: subIssues(first:100) { totalCount nodes { ...TrackerRelation } }",
	" childrenLast: subIssues(last:100) { totalCount nodes { ...TrackerRelation } }",
	" blockersFirst: blockedBy(first:100) { totalCount nodes { ...TrackerRelation } }",
	" blockersLast: blockedBy(last:100) { totalCount nodes { ...TrackerRelation } }",
	" labelsFirst: labels(first:100) { totalCount nodes { id name } }",
	" labelsLast: labels(last:100) { totalCount nodes { id name } }",
	" assigneesFirst: assignees(first:100) { totalCount nodes { id login } }",
	" assigneesLast: assignees(last:100) { totalCount nodes { id login } }",
	" commentsFirst: comments(first:100) { totalCount nodes { id body createdAt url author { login } } }",
	" commentsLast: comments(last:100) { totalCount nodes { id body createdAt url author { login } } }",
	"}",
].join("\n");

function coverage<T extends { id: string }>(pages: Paged<T>, locator: string): T[] {
	const { first, last } = pages;
	requireGithub(first && last && Number.isInteger(first.totalCount) && first.totalCount >= 0
		&& first.totalCount === last.totalCount && Array.isArray(first.nodes) && Array.isArray(last.nodes),
		locator + ": missing/inconsistent connection counts");
	const nodes = new Map<string, T>();
	for (const node of [...first.nodes, ...last.nodes]) {
		requireGithub(node && typeof node.id === "string" && node.id, locator + ": null/malformed node");
		requireGithub(!nodes.has(node.id) || isDeepStrictEqual(nodes.get(node.id), node), locator + ": inconsistent overlapping node " + node.id);
		nodes.set(node.id, node);
	}
	requireGithub(nodes.size === first.totalCount, locator + ": incomplete connection: " + nodes.size + "/" + first.totalCount
		+ " unique nodes; first/last:100 cannot cover this response. Reduce the connection or extend the single-operation query plan before retrying");
	return [...nodes.values()];
}

function relation(value: GithubRelation, locator: string): void {
	requireGithub(value && value.id && Number.isSafeInteger(value.number) && value.number > 0
		&& ["OPEN", "CLOSED"].includes(value.state) && value.repository?.id && value.repository.nameWithOwner
		&& typeof value.url === "string" && typeof value.repository.url === "string", locator + ": malformed native issue identity");
}

function fetchSnapshot(project: GithubProject): GithubSnapshot {
	type RawRepository = GithubSnapshot["repository"] & {
		issuesFirst: Connection<RawIssue>; issuesLast: Connection<RawIssue>;
		labelsFirst: Connection<GithubLabel>; labelsLast: Connection<GithubLabel>;
	};
	const [owner, name] = project.repository.split("/");
	const data = githubApi<{ viewer: GithubIdentity; repository: RawRepository }>(project, trackerSnapshotQuery, { owner, name });
	const repo = data.repository;
	requireGithub(repo?.id && repo.nameWithOwner?.toLowerCase() === project.repository.toLowerCase()
		&& new URL(repo.url).hostname.toLowerCase() === project.host, "response repository differs from selected " + project.host + "/" + project.repository);
	requireGithub(data.viewer?.id && data.viewer.login, "missing authenticated viewer identity");
	const labels = coverage({ first: repo.labelsFirst, last: repo.labelsLast }, project.repository + ".labels");
	const raw = coverage({ first: repo.issuesFirst, last: repo.issuesLast }, project.repository + ".issues");
	const issues = raw.map(issue => {
		const locator = project.repository + "#" + issue.number;
		relation(issue, locator);
		requireGithub(issue.repository.id === repo.id && issue.repository.nameWithOwner.toLowerCase() === repo.nameWithOwner.toLowerCase()
			&& issue.repository.url === repo.url && typeof issue.title === "string" && typeof issue.body === "string"
			&& (issue.stateReason === null || typeof issue.stateReason === "string") && "parent" in issue, locator + ": incomplete issue");
		const { childrenFirst, childrenLast, blockersFirst, blockersLast, labelsFirst, labelsLast,
			assigneesFirst, assigneesLast, commentsFirst, commentsLast, ...base } = issue;
		const subIssues = coverage({ first: childrenFirst, last: childrenLast }, locator + ".subIssues");
		const blockedBy = coverage({ first: blockersFirst, last: blockersLast }, locator + ".blockedBy");
		for (const edge of [base.parent, ...subIssues, ...blockedBy]) if (edge) relation(edge, locator);
		const comments = coverage({ first: commentsFirst, last: commentsLast }, locator + ".comments");
		for (const comment of comments) requireGithub(typeof comment.body === "string" && Number.isFinite(Date.parse(comment.createdAt))
			&& typeof comment.url === "string" && (comment.author === null || typeof comment.author?.login === "string"), locator + ": malformed comment");
		const assignees = coverage({ first: assigneesFirst, last: assigneesLast }, locator + ".assignees");
		for (const user of assignees) requireGithub(typeof user.login === "string" && user.login, locator + ": malformed assignee");
		const issueLabels = coverage({ first: labelsFirst, last: labelsLast }, locator + ".labels");
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
	return withGithubLock(project, () => {
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
	});
}

/** Writers call inside their serialization lock after every remote mutation,
 * including an uncertain outcome. Publication and invalidation share the lock. */
export function invalidateGithubSnapshot(project: GithubProject): void {
	const file = join(project.directory, "snapshot.json");
	if (existsSync(file)) unlinkSync(file);
}
