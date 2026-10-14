import { execFileSync } from "node:child_process";
import { git } from "./checks.ts";
import type { PullRequestHost, PullRequestSnapshot, ReportedCheck, ReviewThread, SubmittedReview } from "./pr-types.ts";

// Keep gh's ordinary project authentication/host selection, and bound even large paginated replies.
function gh(cwd: string, args: string[], input?: unknown): string {
	try {
		return execFileSync("gh", args, {
			cwd, encoding: "utf8", input: input === undefined ? undefined : JSON.stringify(input),
			stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 << 20, timeout: 120_000,
		}).trim();
	} catch (error) {
		const e = error as Error & { stderr?: string };
		throw new Error("GitHub transport: " + (e.stderr?.trim() || e.message));
	}
}
function json<T>(raw: string): T {
	try { return JSON.parse(raw) as T; }
	catch { throw new Error("GitHub transport: invalid JSON response; retry observation before acting"); }
}
function requireValue(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error("GitHub transport: " + message);
}
function repositoryParts(repository: string): { owner: string; name: string } {
	const parts = repository.split("/");
	requireValue(parts.length === 2 && parts.every(p => /^[\w.-]+$/.test(p)), "expected repository owner/name, got " + repository);
	return { owner: parts[0]!, name: parts[1]! };
}
function oid(commit: string): string {
	requireValue(/^[a-f\d]{40,64}$/i.test(commit), "checks require an exact commit OID, got " + commit);
	return commit;
}
function api<T>(cwd: string, endpoint: string, input?: unknown): T {
	return json<T>(gh(cwd, ["api", endpoint, ...(input === undefined ? [] : ["--method", "POST", "--input", "-"])], input));
}
/** gh follows REST Link headers. Missing/malformed pages must never masquerade as no checks. */
function restList<T>(cwd: string, endpoint: string, key?: string): T[] {
	const pages = json<unknown[]>(gh(cwd, ["api", endpoint, "--paginate", "--slurp"]));
	requireValue(Array.isArray(pages) && pages.length, "missing REST pages for " + endpoint);
	const items: T[] = [];
	for (const page of pages) {
		const value = key ? (page as Record<string, unknown>)?.[key] : page;
		requireValue(Array.isArray(value), "incomplete REST list for " + endpoint);
		requireValue(!(page as { incomplete_results?: boolean })?.incomplete_results, "incomplete GitHub results for " + endpoint);
		items.push(...value);
	}
	if (key) requireValue((pages[0] as { total_count?: number }).total_count === items.length, "incomplete paginated " + key + "; retry observation");
	return items;
}
function graphql<T>(cwd: string, query: string, variables: Record<string, unknown>): T {
	const result = api<{ data?: T; errors?: { message: string }[] }>(cwd, "graphql", { query, variables });
	requireValue(!result.errors?.length && result.data, "GraphQL observation failed: " + (result.errors?.map(e => e.message).join("; ") || "missing data"));
	return result.data;
}
interface Connection<T> { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
const pageInfo = "pageInfo { hasNextPage endCursor }";
function connection<T, D>(cwd: string, query: string, variables: Record<string, unknown>, select: (data: D) => Connection<T>): T[] {
	const items: T[] = [];
	let cursor: string | null = null;
	const seen = new Set<string>();
	for (;;) {
		const page = select(graphql<D>(cwd, query, { ...variables, cursor }));
		requireValue(page && Array.isArray(page.nodes) && page.nodes.every(n => n != null) && typeof page.pageInfo?.hasNextPage === "boolean", "incomplete GraphQL connection");
		items.push(...page.nodes);
		if (!page.pageInfo.hasNextPage) return items;
		cursor = page.pageInfo.endCursor;
		requireValue(cursor && !seen.has(cursor), "missing/repeated GraphQL pagination cursor");
		seen.add(cursor);
	}
}
interface Comment {
	id: string; body: string; path: string | null; line: number | null; originalLine: number | null;
	url: string; state: string; pullRequestReview: { id: string } | null;
}
function threadComments(cwd: string, thread: string): Comment[] {
	return connection<Comment, { node: { comments: Connection<Comment> } }>(cwd,
		"query($thread: ID!, $cursor: String) { node(id: $thread) { ... on PullRequestReviewThread { comments(first: 100, after: $cursor) { nodes { id body path line originalLine url state pullRequestReview { id } } " + pageInfo + " } } } }",
		{ thread }, data => data.node?.comments);
}
interface CheckRun {
	id: number; name: string; status: string; conclusion: string | null; head_sha: string;
	app: { id: number }; check_suite: { id: number }; details_url?: string; html_url?: string;
	output?: { title?: string; summary?: string; text?: string };
}
interface CommitStatus { id: number; context: string; state: string; description?: string; target_url?: string; url?: string }
function checks(cwd: string, repository: string, commit: string): ReportedCheck[] {
	repositoryParts(repository);
	oid(commit);
	const runs = restList<CheckRun>(cwd, "repos/" + repository + "/commits/" + commit + "/check-runs?per_page=100&filter=latest", "check_runs");
	const statuses = restList<CommitStatus>(cwd, "repos/" + repository + "/commits/" + commit + "/statuses?per_page=100");
	const latestRuns = new Map<string, CheckRun>();
	for (const run of runs) {
		requireValue(run.id && run.name && run.app?.id && run.check_suite?.id && typeof run.status === "string" && run.head_sha?.toLowerCase() === commit.toLowerCase(), "incomplete check run on " + commit);
		// Independent workflows can report identical job names; reruns belong to their check suite.
		const key = run.app.id + ":" + run.check_suite.id + ":" + run.name;
		if (!latestRuns.has(key) || latestRuns.get(key)!.id < run.id) latestRuns.set(key, run);
	}
	const latestStatuses = new Map<string, CommitStatus>();
	for (const status of statuses) {
		requireValue(status.id && status.context && typeof status.state === "string", "incomplete commit status on " + commit);
		if (!latestStatuses.has(status.context) || latestStatuses.get(status.context)!.id < status.id) latestStatuses.set(status.context, status);
	}
	return [
		...Array.from(latestRuns.values(), run => {
			const conclusion = run.conclusion?.toLowerCase();
			const state: ReportedCheck["state"] = run.status !== "completed" ? "pending"
				: ["success", "neutral", "skipped"].includes(conclusion ?? "") ? "pass"
				: ["failure", "cancelled", "timed_out", "action_required", "error", "startup_failure", "stale"].includes(conclusion ?? "") ? "fail" : "pending";
			return { id: String(run.id), name: run.name, state, url: run.details_url || run.html_url,
				details: [run.status + "/" + (run.conclusion || "unknown"), run.output?.title, run.output?.summary, run.output?.text].filter(Boolean).join("\n") };
		}),
		...Array.from(latestStatuses.values(), status => ({
			id: String(status.id), name: status.context,
			state: (status.state === "success" ? "pass" : ["failure", "error"].includes(status.state) ? "fail" : "pending") as ReportedCheck["state"],
			url: status.target_url || status.url, details: [status.state, status.description].filter(Boolean).join(": "),
		})),
	];
}
interface Pr {
	number: number; url: string; state: PullRequestSnapshot["state"];
	headRefName: string; headRefOid: string; baseRefName: string; baseRefOid: string;
	mergeable: PullRequestSnapshot["mergeable"]; mergedAt: string | null; mergeCommit: { oid: string } | null;
}
function observe(cwd: string, repository: string, number: number): PullRequestSnapshot {
	const variables = { ...repositoryParts(repository), number };
	const data = graphql<{ repository: { pullRequest: Pr } }>(cwd,
		"query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { number url state headRefName headRefOid baseRefName baseRefOid mergeable mergedAt mergeCommit { oid } } } }", variables);
	const pr = data.repository?.pullRequest;
	requireValue(pr && pr.number === number && pr.url && pr.headRefName && pr.baseRefName
		&& ["OPEN", "MERGED", "CLOSED"].includes(pr.state) && ["MERGEABLE", "CONFLICTING", "UNKNOWN"].includes(pr.mergeable), "incomplete pull request observation for " + repository + "#" + number);
	oid(pr.headRefOid);
	oid(pr.baseRefOid);
	type Review = { id: string; state: string; submittedAt: string | null; url: string; commit: { oid: string } | null };
	const reviews = connection<Review, { repository: { pullRequest: { reviews: Connection<Review> } } }>(cwd,
		"query($owner: String!, $name: String!, $number: Int!, $cursor: String) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviews(first: 100, after: $cursor) { nodes { id state submittedAt url commit { oid } } " + pageInfo + " } } } }",
		variables, data => data.repository?.pullRequest?.reviews).filter(r => r.state !== "PENDING").map(r => {
			requireValue(r.id && r.submittedAt && r.commit?.oid && ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"].includes(r.state), "incomplete submitted review " + r.id);
			return { id: r.id, state: r.state as SubmittedReview["state"], submittedAt: r.submittedAt, url: r.url, commit: r.commit.oid };
		});
	type Thread = { id: string; isResolved: boolean };
	const threads = connection<Thread, { repository: { pullRequest: { reviewThreads: Connection<Thread> } } }>(cwd,
		"query($owner: String!, $name: String!, $number: Int!, $cursor: String) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviewThreads(first: 100, after: $cursor) { nodes { id isResolved } " + pageInfo + " } } } }",
		variables, data => data.repository?.pullRequest?.reviewThreads).map(t => {
			requireValue(t.id && typeof t.isResolved === "boolean", "incomplete review thread");
			const comments: ReviewThread["comments"] = threadComments(cwd, t.id).filter(c => c.state !== "PENDING").map(c => { // pending = private draft
				requireValue(c.id && typeof c.body === "string", "incomplete review thread comment");
				return { id: c.id, body: c.body, reviewId: c.pullRequestReview?.id, path: c.path ?? undefined, line: c.line ?? c.originalLine ?? undefined, url: c.url };
			});
			return { id: t.id, resolved: t.isResolved, comments };
		}).filter(t => t.comments.length);
	return { number, url: pr.url, state: pr.state, headBranch: pr.headRefName, head: pr.headRefOid,
		baseBranch: pr.baseRefName, base: pr.baseRefOid, mergeable: pr.mergeable,
		mergedAt: pr.mergedAt ?? undefined, mergeCommit: pr.mergeCommit?.oid, reviews, threads,
		checks: checks(cwd, repository, pr.headRefOid) };
}
/** Normalize HTTPS, SSH URLs and scp-style GitHub remotes, without matching a different host. */
function remoteRepository(remote: string): { host: string; repository: string } | undefined {
	try {
		const url = new URL(remote.includes("://") ? remote : remote.replace(/^([^@]+@)?([^:]+):/, "ssh://$1$2/"));
		return { host: url.hostname.toLowerCase(), repository: url.pathname.replace(/^\/|\/$/g, "").replace(/\.git$/, "").toLowerCase() };
	} catch { return undefined; }
}

/** GitHub transport only: no worker scheduling, tracker identity guessing or landing-ledger writes. */
export function createPullRequestHost(): PullRequestHost {
	return {
		project(cwd) {
			const repo = json<{ nameWithOwner: string; defaultBranchRef: { name: string } | null; url: string }>(
				gh(cwd, ["repo", "view", "--json", "nameWithOwner,defaultBranchRef,url"]));
			requireValue(repo.nameWithOwner && repo.defaultBranchRef?.name && repo.url, "repository/default branch unavailable; check gh auth status and repository access");
			repositoryParts(repo.nameWithOwner);
			const target = new URL(repo.url);
			const matches = (url: string) => {
				const parsed = remoteRepository(url);
				return parsed?.host === target.hostname.toLowerCase() && parsed.repository === repo.nameWithOwner.toLowerCase();
			};
			const remotes = git(cwd, "remote").split("\n").filter(Boolean).filter(remote => matches(git(cwd, "remote", "get-url", remote)));
			const remote = remotes.includes("origin") ? "origin" : remotes.length === 1 ? remotes[0] : undefined;
			requireValue(remote, "no unambiguous local Git remote for " + repo.nameWithOwner + "; configure matching origin or a sole matching remote (found: " + remotes.join(", ") + ")");
			requireValue(git(cwd, "remote", "get-url", "--push", "--all", remote).split("\n").every(matches), "push URL for " + remote + " differs from " + repo.nameWithOwner + "; fix the remote before publishing");
			return { repository: repo.nameWithOwner, baseBranch: repo.defaultBranchRef.name, remote };
		},
		find(cwd, repository, headBranch) {
			const { owner } = repositoryParts(repository);
			type Match = { number: number; head: { ref: string; repo: { full_name: string } | null } };
			const prs = restList<Match>(cwd, "repos/" + repository + "/pulls?state=all&head=" + encodeURIComponent(owner + ":" + headBranch) + "&per_page=100")
				.filter(pr => pr.head?.ref === headBranch && pr.head.repo?.full_name?.toLowerCase() === repository.toLowerCase());
			requireValue(prs.length <= 1, "multiple pull requests for " + repository + ":" + headBranch + " (" + prs.map(pr => "#" + pr.number).join(", ") + "); choose a unique landing branch");
			return prs[0] ? observe(cwd, repository, prs[0].number) : undefined;
		},
		create(cwd, repository, input) {
			repositoryParts(repository);
			const pr = api<{ number: number }>(cwd, "repos/" + repository + "/pulls", {
				head: input.headBranch, base: input.baseBranch, title: input.title, body: input.body,
			});
			requireValue(Number.isInteger(pr.number), "create did not return a PR number; find by head branch before retrying");
			return observe(cwd, repository, pr.number);
		},
		observe,
		checks,
		merge(cwd, repository, number, expectedHead) {
			repositoryParts(repository);
			oid(expectedHead);
			// The REST merge endpoint is immediate (including in a merge queue), never auto-merge enrolment.
			const result = json<{ merged: boolean; message: string }>(gh(cwd,
				["api", "repos/" + repository + "/pulls/" + number + "/merge", "--method", "PUT", "--input", "-"],
				{ merge_method: "merge", sha: expectedHead }));
			requireValue(result.merged === true, "guarded merge refused for " + repository + "#" + number + ": " + result.message);
		},
		reply(cwd, repository, threadId, body, marker) {
			repositoryParts(repository);
			requireValue(marker.trim(), "review reply requires a nonempty durable marker");
			const data = graphql<{ node: { pullRequest: { repository: { nameWithOwner: string } } } }>(cwd,
				"query($thread: ID!) { node(id: $thread) { ... on PullRequestReviewThread { pullRequest { repository { nameWithOwner } } } } }", { thread: threadId });
			requireValue(data.node?.pullRequest?.repository?.nameWithOwner.toLowerCase() === repository.toLowerCase(), "review thread does not belong to " + repository);
			if (threadComments(cwd, threadId).some(c => c.body.includes(marker))) return;
			const result = graphql<{ addPullRequestReviewThreadReply: { comment: { id: string } } }>(cwd,
				"mutation($thread: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread, body: $body }) { comment { id } } }",
				{ thread: threadId, body: body.includes(marker) ? body : body + "\n\n" + marker });
			requireValue(result.addPullRequestReviewThreadReply?.comment?.id, "reply did not return a comment identity; observe marker before retrying");
		},
	};
}
