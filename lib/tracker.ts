import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { getGithubTracker } from "./tracker-github.ts";
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
	/** Optional backend capability. Vault omits it; GitHub returns the issue's native
	 * identity regardless of its logical slug, for reconciled PR closing references. */
	githubIssue?(slug: string): { repository: string; number: number; url: string };
	/** Optional remote publication of a supervised move-out. Local trackers retain
	 * their existing owner-edited move-out protocol. */
	moveOut?(slug: string, reason: string): void;
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
	/** Reconciler root for backend-private ownership/promotion receipts. Workers
	 * use PI_WM_RUN when omitted; this never turns a native assignee into authority. */
	run?: string;
	/** Default true. Reconciler observation omits the derived inflight display overlay. */
	inflight?: boolean;
	/** The issues.ts to run; default TRACKER_CLI, else the one bundled beside this module. */
	cli?: string;
}

/** A tracker subprocess failure with what it said on stderr, or, when it said nothing, how it ended: a bare "Command
 * failed" hid four snapshot failures under load (2026-10-16). */
export function trackerFailure(error: unknown): string {
	const e = error as Error & { stderr?: string | Buffer; status?: number | null; signal?: string | null; code?: string };
	const stderr = String(e.stderr ?? "").trim();
	if (stderr) return stderr;
	const command = (e.message ?? String(error)).split("\n")[0];
	const how = e.signal ? "killed by " + e.signal : typeof e.status === "number" ? "exit status " + e.status : e.code ?? "no exit status";
	return command + " (" + how + ", nothing on stderr)";
}

/** Canonical vault wins; otherwise select the canonical project convention.
 * Vault subprocesses isolate inflight state and honor CLI overrides. GitHub keeps
 * one adapter (and its captured repository) for the lifetime of the caller. */
export function getTracker(cwd: string, options: TrackerOptions = {}): Tracker {
	if (!findIssuesDir(cwd, false)) {
		const github = getGithubTracker(cwd, options);
		if (github) return github;
		findIssuesDir(cwd);
	}
	const cli = options.cli ?? process.env.TRACKER_CLI ?? join(import.meta.dir, "../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
	const run = (args: string[], input?: string) => {
		try {
			return execFileSync("bun", [cli, ...args], {
				cwd, input, encoding: "utf8", maxBuffer: 64 << 20,
				env: { ...process.env, ...(options.run ? { PI_WM_RUN: options.run } : {}), ...(options.inflight === false ? { TRACKER_NO_INFLIGHT: "1" } : {}) },
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (error) {
			throw new Error(trackerFailure(error));
		}
	};
	// A read is safe to repeat: one that fails with no diagnostic (a killed or crashed subprocess under load) is
	// retried once before it fails a reconciler tick. Both failures are reported when the retry fails too.
	const read = (args: string[]) => {
		try { return run(args); }
		catch (first) {
			try { return run(args); }
			catch (second) {
				const a = (first as Error).message, b = (second as Error).message;
				throw new Error(a === b ? b + " (failed twice)" : b + " (first attempt: " + a + ")");
			}
		}
	};
	return {
		snapshot: scope => new Map((JSON.parse(read(["snapshot", ...(scope ? [scope] : []), "--json"])).issues as Issue[]).map(i => [i.slug, i])),
		text: slug => read(["text", slug]),
		fields: slug => JSON.parse(read(["fields", slug, "--json"])),
		create: issue => run(["create", issue.slug, "--fields", JSON.stringify(issue.fields), "--body-file", "-"], issue.body).trim(),
		update: (slug, fields, body) => { run(["update", slug, "--fields", JSON.stringify(fields), ...(body === undefined ? [] : ["--body-file", "-"])], body); },
		close: (slug, result) => { run(["close", slug, ...(result.summary === undefined ? [] : ["--summary", result.summary]), ...(result.evidence === undefined ? [] : ["--evidence", result.evidence])]); },
		remove: slug => { run(["remove", slug]); },
	};
}
