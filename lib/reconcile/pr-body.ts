import { git } from "./checks.ts";
import type { Tracker } from "../tracker.ts";
import type { GlobalRunState } from "./tracker-state.ts";

/** Build once from saved reviewed results, not worker branches or logical slug numbers. */
export function publication(state: GlobalRunState, tracker: Tracker): { title: string; body: string } {
	const pr = state.pr!, root = state.results[state.root];
	if (!root) throw new Error("PR has no saved root reviewed result");
	const nodes = Object.keys(state.landed).filter(slug => state.landed[slug].into === pr.path);
	if (!nodes.includes(state.root)) throw new Error("Root has not reached PR staging");
	const files = git(pr.path, "ls-tree", "-r", "--name-only", "HEAD").split("\n");
	const template = [".github/pull_request_template.md", ".github/PULL_REQUEST_TEMPLATE.md",
		"docs/pull_request_template.md", "docs/PULL_REQUEST_TEMPLATE.md", "pull_request_template.md",
		"PULL_REQUEST_TEMPLATE.md", ...files.filter(file => /^\.github\/(?:PULL_REQUEST_TEMPLATE|pull_request_template)\/[^/]+\.md$/.test(file)).sort()].find(file => files.includes(file));
	const evidence = nodes.map(slug => {
		const result = state.results[slug];
		if (!result) throw new Error("PR has no carried reviewed result: " + slug);
		return "### " + slug + "\n\n" + result.summary + "\n\n" +
			(result.evidence ? "Evidence: " + result.evidence + "\n\n" : "") +
			"Reviewed outcomes:\n\n" + JSON.stringify(result.handoff.stories ?? [], null, 2);
	}).join("\n\n");
	const references: string[] = [];
	if (tracker.githubIssue) {
		const native = (slug: string) => {
			const issue = tracker.githubIssue!(slug);
			if (issue.repository.toLowerCase() !== pr.repository.toLowerCase() ||
				!Number.isSafeInteger(issue.number) || issue.number < 1)
				throw new Error("PR closing reference is not in " + pr.repository + ": " + slug);
			return issue.number;
		};
		for (const slug of nodes) references.push("Closes #" + native(slug));
		if (root.parent && !nodes.includes(root.parent) && !tracker.snapshot().get(root.parent)?.done)
			references.push("Part of #" + native(root.parent));
	}
	const title = root.summary.split("\n").find(line => line.trim())?.replace(/^#+\s*/, "").slice(0, 200) || state.root;
	const body = [template ? git(pr.path, "show", "HEAD:" + template) : "", root.summary,
		"## Evidence\n\n**Before:** reviewed root staged at " + state.landed[state.root].head +
		"; target closure remains pending.\n\n**After:** saved reviewed results carried by this PR:\n\n" + evidence,
		"## Danger\n\n**Door:** two-way. Published Git history is preserved; revert rather than rewrite.\n" +
		"**Blast radius:** repository. Integration gates and carried reviewer checks cover the staged change.",
		references.join("\n")].filter(Boolean).join("\n\n");
	return { title, body };
}
