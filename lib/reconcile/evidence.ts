import { spawnSync } from "node:child_process";
import { basename, dirname, extname, posix, relative, resolve } from "node:path";
import { findIssuesDir, MARKDOWN_LINK, maskMarkdownCode, projectName, WIKILINK } from "../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts";
import type { Issue, Tracker } from "../tracker.ts";
import { git } from "./checks.ts";
import type { GlobalRunState } from "./tracker-state.ts";

export const EVIDENCE_MISSING = "cited evidence missing on target";

/** Use the tracker's Markdown rules and canonical issue location, even from a
 * worker checkout. Only this project's committed attachments belong to this gate. */
export function attachmentLinks(cwd: string, tracker: Tracker, slug: string, issue?: Issue): string[] {
	const dir = findIssuesDir(cwd, false);
	const root = dir ? dirname(dirname(dir)) : resolve(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "..");
	const project = dir ? projectName(dir) : basename(root);
	const file = issue?.file ? relative(root, issue.file) : "docs/issues/" + slug + ".md";
	const body = maskMarkdownCode(tracker.text(slug).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""));
	const paths = new Set<string>();
	const add = (path: string) => {
		const normalized = posix.normalize(path);
		if (normalized.startsWith("docs/attachments/")) paths.add(normalized);
	};
	for (const match of body.matchAll(WIKILINK)) {
		const prefix = "projects/" + project + "/attachments/";
		const path = match[1].trim().replace(/\\$/, "");
		if (path.startsWith(prefix)) {
			const tail = path.slice(prefix.length);
			add("docs/attachments/" + tail + (extname(tail) ? "" : ".md"));
		}
	}
	const definitions = /^\s{0,3}\[[^\]\r\n]+\]:\s*(<[^>\r\n]*>|[^\s\r\n]+)/gm;
	for (const match of [...body.matchAll(MARKDOWN_LINK), ...body.matchAll(definitions)]) {
		const destination = match[1].replace(/^<|>$/g, "");
		if (/^(?:[a-z][a-z\d+.-]*:|#|\/|\\)/i.test(destination)) continue;
		const pathname = destination.split("#")[0];
		let decoded: string;
		try { decoded = decodeURIComponent(pathname.replace(/\\([\\()[\] ])/g, "$1")); }
		catch { decoded = pathname; }
		// The tracker also recognizes repository-root paths for repair.
		add(decoded.startsWith("docs/attachments/") ? decoded : posix.join(posix.dirname(file), decoded));
	}
	return [...paths].sort();
}

/** Capture once before a node's first writer, retaining every superseded branch. */
export function beginEvidenceScope(state: GlobalRunState, tracker: Tracker, slug: string, cwd: string, base: string, branch: string): void {
	const scopes = state.evidenceScopes ??= {};
	const scope = scopes[slug] ??= { body: attachmentLinks(cwd, tracker, slug, tracker.snapshot().get(slug)), base, branches: [] };
	if (!scope.branches.includes(branch)) scope.branches.push(branch);
}

function present(cwd: string, ref: string, path: string): boolean {
	const run = spawnSync("git", ["-C", cwd, "cat-file", "-e", ref + ":" + path], { encoding: "utf8" });
	if (run.error || run.signal) throw run.error ?? new Error("git cat-file killed by " + run.signal);
	return run.status === 0;
}

/** A close is proof about the current target tree, never a worker's HEAD or its
 * filesystem. Old body links are owned only when this node's branches added them. */
export function targetEvidenceFailure(state: GlobalRunState, tracker: Tracker, slug: string, issue?: Issue): string | undefined {
	const remote = (state.land ?? "local") !== "local";
	const cwd = remote ? state.pr!.path : state.cwd;
	const ref = git(cwd, "rev-parse", remote ? "refs/remotes/" + state.pr!.remote + "/" + state.pr!.baseBranch : "HEAD");
	const result = state.results[slug], operation = state.landingOps[slug], scope = state.evidenceScopes?.[slug];
	const packet = result.handoff.evidence as { path?: string; shots?: string[] } | undefined;
	const required = new Set([result.evidence, packet?.path, ...(packet?.shots ?? [])].filter((p): p is string => typeof p === "string"));
	const links = attachmentLinks(cwd, tracker, slug, issue);
	// Older receipts lack the initial body snapshot: only provable branch additions
	// are attributed to them; the handoff's own packet is always required.
	const baseline = new Set(scope?.body ?? links);
	const branches = [...new Set([...(scope?.branches ?? []), ...(operation?.workers.map(w => w.handle) ?? [])])]
		.map(branch => "refs/heads/" + branch)
		.filter(branch => {
			const run = spawnSync("git", ["-C", cwd, "show-ref", "--verify", "--quiet", branch]);
			if (run.error || (run.status !== 0 && run.status !== 1)) throw run.error ?? new Error("Cannot resolve evidence branch " + branch);
			return run.status === 0;
		});
	for (const path of links) {
		if (present(cwd, ref, path)) continue;
		const exclusions = [...new Set([scope?.base, operation?.before].filter((p): p is string => !!p))];
		const added = branches.length && exclusions.length && git(cwd, "log", "--diff-filter=A", "-1", "--format=%H",
			...branches, "--not", ...exclusions, "--", path);
		if (!baseline.has(path) || added) required.add(path);
	}
	const missing = [...required].filter(path => !present(cwd, ref, path)).sort();
	if (!missing.length) return;
	const locations = missing.map(path => {
		const commit = git(cwd, "log", "--all", "-1", "--diff-filter=AM", "--format=%H", "--", path);
		if (!commit || !present(cwd, commit, path)) return "- " + path + " (no committed copy found)";
		const refs = git(cwd, "for-each-ref", "--contains=" + commit, "--format=%(refname:short)", "refs/heads", "refs/remotes").split("\n").filter(Boolean);
		return "- " + path + " — " + commit + (refs.length ? " (" + refs.join(", ") + ")" : "");
	});
	return slug + ": " + EVIDENCE_MISSING + " at " + ref + "\n" + locations.join("\n")
		+ "\nCode is already landed; the issue stays open. Carry the cited files to the target or correct the tracker links, then retry close.";
}
