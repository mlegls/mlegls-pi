import { normalizeStageFields } from "../stage.ts";
import type { Fields, NewIssue } from "../tracker.ts";

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

const GUARD_PATTERN = /^[a-z][a-z0-9-]*: \S/;

/** Resolve sibling aliases in a proposed child's relations using already-created IDs and attach the stable run claim.
 * Shared by refinement acceptance and GitHub tracker creation authority so both sides agree on exact `Tracker.create` inputs. */
export function resolveProposedChild(
	child: ProposedChild,
	created: Readonly<Record<string, string>>,
	stableClaim: string,
): NewIssue {
	const fields: Fields = normalizeStageFields({ ...structuredClone(child.fields), "claimed-by": stableClaim });
	if (typeof fields["part-of"] === "string") {
		fields["part-of"] = created[fields["part-of"]] ?? fields["part-of"];
	}
	if (Array.isArray(fields["blocked-by"])) {
		fields["blocked-by"] = fields["blocked-by"].map(entry =>
			typeof entry === "string" && !GUARD_PATTERN.test(entry) ? (created[entry] ?? entry) : entry,
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
			.map(child => created[child.alias] ?? child.alias),
	];
}
