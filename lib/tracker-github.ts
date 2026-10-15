import { githubMutations } from "./tracker-github-write.ts";
import { stringify } from "yaml";
import type { Fields, Issue, Stage, Tracker, TrackerOptions } from "./tracker.ts";
import {
	githubProject, loadGithubSnapshot, requireGithub, triageRoles,
	type GithubIssue, type GithubProject, type GithubRelation, type GithubSnapshot,
} from "./tracker-github-snapshot.ts";

import { decodeGithubBody, readGithubReceipt } from "./tracker-github-state.ts";
export { decodeGithubBody, readGithubReceipt, type GithubReceipt } from "./tracker-github-state.ts";
import type { GithubReceipt } from "./tracker-github-state.ts";

const slugOf = (number: number) => "gh-" + number;
const agentSelector = (value: unknown): value is string => typeof value === "string"
	&& (value === "agent" || value.startsWith("agent:") || value.startsWith("model:"));

export interface GithubNode {
	native: GithubIssue;
	body: string;
	fields: Fields;
	stage: Stage | null;
	assignee: string | null;
	partOf: string | null;
	blockedBy: string[];
	guards: string[];
	claims: Issue["claims"];
	receipt?: GithubReceipt;
}

function fallbackHeaders(body: string): { parent?: number; blockers: number[] } {
	let parent: number | undefined;
	const blockers: number[] = [];
	// Only the convention's leading header block, never casual mentions,
	// fenced examples, task lists, or prose later in the contract.
	for (const line of body.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const part = line.match(/^Part of #([1-9]\d*)\s*$/);
		const blocked = line.match(/^Blocked by:\s*(#[1-9]\d*(?:,\s*#[1-9]\d*)*)\s*$/);
		if (part) {
			requireGithub(parent === undefined, "duplicate Part of fallback header");
			parent = Number(part[1]);
		} else if (blocked) {
			blockers.push(...[...blocked[1]!.matchAll(/#(\d+)/g)].map(match => Number(match[1])));
		} else break;
	}
	return { parent, blockers: [...new Set(blockers)] };
}

function graph(project: GithubProject, snapshot: GithubSnapshot, options: TrackerOptions): Map<string, GithubNode> {
	const all = new Map<string, GithubNode>();
	const local = (edge: GithubRelation) => {
		const sameId = edge.repository.id === snapshot.repository.id;
		const sameName = edge.repository.nameWithOwner.toLowerCase() === project.repository.toLowerCase()
			&& new URL(edge.repository.url).hostname.toLowerCase() === project.host;
		requireGithub(sameId === sameName, "inconsistent native relation repository identity at " + edge.url);
		return sameId;
	};
	for (const native of snapshot.issues) {
		const slug = slugOf(native.number);
		const decoded = decodeGithubBody(native.body);
		const labels = new Set(native.labels.map(label => label.name));
		const roles = triageRoles.filter(role => labels.has(project.roles[role]));
		requireGithub(roles.length <= 1, slug + ": contradictory triage states: " + roles.join(", "));
		const receipt = readGithubReceipt(project, snapshot, native);
		const metadata = { ...decoded.fields };
		const role = roles[0];
		const assignee = role === "ready-for-agent" ? (agentSelector(metadata.assignee) ? metadata.assignee : "agent")
			: role === "ready-for-human" ? (typeof metadata.assignee === "string" && metadata.assignee.startsWith("user:") ? metadata.assignee : "human") : null;
		const fields: Fields = { ...metadata };
		const guards = Array.isArray(fields.$guards) ? fields.$guards as string[] : [];
		delete fields.$guards;
		// Reserved logical keys come from native state and validated relations,
		// never stale extra metadata.
		for (const key of ["stage", "assignee", "part-of", "blocked-by", "claimed-by", "github", "github-comments", "title", "drive"]) delete fields[key];
		const claims: Issue["claims"] = native.assignees.map(user => ({
			slug, claimedBy: receipt?.claim?.assigneeId === user.id ? receipt.claim.claimedBy : "github:" + user.login,
		}));
		if (labels.has("no-drive")) fields.drive = "none";
		const types = [...labels].filter(label => /^wayfinder:(map|research|prototype|grilling|task)$/.test(label));
		if (types.length) fields["github-types"] = types.map(label => label.slice("wayfinder:".length));
		if (receipt?.removed) continue;
		all.set(slug, {
			native, body: decoded.body, fields, stage: native.state === "CLOSED" ? "done" : "idea",
			assignee, partOf: null, blockedBy: [], guards: [...guards], claims, receipt,
		});
	}
	const parent = (child: GithubNode, parentSlug: string) => {
		requireGithub(all.has(parentSlug), slugOf(child.native.number) + ": missing parent " + parentSlug + " in complete repository snapshot");
		requireGithub(!child.partOf || child.partOf === parentSlug, slugOf(child.native.number) + ": contradictory native parents");
		child.partOf = parentSlug;
	};
	// Native edges win over body fallbacks, including a parent represented only
	// by the parent's subIssues connection.
	for (const node of all.values()) {
		const edge = node.native.parent;
		if (edge) {
			if (local(edge)) {
				const row = all.get(slugOf(edge.number));
				requireGithub(row && row.native.id === edge.id && row.native.state === edge.state, "missing/inconsistent native parent " + edge.url);
				parent(node, slugOf(edge.number));
			} else node.guards.push("github-parent: " + edge.url);
		}
		for (const child of node.native.subIssues) {
			const localChild = snapshot.issues.find(issue => issue.id === child.id);
			if (localChild && readGithubReceipt(project, snapshot, localChild)?.removed) continue;
			if (local(child)) {
				const row = all.get(slugOf(child.number));
				requireGithub(row && row.native.id === child.id, "missing native subIssue " + child.url);
				parent(row, slugOf(node.native.number));
			} else if (child.state !== "CLOSED") node.guards.push("github-subissue: " + child.url);
		}
	}
	for (const [slug, node] of all) {
		const fallback = fallbackHeaders(node.body);
		if (!node.partOf && !node.native.parent && fallback.parent) parent(node, slugOf(fallback.parent));
		for (const blocker of node.native.blockedBy) {
			if (local(blocker)) {
				const row = all.get(slugOf(blocker.number));
				requireGithub(row && row.native.id === blocker.id && row.native.state === blocker.state, slug + ": missing/inconsistent blocker " + blocker.url);
				node.blockedBy.push(slugOf(blocker.number));
			} else if (blocker.state !== "CLOSED") node.guards.push("github-blocker: " + blocker.url);
		}
		if (!node.native.blockedBy.length) for (const number of fallback.blockers) {
			requireGithub(all.has(slugOf(number)), slug + ": missing fallback blocker gh-" + number + "; use a native relation for cross-repository blockers");
			node.blockedBy.push(slugOf(number));
		}
		node.blockedBy = [...new Set(node.blockedBy)];
	}
	for (const [slug, node] of all) {
		const kids = [...all.values()].filter(child => child.partOf === slug);
		const receipt = node.receipt;
		if (node.native.state === "OPEN" && node.assignee && agentSelector(node.assignee)) {
			node.stage = kids.length ? null : node.partOf ? "ticket" : "spec";
			if (receipt && Object.hasOwn(receipt, "stage")) {
				requireGithub(receipt.stage === null || receipt.stage !== undefined && ["idea", "goal", "ticket", "spec"].includes(receipt.stage), slug + ": invalid open-issue stage override");
				node.stage = receipt.stage;
			}
		}
		requireGithub(node.stage !== null || kids.length > 0, slug + ": omitted residual requires children");
		requireGithub(node.stage === null || ["idea", "goal", "spec", "ticket", "done"].includes(node.stage), slug + ": invalid receipt stage");
	}
	// Same graph safety as the vault: containment, dependency and combined
	// completion cycles are distinct, and all local endpoints must exist.
	for (const kind of ["part-of", "blocked-by", "completion"] as const) {
		const visited = new Set<string>();
		function visit(slug: string, path: Set<string>): void {
			requireGithub(!path.has(slug), slug + ": " + kind + " cycle");
			if (visited.has(slug)) return;
			const node = all.get(slug)!;
			const edges = kind === "part-of" ? (node.partOf ? [node.partOf] : [])
				: kind === "blocked-by" ? node.blockedBy
				: [...node.blockedBy, ...[...all].filter(([, child]) => child.partOf === slug).map(([id]) => id)];
			for (const edge of edges) visit(edge, new Set(path).add(slug));
			visited.add(slug);
		}
		for (const slug of all.keys()) visit(slug, new Set());
	}
	return all;
}

function projection(all: Map<string, GithubNode>, explicit: boolean): Map<string, Issue> {
	const stages: Stage[] = ["idea", "goal", "spec", "ticket", "done"];
	const kids = (slug: string) => [...all].filter(([, node]) => node.partOf === slug).map(([slug]) => slug);
	const effective = new Map<string, Stage>();
	function resolve(slug: string): Stage {
		if (!effective.has(slug)) {
			const node = all.get(slug)!;
			effective.set(slug, node.native.state === "CLOSED" ? "done"
				: stages[Math.min(stages.indexOf(node.stage ?? "done"), ...kids(slug).map(kid => stages.indexOf(resolve(kid))))]!);
		}
		return effective.get(slug)!;
	}
	for (const slug of all.keys()) resolve(slug);
	const subtree = (slug: string): string[] => [slug, ...kids(slug).flatMap(subtree)];
	return new Map([...all].map(([slug, node]) => {
		const scope = subtree(slug);
		const nodes = scope.filter(id => effective.get(id) !== "done");
		const remaining = nodes.filter(id => all.get(id)!.stage !== null && all.get(id)!.stage !== "done");
		const blockers = [...new Set(nodes.flatMap(id => {
			const row = all.get(id)!;
			return [...row.blockedBy.filter(blocker => !scope.includes(blocker) && effective.get(blocker) !== "done"), ...row.guards];
		}))];
		const claims = scope.flatMap(id => all.get(id)!.claims.map(claim => ({ ...claim })));
		const selectors = remaining.map(id => ({ slug: id, assignee: all.get(id)!.assignee }));
		const eligible = remaining.length > 0 && selectors.every(selector => agentSelector(selector.assignee));
		const effectiveStage = effective.get(slug)!;
		const ready = effectiveStage === "spec" || effectiveStage === "ticket";
		const deferred = nodes.some(id => all.get(id)!.fields.priority === 4);
		return [slug, {
			slug, archived: false, ownStage: node.stage, effectiveStage, partOf: node.partOf,
			assignee: node.assignee, author: typeof node.fields.author === "string" ? node.fields.author : null,
			priority: typeof node.fields.priority === "number" ? node.fields.priority : null,
			blockedBy: [...node.blockedBy], guards: [...node.guards], ready, eligible, claims, selectors, deferred,
			frontier: ready && eligible && !blockers.length && !claims.length && (explicit || !deferred),
			done: effectiveStage === "done",
		}];
	}));
}

function logicalFields(node: GithubNode): Fields {
	const fields: Fields = { ...node.fields, title: node.native.title };
	if (node.stage !== null) fields.stage = node.stage;
	if (node.assignee !== null) fields.assignee = node.assignee;
	if (node.partOf) fields["part-of"] = node.partOf;
	if (node.blockedBy.length || node.guards.length) fields["blocked-by"] = [...node.blockedBy, ...node.guards];
	if (node.claims.length) fields["claimed-by"] = node.claims.map(claim => claim.claimedBy).join("; ");
	fields.github = {
		repository: node.native.repository.nameWithOwner, number: node.native.number, url: node.native.url,
		state: node.native.state, stateReason: node.native.stateReason, author: node.native.author, assignees: node.native.assignees,
		labels: node.native.labels.map(label => label.name), parent: node.native.parent,
		subIssues: node.native.subIssues, blockedBy: node.native.blockedBy,
	};
	fields["github-comments"] = node.native.comments;
	return structuredClone(fields);
}

/** Direct factory only until the activation child wires getTracker/CLI. */
export function getGithubTracker(cwd: string, options: TrackerOptions = {}): Tracker | undefined {
	const project = githubProject(cwd);
	if (!project) return undefined;
	const read = () => graph(project, loadGithubSnapshot(project), options);
	const issue = (slug: string) => {
		requireGithub(/^gh-[1-9]\d*$/.test(slug), "invalid issue identity " + slug);
		const node = read().get(slug);
		requireGithub(node, "no issue " + slug + " in " + project.repository);
		return node;
	};
	const mutations = githubMutations(project, options, cwd, snapshot => graph(project, snapshot, options));
	return {
		snapshot(scope) {
			const all = read();
			const rows = projection(all, !!scope);
			if (!scope) return rows;
			requireGithub(rows.has(scope), "no issue " + scope);
			return new Map([...rows].filter(([slug]) => {
				for (let id: string | null = slug; id; id = all.get(id)!.partOf) if (id === scope) return true;
				return false;
			}));
		},
		fields: slug => logicalFields(issue(slug)),
		text(slug) {
			const node = issue(slug);
			return "---\n" + stringify(logicalFields(node), { lineWidth: 0 }) + "---\n" + node.body;
		},
		githubIssue(slug) {
			const native = issue(slug).native;
			return { repository: native.repository.nameWithOwner, number: native.number, url: native.url };
		},
		...mutations,
	};
}
