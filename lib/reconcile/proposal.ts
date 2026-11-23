import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAssignee } from "../assignee.ts";
import { contract } from "../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts";
import { git } from "./checks.ts";
import { normalizeStageFields } from "../stage.ts";
import type { Fields, NewIssue, Tracker } from "../tracker.ts";

/** Committed directory on a refiner's branch holding proposed tracker writes.
 * Stripped when interface commits land on the collector so proposal files never land in code history. */
export const PROPOSAL_DIR = ".reconcile/proposal";
export const PROPOSAL_CHILDREN_DIR = ".reconcile/proposal/children";
export const PROPOSAL_PARENT_FILE = ".reconcile/proposal/parent.md";

/** One new child proposed by a refiner, parsed from `.reconcile/proposal/children/<alias>.md`.
 * Relations (`part-of`, non-guard `blocked-by` entries) are logical slugs or sibling aliases. */
export interface ProposedChild {
	/** Filename stem (`<alias>.md`): vault issue slug, and GitHub create alias / fallback title. */
	alias: string;
	/** Validated, normalized frontmatter fields (author populated, stage normalized, no `claimed-by`). */
	fields: Fields;
	/** Non-empty Markdown body without frontmatter. */
	body: string;
}

/** Optional update to the refined parent, parsed from `.reconcile/proposal/parent.md`.
 * Required on promotion (`fields.decompose === false`). */
export interface ProposedParent {
	/** Validated field patch applied to the refined node (`null` removes a key, e.g. `stage: null`). */
	fields: Partial<Fields>;
	/** Replacement Markdown body when non-empty in `parent.md`; `undefined` preserves the existing body. */
	body?: string;
}

/** Complete validated refinement proposal persisted in `RefinementAttempt.acceptance` before landing or
 * creating tracker issues. `children` is topologically ordered: every parent and blocker precedes its dependents. */
export interface RefinementProposal {
	children: ProposedChild[];
	parent?: ProposedParent;
	/** Pre-existing open direct children of the refined node retained unchanged. */
	retained: string[];
}

export interface RefinementAcceptanceReceipt {
	reportTs: string;
	report: string;
	/** Open direct children of the refined node (reported aliases initially; actual created + retained IDs once created). */
	children: string[];
	into: string;
	destination: string;
	/** Validated proposal persisted before landing stubs or creating tracker issues. Absent only on historical terminal records. */
	proposal?: RefinementProposal;
	/** Map from `ProposedChild.alias` to the tracker's actual created identity (vault: alias; GitHub: `gh-N`). */
	created?: Record<string, string>;
	/** Stripped interface HEAD prepared before collector fast-forward, or collector HEAD when no code changed. */
	preparedHead?: string;
	/** Collector HEAD after interface commits landed (equals collector HEAD when no code changed). */
	landedHead?: string;
}

function requireProposal(value: unknown, message: string): asserts value {
	if (!value) throw new Error("Invalid refinement proposal: " + message);
}
const validSlug = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value);
function relation(value: unknown): string {
	requireProposal(typeof value === "string", "expected issue slug or wikilink");
	const slug = /^\[\[projects\/[^/\[\]#|\s]+\/issues\/(?:archive\/)?([^/\[\]#|\s]+)(?:\|[^\[\]\r\n]+)?\]\]$/.exec(value)?.[1] ?? value;
	requireProposal(validSlug(slug), "invalid issue slug " + value);
	return slug;
}

function ordered(ids: Iterable<string>, edges: (id: string) => string[], kind: string): string[] {
	const visiting = new Set<string>(), done = new Set<string>();
	const visit = (id: string) => {
		if (done.has(id)) return;
		requireProposal(!visiting.has(id), kind + " cycle at " + id);
		visiting.add(id);
		for (const edge of edges(id)) visit(edge);
		visiting.delete(id); done.add(id);
	};
	for (const id of ids) visit(id);
	return [...done];
}

export function readProposal(cwd: string, tracker: Tracker, node: string, root: string, reported: string[]): RefinementProposal {
	const rows = tracker.snapshot(), parent = rows.get(node);
	requireProposal(parent && !parent.archived && !parent.done && parent.ready, "not an open ready node: " + node);
	const original = tracker.fields(node);
	const retained = [...rows.values()].filter(row => row.partOf === node && !row.done && !row.archived).map(row => row.slug);
	const proposal: RefinementProposal = { children: [], retained };
	const children = new Map<string, ProposedChild>();
	const head = git(cwd, "rev-parse", "HEAD");
	for (const entry of git(cwd, "ls-tree", "-rz", head, "--", PROPOSAL_DIR).split("\0").filter(Boolean)) {
		const [stat, path] = entry.split(/\t(.*)/s);
		const alias = /^\.reconcile\/proposal\/children\/([^/]+)\.md$/.exec(path)?.[1];
		requireProposal(stat.startsWith("100644 blob ") && (path === PROPOSAL_PARENT_FILE || alias && validSlug(alias)), "unexpected file " + path);
		const raw = execFileSync("git", ["-C", cwd, "show", head + ":" + path], { encoding: "utf8" });
		requireProposal(!raw.includes("<!-- mlegls-pi:tracker"), "reserved tracker envelope: " + path);
		const { doc, body } = contract(raw), fields: Fields = doc.toJS({ maxAliasCount: 0 });
		const isParent = !alias;
		for (const key of Object.keys(fields)) requireProposal(!key.startsWith("$") && !["github", "github-comments", "github-types", "claimed-by", "next", "__proto__"].includes(key), "reserved field " + key);
		requireProposal(fields.priority == null || [1, 2, 3].includes(Number(fields.priority)) && typeof fields.priority === "number", "priority must be 1, 2 or 3");
		requireProposal(fields.drive == null || fields.drive === "none" || fields.drive === "always", "invalid drive");
		requireProposal(fields.decompose == null || typeof fields.decompose === "boolean", "invalid decompose");
		requireProposal(!("title" in fields) || typeof fields.title === "string" && fields.title.trim(), "empty title");
		requireProposal(fields.stage == null || fields.stage === "ready", "stage must be ready");
		if (fields["blocked-by"] != null) {
			requireProposal(Array.isArray(fields["blocked-by"]), "blocked-by must be a list");
			fields["blocked-by"] = fields["blocked-by"].map(b => typeof b === "string" && GUARD_PATTERN.test(b) ? b : relation(b));
		}
		if (isParent) {
			requireProposal(!("part-of" in fields || "author" in fields), "parent cannot be moved or reauthored");
			proposal.parent = { fields, ...(body.trim() ? { body } : {}) };
		} else {
			requireProposal(!rows.has(alias) && body.trim(), "duplicate slug or empty contract: " + alias);
			fields["part-of"] = relation(fields["part-of"]);
			fields.author ??= original.author ?? "reconcile:" + root;
			requireProposal(typeof fields.author === "string" && fields.author.trim(), "invalid author");
			children.set(alias, { alias, body, fields });
		}
	}
	const graph = new Map([...rows].map(([id, r]) => [id, { parent: r.partOf, blockers: r.blockedBy, stage: r.ownStage, assignee: r.assignee, closed: r.archived || r.done }]));
	const overlay = (id: string, fields: Fields) => {
		const row = graph.get(id)!;
		if ("blocked-by" in fields) row.blockers = ((fields["blocked-by"] ?? []) as string[]).filter(b => !GUARD_PATTERN.test(b));
		if ("stage" in fields) row.stage = fields.stage as "ready" | null;
		if ("assignee" in fields) row.assignee = fields.assignee as string | null;
	};
	for (const [id, child] of children) {
		const p = child.fields["part-of"] as string;
		requireProposal(p === node || children.has(p), "unrooted child " + id);
		graph.set(id, { parent: p, blockers: [], stage: null, assignee: null, closed: false });
		overlay(id, child.fields);
	}
	if (proposal.parent) overlay(node, proposal.parent.fields);
	const kids = new Map<string, string[]>();
	for (const [id, row] of graph) {
		if (row.parent) { const list = kids.get(row.parent) ?? []; list.push(id); kids.set(row.parent, list); }
		for (const b of row.blockers) requireProposal(graph.has(b), "missing blocker " + b);
	}
	const blockers = (id: string) => graph.get(id)!.blockers;
	ordered(graph.keys(), id => [...blockers(id), ...(kids.get(id) ?? [])], "completion");
	const deps = (id: string) => [graph.get(id)!.parent!, ...blockers(id)].filter(d => children.has(d));
	proposal.children = ordered(children.keys(), deps, "creation order").map(id => children.get(id)!);
	const validateScope = (id: string) => {
		const row = graph.get(id)!;
		if (row.closed) return;
		const sub = kids.get(id) ?? [];
		requireProposal(row.stage === "ready" || row.stage === null && sub.length, "missing ready residual or children: " + id);
		if (row.stage || row.assignee) requireProposal(parseAssignee(row.assignee)?.kind === "agent" || id === root && !row.assignee, "not agent-assigned: " + id);
		requireProposal(!rows.get(id)?.claims.some(c => c.claimedBy !== "reconcile:" + root), "foreign claim on " + id);
		for (const kid of sub) validateScope(kid);
	};
	validateScope(node);
	const direct = directChildrenOf(proposal, node);
	requireProposal(new Set(reported).size === direct.length && reported.length === direct.length && direct.every(id => reported.includes(id)), "report must name open direct children: " + direct.join(", "));
	if (!direct.length) requireProposal(graph.get(node)!.stage === "ready" && proposal.parent?.fields.decompose === false, "promotion requires decompose: false in parent.md");
	return proposal;
}

/** Build stripped trees in a private index. Change the branch only after the full replay succeeds. */
export function stripProposalCommits(cwd: string, base: string): string {
	const temp = mkdtempSync(join(tmpdir(), "refine-index-"));
	const cmd = (...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: { ...process.env, GIT_INDEX_FILE: join(temp, "index") } }).trimEnd();
	try {
		let parent = base, previous = git(cwd, "rev-parse", base + "^{tree}");
		for (const id of git(cwd, "rev-list", "--first-parent", "--reverse", base + "..HEAD").split("\n").filter(Boolean)) {
			cmd("read-tree", id);
			cmd("rm", "--cached", "-qr", "--ignore-unmatch", "--", PROPOSAL_DIR);
			const tree = cmd("write-tree");
			if (tree === previous) continue;
			parent = git(cwd, "rev-parse", id + "^") === parent && tree === git(cwd, "rev-parse", id + "^{tree}")
				? id : cmd("commit-tree", tree, "-p", parent, "-m", cmd("show", "-s", "--format=%B", id));
			previous = tree;
		}
		git(cwd, "reset", "--hard", parent);
		return parent;
	} finally { rmSync(temp, { recursive: true, force: true }); }
}

const GUARD_PATTERN = /^[a-z][a-z0-9-]*: \S/;

/** Resolve sibling aliases in a proposed child's relations using already-created IDs and attach the stable run claim.
 * Shared by refinement acceptance and GitHub tracker creation authority so both sides agree on exact `Tracker.create` inputs. */
export function resolveProposedChild(
	child: ProposedChild,
	created: Readonly<Record<string, string>>,
	stableClaim: string,
): NewIssue {
	const fields: Fields = normalizeStageFields({ ...structuredClone(child.fields), "claimed-by": stableClaim });
	// A delegated container can omit its residual only after its children exist.
	fields.stage ??= "ready";
	if (typeof fields["part-of"] === "string") {
		fields["part-of"] = Object.hasOwn(created, fields["part-of"]) ? created[fields["part-of"]] : fields["part-of"];
	}
	if (Array.isArray(fields["blocked-by"])) {
		fields["blocked-by"] = fields["blocked-by"].map(entry =>
			typeof entry === "string" && !GUARD_PATTERN.test(entry) ? (Object.hasOwn(created, entry) ? created[entry] : entry) : entry,
		);
	}
	return { slug: child.alias, fields, body: child.body };
}

/** Open direct children of `node` implied by `proposal`, mapped through `created` once actual tracker IDs exist. */
export function directChildrenOf(
	proposal: RefinementProposal,
	node: string,
	created: Readonly<Record<string, string>> = {},
): string[] {
	return [
		...proposal.retained,
		...proposal.children
			.filter(child => child.fields["part-of"] === node)
			.map(child => Object.hasOwn(created, child.alias) ? created[child.alias] : child.alias),
	];
}
