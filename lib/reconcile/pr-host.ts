import type { PullRequestHost } from "./pr-types.ts";

/** Filled by reconcile-github-pr-transport; use the project's existing gh authentication. */
export function createPullRequestHost(): PullRequestHost {
	throw new Error("reconcile-github-pr-transport has not filled createPullRequestHost");
}
