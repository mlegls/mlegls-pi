/** Global tracker contract. Implementation belongs to global-vault-tracker-backend. */
export type Stage = "idea" | "goal" | "spec" | "ticket" | "done";

/** Lifecycle projection, matching issues.ts snapshot --json (not legacy rows).
 * file is an optional backend locator; consumers use text/fields rather than opening it. */
export interface Issue {
	slug: string;
	file?: string;
	archived: boolean;
	ownStage: Stage | null;
	effectiveStage: Stage | null;
	partOf: string | null;
	assignee: string | null;
	author?: string | null;
	priority?: number | null;
	blockedBy: string[];
	guards: string[];
	ready: boolean;
	eligible: boolean;
	frontier: boolean;
	deferred: boolean;
	done: boolean;
	claims: { slug: string; claimedBy: string; derived?: boolean }[];
	selectors: { slug: string; assignee: string | null }[];
}

/** Frontmatter-equivalent keys; relations are logical slugs, guards remain strings.
 * Unknown metadata survives reads/writes. In an update, null removes a key. */
export type Fields = Record<string, unknown>;

export interface NewIssue {
	/** Requested identity; create returns the backend's actual identity. */
	slug: string;
	fields: Fields;
	/** Markdown body, without frontmatter. */
	body: string;
}
export interface Result { summary?: string; evidence?: string }

export interface Tracker {
	snapshot(scope?: string): Map<string, Issue>;
	/** Complete contract text, including metadata, suitable for a worker prompt. */
	text(slug: string): string;
	fields(slug: string): Fields;
	create(issue: NewIssue): string;
	/** body, when supplied (including ""), replaces the whole Markdown body. */
	update(slug: string, fields: Partial<Fields>, body?: string): void;
	close(slug: string, result: Result): void;
	/** Only for provisional children owned by the caller. */
	remove(slug: string): void;
}

export interface TrackerOptions {
	/** Default true. Reconciler observation omits the derived inflight display overlay. */
	inflight?: boolean;
}

/** Select by the project's tracker convention; vault detection uses the canonical checkout.
 * Stub only: no active caller until the vault backend lands. */
export function getTracker(_cwd: string, _options: TrackerOptions = {}): Tracker {
	throw new Error("Tracker backend not implemented: global-vault-tracker-backend");
}
