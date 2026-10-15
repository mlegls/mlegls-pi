import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeGithubBody, encodeGithubBody } from "./tracker-github-state.ts";
import { requireGithub, type GithubIssue, type GithubProject, type GithubSnapshot } from "./tracker-github-snapshot.ts";
import type { Fields } from "./tracker.ts";

export class GithubRestError extends Error {
	constructor(message: string, readonly status?: number, readonly remoteMessage?: string) { super(message); }
}
/** A hidden/forbidden endpoint, arbitrary validation error, timeout or rate limit
 * is NOT proof that a capability is unsupported. */
function unsupported(error: unknown, kind: "parent" | "blockers"): boolean {
	if (!(error instanceof GithubRestError) || ![410, 422, 501].includes(error.status ?? 0)) return false;
	const message = error.remoteMessage ?? "";
	return (kind === "parent" ? /sub.?issues/i : /dependenc/i).test(message)
		&& /(?:not supported|not enabled|unavailable for this repository)/i.test(message);
}

export function stripRelationHeaders(body: string, fields: Fields): string {
	const lines = body.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!;
		if (!line.trim()) continue;
		if (/^Part of #[1-9]\d*\s*$/.test(line)) { if ("part-of" in fields) lines[index] = ""; }
		else if (/^Blocked by:\s*#[1-9]\d*(?:,\s*#[1-9]\d*)*\s*$/.test(line)) { if ("blocked-by" in fields) lines[index] = ""; }
		else break;
	}
	return lines.join("\n");
}

/** Body fallbacks are limited to the repository's explicit convention. Native
 * writes always win; no failure switches graphs unless positively unsupported.
 * Returned body is the user contract with only generated leading headers changed. */
export function githubRelations(project: GithubProject, snapshot: GithubSnapshot, issue: GithubIssue,
	fields: Fields, previousParent: string | null,
	rest: (method: string, path: string, body?: unknown) => unknown,
	updateBody: (issue: GithubIssue, body: string) => void): { parent?: string; blockers?: string[] } {
	const result: { parent?: string; blockers?: string[] } = {};
	const convention = readFileSync(join(project.cwd, "docs/agents/issue-tracker.md"), "utf8");
	const lookup = (slug: string) => {
		const found = snapshot.issues.find(issue => "gh-" + issue.number === slug);
		requireGithub(found, "missing same-repository relation " + slug); return found;
	};
	const id = (issue: GithubIssue | GithubIssue["blockedBy"][number]) => {
		requireGithub(Number.isSafeInteger(issue.databaseId) && issue.databaseId! > 0, "native relationship write requires numeric databaseId");
		return issue.databaseId!;
	};
	const mapList = (parentSlug: string, add: boolean) => {
		if (!/task list in the map body/i.test(convention)) return;
		const parent = lookup(parentSlug), decoded = decodeGithubBody(parent.body);
		const entry = new RegExp("^[-*] \\[[ xX]\\] #" + issue.number + "\\s*$");
		const lines = decoded.body.split("\n").filter(line => !entry.test(line));
		if (add) lines.push("- [ ] #" + issue.number);
		updateBody(parent, encodeGithubBody(lines.join("\n"), decoded.fields, decoded.marker));
	};
	if ("part-of" in fields && fields["part-of"] !== previousParent) {
		requireGithub(!issue.parent || issue.parent.repository.id === snapshot.repository.id, "cannot replace foreign parent");
		if (issue.parent) rest("DELETE", "issues/" + issue.parent.number + "/sub_issue", { sub_issue_id: id(issue) });
		else if (previousParent) mapList(previousParent, false);
		if (fields["part-of"]) {
			const parent = lookup(fields["part-of"] as string);
			try { rest("POST", "issues/" + parent.number + "/sub_issues", { sub_issue_id: id(issue) }); }
			catch (error) {
				if (!unsupported(error, "parent") || !/Part of #/.test(convention)) throw error;
				result.parent = "gh-" + parent.number; mapList(result.parent, true);
			}
		}
	} else if ("part-of" in fields && !issue.parent && previousParent) result.parent = previousParent;
	if ("blocked-by" in fields) {
		const wanted = (fields["blocked-by"] as string[] | null ?? []).filter(value => /^gh-[1-9]\d*$/.test(value));
		for (const blocker of issue.blockedBy) if (blocker.repository.id === snapshot.repository.id && !wanted.includes("gh-" + blocker.number))
			rest("DELETE", "issues/" + issue.number + "/dependencies/blocked_by/" + id(blocker));
		let added = false;
		for (const slug of wanted) if (!issue.blockedBy.some(blocker => blocker.repository.id === snapshot.repository.id && "gh-" + blocker.number === slug)) {
			try { rest("POST", "issues/" + issue.number + "/dependencies/blocked_by", { issue_id: id(lookup(slug)) }); added = true; }
			catch (error) {
				if (added || issue.blockedBy.length || !unsupported(error, "blockers") || !/Blocked by:/.test(convention)) throw error;
				result.blockers = wanted; break;
			}
		}
	}
	return result;
}

export function relationBody(body: string, fields: Fields, fallback: { parent?: string; blockers?: string[] }): string {
	const content = stripRelationHeaders(body, fields);
	const headers = [
		fallback.parent ? "Part of #" + fallback.parent.slice(3) : "",
		fallback.blockers?.length ? "Blocked by: " + fallback.blockers.map(slug => "#" + slug.slice(3)).join(", ") : "",
	].filter(Boolean);
	return headers.length ? headers.join("\n") + "\n" + content : content;
}
