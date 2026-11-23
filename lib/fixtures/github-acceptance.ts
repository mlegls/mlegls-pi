import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROLES, installFakeGh, issue, newState } from "./fake-github.ts";
import { git } from "../thread/git.ts";
import type { GlobalRunState } from "../reconcile/tracker-state.ts";
import type { ProposedChild } from "../reconcile/proposal.ts";
import { getGithubTracker } from "../tracker-github.ts";

export function setupCheckout(dir: string, issues: ReturnType<typeof issue>[]) {
	const cwd = join(dir, "checkout");
	mkdirSync(cwd, { recursive: true });
	git(cwd, "init", "-q");
	configureGithub(cwd);
	git(cwd, "add", "docs");
	git(cwd, "-c", "user.name=fixture", "-c", "user.email=fixture@localhost", "-c", "commit.gpgSign=false", "commit", "-qm", "Collector");
	return { cwd, fake: installFakeGh(join(dir, "bin"), newState(issues)) };
}
export function configureGithub(cwd: string) {
	mkdirSync(join(cwd, "docs/agents"), { recursive: true });
	git(cwd, "remote", "add", "origin", "https://github.com/fixture/tracker.git");
	writeFileSync(join(cwd, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: fixture/tracker\n");
	writeFileSync(join(cwd, "docs/agents/triage-labels.md"), ["| Role | Label |", "| --- | --- |", ...ROLES.map(role => "| " + role + " | " + role + " |")].join("\n"));
}
export function proposed(alias: string, parent: string, blockers?: string[]): ProposedChild {
	return { alias, fields: { stage: "ready", assignee: "agent", author: "session:fixture", "part-of": parent, ...(blockers && { "blocked-by": blockers }) }, body: alias + "\n" };
}
export function accepting(cwd: string, node: string, children: ProposedChild[]) {
	return { node, handle: node, phase: "accepting" as const, acceptance: {
		destination: cwd, landedHead: git(cwd, "rev-parse", "HEAD"), proposal: { children, retained: [] }, created: {} as Record<string, string>,
		reportTs: "fixture", report: "done", children: children.map(child => child.alias), into: cwd,
	} };
}
export function saveRun(cwd: string, root: string, refinements: GlobalRunState["refinements"] = {}) {
	const dir = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "reconcile");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, root + ".json"), JSON.stringify({ backend: "threads", root, cwd, landed: {}, results: {}, landingOps: {}, refinements }));
}

// Try the claimed-create surface with an optional replacement claim or body.
if (import.meta.main) {
	const dir = mkdtempSync(join(tmpdir(), "github-acceptance-"));
	try {
		const { cwd } = setupCheckout(dir, [issue(1)]);
		const child = proposed("base", "gh-1");
		saveRun(cwd, "gh-1", { "gh-1": accepting(cwd, "gh-1", [child]) });
		const tracker = getGithubTracker(cwd, { run: "gh-1" })!;
		const request = { slug: child.alias, fields: { ...child.fields, "claimed-by": process.argv[2] ?? "reconcile:gh-1" }, body: process.argv[3] ?? child.body };
		const created = tracker.create(request);
		console.log({ created, replay: tracker.create(request), fields: tracker.fields(created) });
	} finally { rmSync(dir, { recursive: true, force: true }); }
}
