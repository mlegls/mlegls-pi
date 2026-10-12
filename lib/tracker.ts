import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { findIssuesDir } from "../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts";

/** Global tracker contract. */
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
	/** The issues.ts to run; default TRACKER_CLI, else the one bundled beside this module. */
	cli?: string;
}

/** Select by project convention; every operation uses the bundled canonical CLI.
 * A subprocess keeps per-query inflight state isolated and honors TRACKER_CLI. */
export function getTracker(cwd: string, options: TrackerOptions = {}): Tracker {
	findIssuesDir(cwd);
	const cli = options.cli ?? process.env.TRACKER_CLI ?? join(import.meta.dir, "../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
	const run = (args: string[], input?: string) => {
		try {
			return execFileSync("bun", [cli, ...args], {
				cwd, input, encoding: "utf8", maxBuffer: 64 << 20,
				env: { ...process.env, ...(options.inflight === false ? { TRACKER_NO_INFLIGHT: "1" } : {}) },
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (error) {
			const e = error as Error & { stderr?: string };
			throw new Error(e.stderr?.trim() || e.message);
		}
	};
	return {
		snapshot: scope => new Map((JSON.parse(run(["snapshot", ...(scope ? [scope] : []), "--json"])).issues as Issue[]).map(i => [i.slug, i])),
		text: slug => run(["text", slug]),
		fields: slug => JSON.parse(run(["fields", slug, "--json"])),
		create: issue => run(["create", issue.slug, "--fields", JSON.stringify(issue.fields), "--body-file", "-"], issue.body).trim(),
		update: (slug, fields, body) => { run(["update", slug, "--fields", JSON.stringify(fields), ...(body === undefined ? [] : ["--body-file", "-"])], body); },
		close: (slug, result) => { run(["close", slug, ...(result.summary === undefined ? [] : ["--summary", result.summary]), ...(result.evidence === undefined ? [] : ["--evidence", result.evidence])]); },
		remove: slug => { run(["remove", slug]); },
	};
}
