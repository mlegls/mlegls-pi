import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { git } from "./checks.ts";
import { excludeTracker } from "../thread/tracker-worktree.ts";
import type { GlobalRunState } from "./tracker-state.ts";
import type { LandingMode, PullRequestHost } from "./pr-types.ts";

export function landingMode(value: unknown): LandingMode {
	if (value !== "local" && value !== "pr-merge" && value !== "pr-review")
		throw new Error("Invalid reconcile landing mode: " + JSON.stringify(value));
	return value;
}

/** Read the owner's committed configuration, never dirty worktree contents.
 * A saved pre-PR state is local regardless of later project configuration. */
export function resolveLanding(cwd: string, explicit?: LandingMode, prior?: GlobalRunState): LandingMode {
	if (explicit !== undefined) landingMode(explicit);
	if (prior) {
		const captured = landingMode(prior.land ?? "local");
		if (explicit !== undefined && explicit !== captured)
			throw new Error("Run already captured --land " + captured + "; cannot resume with " + explicit);
		return captured;
	}
	if (explicit !== undefined) return explicit;
	const file = git(cwd, "ls-tree", "HEAD", "--", ".pi/reconcile.json");
	if (!file) return "local";
	let config: unknown;
	try { config = JSON.parse(git(cwd, "show", "HEAD:.pi/reconcile.json")); }
	catch { throw new Error("Malformed committed .pi/reconcile.json"); }
	if (!config || typeof config !== "object" || Array.isArray(config))
		throw new Error("Expected an object in committed .pi/reconcile.json");
	const value = (config as { land?: unknown }).land;
	return value === undefined ? "local" : landingMode(value);
}

/** Identity is written before any branch/worktree creation. The fetched seed is
 * also written first, so recovery adopts only this run's exact resources. */
export function prepareStaging(state: GlobalRunState, host: PullRequestHost, save: () => void, repositoryCwd = state.cwd): void {
	if ((state.land ?? "local") === "local") return;
	if (!state.pr) {
		const project = host.project(state.cwd);
		const common = git(state.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir");
		const area = resolve(common, "..") + "__worktrees";
		const id = createHash("sha256").update(state.cwd + "\0" + state.root).digest("hex").slice(0, 12);
		const name = state.root + "-" + id;
		state.pr = { ...project, path: resolve(area, name + "--pr"), branch: "reconcile/pr/" + name,
			phase: "preparing", repairs: 0, integrationFailures: 0,
			reviews: { processed: [], repaired: [], replies: {} } };
		save();
	}
	const pr = state.pr;
	if (existsSync(pr.path)) {
		if (git(pr.path, "rev-parse", "--path-format=absolute", "--git-common-dir") !==
			git(repositoryCwd, "rev-parse", "--path-format=absolute", "--git-common-dir") ||
			git(pr.path, "branch", "--show-current") !== pr.branch)
			throw new Error("PR staging identity mismatch: " + pr.path);
	} else {
		if (pr.phase !== "preparing") throw new Error("Recorded PR staging checkout is missing: " + pr.path);
		// Never guess/adopt a similarly named branch or another checkout.
		if (!pr.baseHead) {
			git(state.cwd, "fetch", pr.remote, "+refs/heads/" + pr.baseBranch + ":refs/remotes/" + pr.remote + "/" + pr.baseBranch);
			pr.baseHead = git(state.cwd, "rev-parse", "refs/remotes/" + pr.remote + "/" + pr.baseBranch);
			save();
		}
		const branch = git(state.cwd, "branch", "--list", pr.branch);
		if (branch) {
			if (git(state.cwd, "rev-parse", "refs/heads/" + pr.branch) !== pr.baseHead)
				throw new Error("PR staging branch exists without its recorded checkout: " + pr.branch);
			git(state.cwd, "worktree", "add", "--no-checkout", "-q", pr.path, pr.branch);
		} else git(state.cwd, "worktree", "add", "--no-checkout", "-q", "-b", pr.branch, pr.path, pr.baseHead);
	}
	excludeTracker(pr.path);
}
