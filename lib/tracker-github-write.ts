import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Fields, Tracker, TrackerOptions } from "./tracker.ts";
import type { GithubNode } from "./tracker-github.ts";
import {
	githubApi, invalidateGithubSnapshot, loadGithubSnapshotLocked, requireGithub, triageRoles, withGithubLock,
	type GithubIssue, type GithubProject, type GithubRelation, type GithubSnapshot,
} from "./tracker-github-snapshot.ts";
import {
	decodeGithubBody, encodeGithubBody, loadJournal, readGithubReceipt, runAuthority, saveJournal, type GithubReceipt,
} from "./tracker-github-state.ts";
import { GithubRestError, githubRelations, relationBody } from "./tracker-github-relations.ts";
import { git } from "./thread/git.ts";
import type { GlobalRunState } from "./reconcile/tracker-state.ts";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const slugOf = (issue: GithubRelation) => "gh-" + issue.number;
const agent = (value: unknown): value is string => typeof value === "string" && /^(agent(?::[a-z][\w-]*)?|model:\S+)(,\s*(agent:[a-z][\w-]*|model:\S+))?$/.test(value);
const guard = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]*: \S/.test(value);
const stable = (run: GlobalRunState) => "reconcile:" + run.root;
const attempt = (run: GlobalRunState, token: unknown) => Object.values(run.refinements).find(value => value.claim === token && value.claim === stable(run) + "/" + value.handle);

export function githubRest<T>(project: GithubProject, method: string, path: string, body?: unknown): T {
	try {
		const value = execFileSync("gh", ["api", "--hostname", project.host, "--method", method,
			"repos/" + project.repository + "/" + path, ...(body === undefined ? [] : ["--input", "-"])], {
			cwd: project.cwd, input: body === undefined ? undefined : JSON.stringify(body), encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"], timeout: 120_000, maxBuffer: 64 << 20,
		});
		return (value.trim() ? JSON.parse(value) : undefined) as T;
	} catch (error) {
		const e = error as Error & { stderr?: string; stdout?: string };
		let remoteMessage: string | undefined;
		try { remoteMessage = JSON.parse(e.stdout ?? "{}").message; } catch { /* transport failure, not unsupported */ }
		throw new GithubRestError("GitHub tracker REST " + method + " " + path + ": " + (e.stderr?.trim() || e.message), Number(e.stderr?.match(/HTTP (\d+)/)?.[1]) || undefined, remoteMessage);
	}
}

export function githubMutations(project: GithubProject, options: TrackerOptions, cwd: string,
	view: (snapshot: GithubSnapshot) => Map<string, GithubNode>): Pick<Tracker, "create" | "update" | "close" | "remove" | "moveOut"> {
	function write<T>(work: (snapshot: GithubSnapshot, run?: GlobalRunState) => T): T {
		return withGithubLock(project, () => {
			const run = runAuthority(project, options), snapshot = loadGithubSnapshotLocked(project);
			try { return work(snapshot, run); }
			catch (error) { throw new Error(String(error) + "; partial mutations retain private replay intent; replay the same operation"); }
			finally { invalidateGithubSnapshot(project); }
		});
	}
	const mutation = (name: string, type: string, input: unknown) => {
		try { return githubApi(project, "mutation TrackerWrite($input:" + type + "!){ " + name + "(input:$input){ clientMutationId } }", { input }); }
		finally { invalidateGithubSnapshot(project); }
	};
	const rest = (method: string, path: string, body?: unknown) => {
		try { return githubRest(project, method, path, body); }
		finally { if (method !== "GET") invalidateGithubSnapshot(project); }
	};
	const native = (snapshot: GithubSnapshot, slug: string) => {
		requireGithub(/^gh-[1-9]\d*$/.test(slug), "invalid issue identity " + slug);
		const issue = snapshot.issues.find(issue => slugOf(issue) === slug);
		requireGithub(issue, "no issue " + slug); return issue;
	};
	const savedClaim = (snapshot: GithubSnapshot, issue: GithubIssue) => readGithubReceipt(project, snapshot, issue)?.claim;
	function own(snapshot: GithubSnapshot, issue: GithubIssue, run: GlobalRunState | undefined) {
		const claim = savedClaim(snapshot, issue);
		requireGithub(run && claim && (claim.claimedBy === stable(run) || attempt(run, claim.claimedBy))
			&& claim.assigneeId === snapshot.viewer.id && issue.assignees.some(user => user.id === claim.assigneeId),
			slugOf(issue) + ": no exact owned native assignment/receipt");
		return claim;
	}
	function contains(rows: Map<string, GithubNode>, child: string, parent: string): boolean {
		for (let slug: string | null = child; slug; slug = rows.get(slug)?.partOf ?? null) if (slug === parent) return true;
		return false;
	}
	function claimChange(snapshot: GithubSnapshot, issue: GithubIssue | undefined, rows: Map<string, GithubNode>,
		run: GlobalRunState | undefined, value: unknown, parent?: string) {
		requireGithub(run, "claimed-by requires saved run authority");
		const previous = issue && savedClaim(snapshot, issue);
		if (issue && issue.assignees.some(user => user.id === snapshot.viewer.id) && !previous)
			throw new Error("GitHub tracker: same-login assignment is foreign without its exact receipt");
		if (previous) own(snapshot, issue!, run);
		else requireGithub(!issue?.assignees.length, "refusing to claim foreign-assigned issue");
		if (value === null) return;
		requireGithub(typeof value === "string", "claim must be an exact run/attempt token");
		const target = attempt(run, value);
		if (value !== stable(run)) {
			requireGithub(target && ["writing", "adopting"].includes(target.phase), "no writable exact attempt authority for " + value);
			requireGithub(parent && contains(rows, parent, target.node), "provisional child is outside its attempt subtree");
			requireGithub(!issue || (!target.baseline.includes(slugOf(issue)) && slugOf(issue) !== target.node), "cannot claim a baseline as provisional");
		}
		if (previous && previous.claimedBy !== value) {
			const source = attempt(run, previous.claimedBy);
			if (value === stable(run)) {
				const acceptance = source?.acceptance;
				requireGithub(source?.phase === "accepting" && acceptance?.preparedHead
					&& git(acceptance.destination, "merge-base", acceptance.preparedHead, "HEAD") === acceptance.preparedHead,
					"stable reservation requires the saved committed-stub landing");
			} else requireGithub(source && target && source.phase === "adopting" && target.phase === "adopting"
				&& source.successor === target.handle && target.adoptedFrom === source.handle,
				"claim transfer requires exact saved adoption authority");
		}
	}
	function validate(fields: Fields, rows: Map<string, GithubNode>, slug: string, body?: string) {
		requireGithub(fields && typeof fields === "object" && !Array.isArray(fields), "fields must be an object");
		requireGithub(body === undefined || typeof body === "string" && !body.includes("<!-- mlegls-pi:tracker"), "body must be Markdown without a reserved envelope");
		for (const key of Object.keys(fields)) requireGithub(!key.startsWith("$") && !["github", "github-comments", "github-types"].includes(key), "read-only/reserved field " + key);
		if (fields.stage !== undefined && fields.stage !== null) requireGithub(["idea", "goal", "spec", "ticket"].includes(fields.stage as string), "unsupported stage; complete via close");
		if (fields.assignee !== undefined && fields.assignee !== null) requireGithub(agent(fields.assignee) || fields.assignee === "human" || typeof fields.assignee === "string" && /^user:\S+$/.test(fields.assignee), "unsupported assignee selector");
		if (fields.author !== undefined && fields.author !== null) requireGithub(typeof fields.author === "string" && fields.author.trim(), "author must be nonempty provenance");
		if (fields.title !== undefined) requireGithub(typeof fields.title === "string" && fields.title.trim(), "title must be nonempty");
		if (fields.priority !== undefined && fields.priority !== null) requireGithub([1, 2, 3, 4].includes(fields.priority as number), "priority must be 1..4");
		if (fields.drive !== undefined && fields.drive !== null) requireGithub(fields.drive === "none", "supported drive override is none");
		const relation = (value: unknown) => {
			requireGithub(typeof value === "string" && /^gh-[1-9]\d*$/.test(value) && rows.has(value), "relation must name an existing same-repository gh identity: " + value);
			requireGithub(value !== slug, "self relation " + slug);
		};
		if (fields["part-of"] !== undefined && fields["part-of"] !== null) relation(fields["part-of"]);
		if (fields["blocked-by"] !== undefined && fields["blocked-by"] !== null) {
			requireGithub(Array.isArray(fields["blocked-by"]), "blocked-by must be a list");
			for (const value of fields["blocked-by"]) if (!guard(value)) relation(value);
		}
		if (fields.stage === null) requireGithub([...rows.values()].some(node => node.partOf === slug), "omitted residual requires children");
		const proposed = new Map([...rows].map(([id, node]) => [id, { parent: node.partOf, blockers: [...node.blockedBy] }]));
		const row = proposed.get(slug) ?? { parent: null, blockers: [] };
		if ("part-of" in fields) row.parent = fields["part-of"] as string | null;
		if ("blocked-by" in fields) row.blockers = (fields["blocked-by"] as unknown[] | null ?? []).filter(value => !guard(value)) as string[];
		proposed.set(slug, row);
		for (const kind of ["parent", "blockers", "completion"]) {
			const visited = new Set<string>();
			function visit(id: string, path: Set<string>) {
				requireGithub(!path.has(id), kind + " cycle at " + id);
				if (visited.has(id)) return;
				const current = proposed.get(id)!;
				const edges = kind === "parent" ? current.parent ? [current.parent] : [] : kind === "blockers" ? current.blockers
					: [...current.blockers, ...[...proposed].filter(([, other]) => other.parent === id).map(([other]) => other)];
				for (const edge of edges) visit(edge, new Set(path).add(id));
				visited.add(id);
			}
			for (const id of proposed.keys()) visit(id, new Set());
		}
		for (const [id, node] of rows) if (node.receipt?.stage === null)
			requireGithub("stage" in fields && fields.stage !== null && id === slug || [...proposed.values()].some(other => other.parent === id), "cannot strand an explicitly delegated parent");
	}
	function labels(snapshot: GithubSnapshot, issue: GithubIssue | undefined, fields: Fields): string[] {
		let names = issue?.labels.map(label => label.name) ?? [];
		if ("assignee" in fields) {
			names = names.filter(name => !triageRoles.some(role => project.roles[role] === name));
			if (fields.assignee !== null) names.push(project.roles[agent(fields.assignee) ? "ready-for-agent" : "ready-for-human"]);
		}
		if ("drive" in fields) { names = names.filter(name => name !== "no-drive"); if (fields.drive === "none") names.push("no-drive"); }
		return [...new Set(names)].map(name => {
			const label = snapshot.labels.find(label => label.name === name);
			requireGithub(label, "required repository label is absent: " + name); return label.id;
		});
	}
	function extras(issue: GithubIssue | undefined, fields: Fields): Fields {
		const extra = { ...decodeGithubBody(issue?.body ?? "").fields };
		for (const [key, value] of Object.entries(fields)) {
			if (["stage", "part-of", "blocked-by", "claimed-by", "title"].includes(key)) continue;
			if (value === null) delete extra[key]; else extra[key] = value;
		}
		if ("blocked-by" in fields) {
			const guards = (fields["blocked-by"] as unknown[] | null ?? []).filter(guard);
			if (guards.length) extra.$guards = guards; else delete extra.$guards;
		}
		return extra;
	}
	function relations(snapshot: GithubSnapshot, issue: GithubIssue, fields: Fields) {
		return githubRelations(project, snapshot, issue, fields, view(snapshot).get(slugOf(issue))?.partOf ?? null,
			rest, (issue, body) => mutation("updateIssue", "UpdateIssueInput", { id: issue.id, body }));
	}
	function receipt(snapshot: GithubSnapshot, issue: GithubIssue, fields: Fields, run?: GlobalRunState) {
		const slug = slugOf(issue);
		if ("stage" in fields) {
			const shared = loadJournal(project); (shared.issues[slug] ??= {}).stage = fields.stage as GithubReceipt["stage"]; saveJournal(project, shared);
		}
		if ("claimed-by" in fields) {
			requireGithub(run, "claim requires run");
			const local = loadJournal(project, run.root), value = fields["claimed-by"];
			if (value === null) delete (local.issues[slug] ??= {}).claim;
			else (local.issues[slug] ??= {}).claim = { claimedBy: value as string, assigneeId: snapshot.viewer.id };
			saveJournal(project, local, run.root);
		}
	}
	function applyUpdate(snapshot: GithubSnapshot, slug: string, fields: Fields, body: string | undefined, run?: GlobalRunState) {
		const issue = native(snapshot, slug), rows = view(snapshot);
		requireGithub(rows.has(slug), "cannot update a removed provisional issue");
		validate(fields, rows, slug, body);
		const decoded = decodeGithubBody(issue.body);
		if ("author" in fields && decoded.fields.author !== undefined) requireGithub(fields.author === decoded.fields.author, "author provenance is immutable");
		if ("claimed-by" in fields) claimChange(snapshot, issue, rows, run, fields["claimed-by"], (fields["part-of"] ?? rows.get(slug)!.partOf) as string | undefined);
		const labelIds = labels(snapshot, issue, fields), extra = extras(issue, fields);
		const input: Record<string, unknown> = { id: issue.id };
		if ("title" in fields) input.title = fields.title;
		if (body !== undefined || !isDeepStrictEqual(decoded.fields, extra)) input.body = encodeGithubBody(body ?? decoded.body, extra, decoded.marker);
		if ("assignee" in fields || "drive" in fields) input.labelIds = labelIds;
		if ("claimed-by" in fields) input.assigneeIds = [...new Set([
			...issue.assignees.filter(user => fields["claimed-by"] !== null || user.id !== snapshot.viewer.id).map(user => user.id),
			...(fields["claimed-by"] === null ? [] : [snapshot.viewer.id]),
		])];
		const journal = loadJournal(project, run?.root), pending = journal.updates[slug];
		const intent = { fields, ...(body === undefined ? {} : { body }),
			...(fields["claimed-by"] ? { claim: { claimedBy: fields["claimed-by"] as string, assigneeId: snapshot.viewer.id } } : {}) };
		requireGithub(!pending || isDeepStrictEqual(pending, intent), "replay pending update before replacing intent: " + slug);
		journal.updates[slug] = intent; saveJournal(project, journal, run?.root);
		const fallback = relations(snapshot, issue, fields);
		const nextBody = relationBody(body ?? decoded.body, fields, fallback);
		if (nextBody !== decoded.body || body !== undefined || !isDeepStrictEqual(decoded.fields, extra)) input.body = encodeGithubBody(nextBody, extra, decoded.marker);
		if (Object.keys(input).length > 1) mutation("updateIssue", "UpdateIssueInput", input);
		receipt(snapshot, issue, fields, run);
		const complete = loadJournal(project, run?.root); delete complete.updates[slug]; saveJournal(project, complete, run?.root);
	}
	const comment = (issue: GithubIssue, marker: string, body: string, login: string) => {
		if (!issue.comments.some(comment => comment.author?.login === login && comment.body.trimEnd().endsWith(marker))) mutation("addComment", "AddCommentInput", { subjectId: issue.id, body });
	};
	function release(snapshot: GithubSnapshot, issue: GithubIssue, run?: GlobalRunState) {
		const claim = savedClaim(snapshot, issue);
		if (!claim) {
			// A lost successful unassignment response leaves only the private half.
			if (run) {
				const local = loadJournal(project, run.root), old = local.issues[slugOf(issue)]?.claim;
				if (old && old.assigneeId === snapshot.viewer.id && (old.claimedBy === stable(run) || attempt(run, old.claimedBy)))
					receipt(snapshot, issue, { "claimed-by": null }, run);
			}
			return;
		}
		own(snapshot, issue, run);
		mutation("removeAssigneesFromAssignable", "RemoveAssigneesFromAssignableInput", { assignableId: issue.id, assigneeIds: [claim.assigneeId] });
		receipt(snapshot, issue, { "claimed-by": null }, run);
	}
	function resultBody(summary: string | undefined, evidence: string | undefined) {
		let link = "";
		if (evidence !== undefined) {
			requireGithub(/^docs\/attachments\/[^\\]+$/.test(evidence) && !evidence.split("/").some(part => ["", ".", ".."].includes(part)), "evidence must be a docs/attachments repository path");
			const convention = readFileSync(join(project.cwd, "docs/agents/issue-tracker.md"), "utf8");
			if (/^Attachments:\s*(?:none|declined)\s*$/im.test(convention)) link = "Evidence (" + evidence + "):\n\n" + readFileSync(join(cwd, evidence), "utf8");
			else {
				const head = git(cwd, "rev-parse", "HEAD");
				requireGithub(git(cwd, "ls-tree", "-r", "--name-only", head, "--", evidence).split("\n").includes(evidence), "evidence must be committed at selected checkout HEAD");
				githubRest(project, "GET", "commits/" + head);
				link = "Evidence: [" + evidence + "](https://" + project.host + "/" + project.repository + "/blob/" + head + "/" + evidence.split("/").map(encodeURIComponent).join("/") + ")";
			}
		}
		return [summary, link].filter(Boolean).join("\n\n");
	}
	return {
		create(request) {
			return write((snapshot, run) => {
				const fields: Fields = { ...request.fields, author: request.fields.author ?? (process.env.PI_SESSION_ID ? "session:" + process.env.PI_SESSION_ID : undefined) };
				requireGithub(fields.author, "create requires author or PI_SESSION_ID");
				const rows = view(snapshot); validate(fields, rows, "new", request.body);
				const labelIds = labels(snapshot, undefined, fields);
				let claim: GithubReceipt["claim"];
				if ("claimed-by" in fields) {
					requireGithub(typeof fields["part-of"] === "string", "provisional create requires an existing parent");
					requireGithub(run && attempt(run, fields["claimed-by"]), "provisional create requires exact attempt authority");
					claimChange(snapshot, undefined, rows, run, fields["claimed-by"], fields["part-of"] as string);
					claim = { claimedBy: fields["claimed-by"] as string, assigneeId: snapshot.viewer.id };
				}
				const journal = loadJournal(project, run?.root), key = hash({ request, claim: claim?.claimedBy });
				const intent = journal.creates[key] ??= {
					marker: randomUUID(), request: request.slug, fields, body: request.body, claim,
					parentId: fields["part-of"] ? native(snapshot, fields["part-of"] as string).id : undefined,
				};
				saveJournal(project, journal, run?.root);
				let found = snapshot.issues.filter(issue => decodeGithubBody(issue.body).marker === intent.marker);
				requireGithub(found.length <= 1, "duplicate native creation correlation marker");
				if (intent.done) {
					requireGithub(found[0] && slugOf(found[0]) === intent.slug, "creation lost correlated identity"); return intent.slug!;
				}
				if (!found.length) {
					requireGithub(!intent.publishing, "uncertain create has no visible correlated issue; refusing duplicate publish, retry observation");
					intent.publishing = true; saveJournal(project, journal, run?.root);
					try {
						const result = githubApi<{ createIssue: { issue: { number: number } } }>(project,
							"mutation TrackerCreate($input:CreateIssueInput!){createIssue(input:$input){issue{number}}}", { input: {
								repositoryId: snapshot.repository.id, title: fields.title ?? request.slug,
								body: encodeGithubBody(request.body, extras(undefined, fields), intent.marker), labelIds,
								...(intent.parentId ? { parentIssueId: intent.parentId } : {}),
								...(claim ? { assigneeIds: [claim.assigneeId] } : {}),
							} });
						intent.slug = "gh-" + result.createIssue.issue.number; saveJournal(project, journal, run?.root);
					} finally { invalidateGithubSnapshot(project); }
					snapshot = loadGithubSnapshotLocked(project);
					found = snapshot.issues.filter(issue => decodeGithubBody(issue.body).marker === intent.marker);
				}
				const issue = found[0];
				requireGithub(issue && (!intent.parentId || issue.parent?.id === intent.parentId)
					&& (!claim || issue.assignees.some(user => user.id === claim.assigneeId)), "creation mismatches parent/assignment intent");
				intent.slug = slugOf(issue);
				receipt(snapshot, issue, { ...(Object.hasOwn(fields, "stage") ? { stage: fields.stage } : {}), ...(claim ? { "claimed-by": claim.claimedBy } : {}) }, run);
				const materialized = loadJournal(project, run?.root);
				materialized.creates[key]!.slug = intent.slug; materialized.creates[key]!.published = true; saveJournal(project, materialized, run?.root);
				if ("blocked-by" in fields) applyUpdate(snapshot, intent.slug, { "blocked-by": fields["blocked-by"] }, undefined, run);
				const complete = loadJournal(project, run?.root); complete.creates[key]!.done = true; saveJournal(project, complete, run?.root);
				return intent.slug;
			});
		},
		update(slug, fields, body) { write((snapshot, run) => applyUpdate(snapshot, slug, fields, body, run)); },
		close(slug, result) {
			write((snapshot, run) => {
				const issue = native(snapshot, slug), journal = loadJournal(project, run?.root);
				let intent = journal.closes[slug];
				if (!intent) {
					const body = resultBody(result.summary, result.evidence), marker = "<!-- mlegls-pi:result:" + hash({ slug, result }) + " -->";
					intent = journal.closes[slug] = { marker, body: [body, marker].filter(Boolean).join("\n\n") }; saveJournal(project, journal, run?.root);
				}
				if (intent.done) return;
				if (savedClaim(snapshot, issue)) own(snapshot, issue, run);
				comment(issue, intent.marker, intent.body, snapshot.viewer.login);
				if (issue.state === "OPEN") mutation("closeIssue", "CloseIssueInput", { issueId: issue.id, stateReason: "COMPLETED" });
				release(snapshot, issue, run);
				snapshot = loadGithubSnapshotLocked(project);
				for (const dependent of view(snapshot).values()) if (dependent.blockedBy.includes(slug))
					applyUpdate(snapshot, slugOf(dependent.native), { "blocked-by": [...dependent.blockedBy.filter(id => id !== slug), ...(decodeGithubBody(dependent.native.body).fields.$guards as string[] | undefined ?? [])] }, undefined, run);
				const complete = loadJournal(project, run?.root); complete.closes[slug]!.done = true; saveJournal(project, complete, run?.root);
			});
		},
		remove(slug) {
			write((snapshot, run) => {
				const issue = native(snapshot, slug), journal = loadJournal(project, run?.root);
				if (journal.removes[slug]?.done) return;
				const pending = journal.removes[slug];
				const claim = pending && run && !issue.assignees.length ? pending.claim : own(snapshot, issue, run);
				requireGithub(run, "remove requires saved run authority");
				const owner = attempt(run, claim.claimedBy);
				requireGithub(owner && ["writing", "stopping", "cleaning"].includes(owner.phase) && !owner.baseline.includes(slug) && owner.node !== slug, "remove requires still-owned provisional child");
				const rows = view(snapshot);
				requireGithub(contains(rows, slug, owner.node) || journal.removes[slug], "provisional child moved outside attempt");
				requireGithub(![...rows].some(([id, row]) => id !== slug && (row.partOf === slug || row.blockedBy.includes(slug))), "retained children/dependents prevent removal");
				requireGithub(issue.assignees.every(user => user.id === claim.assigneeId), "foreign assignment prevents removal");
				journal.removes[slug] ??= { claim }; saveJournal(project, journal, run?.root);
				relations(snapshot, issue, { "part-of": null, "blocked-by": [] });
				if (issue.state === "OPEN") mutation("closeIssue", "CloseIssueInput", { issueId: issue.id, stateReason: "NOT_PLANNED" });
				release(snapshot, issue, run);
				const shared = loadJournal(project); (shared.issues[slug] ??= {}).removed = true; delete shared.issues[slug]!.claim; saveJournal(project, shared);
				const complete = loadJournal(project, run?.root); complete.removes[slug]!.done = true; saveJournal(project, complete, run?.root);
			});
		},
		moveOut(slug, reason) {
			write((snapshot, run) => {
				const issue = native(snapshot, slug), journal = loadJournal(project, run?.root);
				let intent = journal.moves[slug];
				if (!intent) {
					requireGithub(issue.labels.some(label => label.name === project.roles["ready-for-agent"]), "move-out requires current agent routing");
					if (issue.assignees.length) own(snapshot, issue, run);
					const marker = "<!-- mlegls-pi:move-out:" + hash({ slug, reason }) + " -->";
					intent = journal.moves[slug] = { marker, body: reason + "\n\n" + marker }; saveJournal(project, journal, run?.root);
				}
				if (intent.done) return;
				requireGithub(issue.labels.some(label => [project.roles["ready-for-agent"], project.roles["ready-for-human"]].includes(label.name)), "owner changed routing during move-out");
				comment(issue, intent.marker, intent.body, snapshot.viewer.login);
				applyUpdate(snapshot, slug, { assignee: "human" }, undefined, run); release(snapshot, issue, run);
				const complete = loadJournal(project, run?.root); complete.moves[slug]!.done = true; saveJournal(project, complete, run?.root);
			});
		},
	};
}
