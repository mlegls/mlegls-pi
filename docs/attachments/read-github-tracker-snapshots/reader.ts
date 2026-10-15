#!/usr/bin/env bun
// One-off first-use controller, not a retained test suite. Prints counts only.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getGithubTracker } from "../../../lib/tracker-github.ts";
import { githubProject, invalidateGithubSnapshot, withGithubLock } from "../../../lib/tracker-github-snapshot.ts";
import { parse } from "yaml";

const mode = process.argv[2];
const root = mkdtempSync(join(tmpdir(), "tracker-read-first-use-"));
const previousPath = process.env.PATH!;
const realGh = Bun.which("gh")!;
const log = join(root, "requests");
const response = join(root, "response.json");
writeFileSync(log, "");
const wrapper = join(root, "gh");
writeFileSync(wrapper, [
	"#!/usr/bin/env bun",
	'import { appendFileSync, readFileSync } from "node:fs";',
	'import { execFileSync } from "node:child_process";',
	"const input = readFileSync(0, 'utf8');",
	"const op = JSON.parse(input).query.match(/(?:query|mutation)\\s+(\\w+)/)?.[1] ?? 'unnamed';",
	"appendFileSync(" + JSON.stringify(log) + ", op + '\\n');",
	mode === "fixture" ? "process.stdout.write(readFileSync(" + JSON.stringify(response) + ", 'utf8'));" :
		"process.stdout.write(execFileSync(" + JSON.stringify(realGh) + ", process.argv.slice(2), {input, maxBuffer:64<<20, timeout:120000}));",
].join("\n"));
chmodSync(wrapper, 0o700);
process.env.PATH = root + ":" + previousPath;
const requests = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
const cold = (cwd: string) => {
	const project = githubProject(cwd)!;
	withGithubLock(project, () => invalidateGithubSnapshot(project));
};
const factory = (cwd: string) => {
	const tracker = getGithubTracker(cwd);
	if (!tracker) throw new Error("Target is not configured as GitHub");
	return tracker;
};
function inspect(cwd: string) {
	const tracker = factory(cwd);
	const rows = tracker.snapshot();
	const fields = [...rows.keys()].map(slug => tracker.fields(slug));
	const comments = fields.flatMap(field => field["github-comments"] as { createdAt: string; body: string }[]);
	const native = fields.map(field => field.github as { state: string; parent: unknown; subIssues: unknown[]; blockedBy: { state: string; repository: { nameWithOwner: string } }[]; assignees: unknown[] });
	const repository = native.length ? tracker.githubIssue!([...rows.keys()][0]!).repository : githubProject(cwd)!.repository;
	let roundtrips = 0;
	for (const slug of rows.keys()) {
		const text = tracker.text(slug);
		const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)!;
		const metadata = parse(frontmatter[1]!);
		if (metadata.title === tracker.fields(slug).title && Array.isArray(metadata["github-comments"])) roundtrips++;
	}
	const blockers = native.flatMap(issue => issue.blockedBy);
	return {
		issues: rows.size, open: native.filter(issue => issue.state === "OPEN").length,
		closed: native.filter(issue => issue.state === "CLOSED").length,
		ready: [...rows.values()].filter(issue => issue.ready).length,
		frontier: [...rows.values()].filter(issue => issue.frontier).length,
		parents: native.filter(issue => issue.subIssues.length).length,
		children: [...rows.values()].filter(issue => issue.partOf).length,
		comments: comments.length, issuesWithComments: fields.filter(field => (field["github-comments"] as unknown[]).length).length,
		openNativeBlockers: blockers.filter(issue => issue.state === "OPEN").length,
		closedNativeBlockers: blockers.filter(issue => issue.state === "CLOSED").length,
		foreignNativeBlockers: blockers.filter(issue => issue.repository.nameWithOwner !== repository).length,
		nativeAssignments: native.reduce((count, issue) => count + issue.assignees.length, 0),
		foreignClaims: [...rows.values()].flatMap(issue => issue.claims.filter(claim => claim.slug === issue.slug && claim.claimedBy.startsWith("github:"))).length,
		contractsWithTitleAndCommentMetadata: roundtrips,
	};
}

try {
	if (mode === "fixture") {
		const cwd = join(root, "checkout");
		mkdirSync(join(cwd, "docs/agents"), { recursive: true });
		execFileSync("git", ["init", "-q", cwd]);
		execFileSync("git", ["-C", cwd, "remote", "add", "origin", "https://github.com/fixture/tracker.git"]);
		writeFileSync(join(cwd, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: fixture/tracker\n");
		const roles = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"];
		const label = (role: string) => ({ id: "L-" + role, name: "renamed-" + role });
		writeFileSync(join(cwd, "docs/agents/triage-labels.md"), [
			"| Label in mattpocock/skills | Label in our tracker | Meaning |",
			"| --- | --- | --- |",
			...roles.map(role => "| " + String.fromCharCode(96) + role + String.fromCharCode(96) + " | " + String.fromCharCode(96) + label(role).name + String.fromCharCode(96) + " | fixture |"),
		].join("\n"));
		const repository = { id: "R-local", nameWithOwner: "fixture/tracker", url: "https://github.com/fixture/tracker" };
		const foreign = { id: "R-other", nameWithOwner: "fixture/other", url: "https://github.com/fixture/other" };
		const relation = (number: number, state = "OPEN", repo = repository) => ({
			id: repo.id + "-I" + number, number, url: repo.url + "/issues/" + number, state, repository: repo,
		});
		const pages = (nodes: unknown[]) => ({
			first: { totalCount: nodes.length, nodes: nodes.slice(0, 100) },
			last: { totalCount: nodes.length, nodes: nodes.slice(-100) },
		});
		const paired = (name: string, nodes: unknown[]) => {
			const connection = pages(nodes);
			return { [name + "First"]: connection.first, [name + "Last"]: connection.last };
		};
		const comments = Array.from({ length: 110 }, (_, n) => ({
			id: "C-" + n, body: "Synthetic comment " + n, createdAt: new Date(1_700_000_000_000 + n * 1000).toISOString(),
			author: { login: "commenter-" + n }, url: repository.url + "/issues/2#comment-" + n,
		}));
		const issue = (number: number, role = "ready-for-agent", state = "OPEN") => ({
			...relation(number, state), title: "Synthetic contract " + number, body: "Synthetic Markdown body.\n",
			stateReason: state === "CLOSED" ? "COMPLETED" : null, author: { login: "author" }, parent: null as unknown,
			...paired("children", []), ...paired("blockers", []), ...paired("labels", [label(role)]),
			...paired("assignees", []), ...paired("comments", []),
		});
		const issues = [issue(1), issue(2), issue(3, "ready-for-agent", "CLOSED"), issue(4, "ready-for-human"), issue(5), issue(6)];
		Object.assign(issues[0]!, paired("children", [relation(2)]));
		Object.assign(issues[1]!, { parent: relation(1), body: "Native contract body.\n\nCasual mention #4 is not an edge.\n\n<!-- mlegls-pi:tracker\n{\"risk\":\"fixture\",\"assignee\":\"agent:technical\"}\n-->\n" },
			paired("comments", comments), paired("blockers", [relation(3, "CLOSED"), relation(4, "OPEN", foreign)]));
		Object.assign(issues[4]!, paired("assignees", [{ id: "U-viewer", login: "reader" }]));
		issues[5]!.body = "Part of #1\nBlocked by: #5\n\nFallback contract.\n";
		const data = { viewer: { id: "U-viewer", login: "reader" }, repository: {
			...repository, ...paired("labels", roles.filter(role => role !== "needs-triage").map(label)), ...paired("issues", issues),
		} };
		const publish = (value: unknown = { data }) => { writeFileSync(response, JSON.stringify(value)); cold(cwd); };
		publish();
		const tracker = factory(cwd);
		const summary = inspect(cwd);
		execFileSync("git", ["-C", cwd, "add", "docs"]);
		execFileSync("git", ["-C", cwd, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Fixture conventions"]);
		const linked = join(root, "linked");
		execFileSync("git", ["-C", cwd, "worktree", "add", "--detach", "-q", linked, "HEAD"]);
		writeFileSync(join(linked, "docs/agents/issue-tracker.md"), "# Issue tracker: Vault\n");
		const canonicalFromLinked = factory(linked).snapshot().size;
		const warmBefore = requests().length;
		tracker.snapshot("gh-1"); tracker.text("gh-2"); tracker.fields("gh-5");
		const child = execFileSync("bun", ["-e", "import {getGithubTracker} from " + JSON.stringify(resolve(import.meta.dir, "../../../lib/tracker-github.ts")) + "; console.log(getGithubTracker(" + JSON.stringify(cwd) + ").snapshot().size)"], { encoding: "utf8" }).trim();
		const own = tracker.fields("gh-5")["claimed-by"];
		const row = tracker.snapshot().get("gh-2")!;
		const text = tracker.text("gh-2");
		const nativeBody = text.replace(/^---\n[\s\S]*?\n---\n/, "");
		const isolated = tracker.snapshot();
		isolated.get("gh-2")!.guards.length = 0;
		const changedFields = tracker.fields("gh-2");
		(changedFields["github-comments"] as unknown[]).length = 0;
		const observed = {
			...summary, canonicalFromLinked,
			isolatedProjections: tracker.snapshot().get("gh-2")!.guards.length === 1 && (tracker.fields("gh-2")["github-comments"] as unknown[]).length === 110, snapshotRequests: requests().length, warmAdditionalRequests: requests().length - warmBefore,
			secondProcessIssues: Number(child), viewerAssignmentClaim: own, foreignGuard: row.guards,
			closedLocalBlocker: row.blockedBy, childOwnStage: row.ownStage,
			humanEligible: tracker.snapshot().get("gh-4")!.eligible,
			preservedExtra: tracker.fields("gh-2").risk,
			commentsNotCopiedToBody: !nativeBody.includes("Synthetic comment"),
			bodyPreserved: nativeBody === "Native contract body.\n\nCasual mention #4 is not an edge.\n",
			chronologicalComments: (tracker.fields("gh-2")["github-comments"] as typeof comments).every((comment, n) => comment.body === "Synthetic comment " + n),
			delegatedRoot: tracker.snapshot().get("gh-1")!.ownStage,
		};
		const errors: Record<string, string> = {};
		const attempt = (name: string, value: unknown) => {
			publish(value);
			try { factory(cwd).snapshot(); errors[name] = "UNEXPECTED SUCCESS"; }
			catch (error) { errors[name] = (error as Error).message; }
		};
		attempt("graphqlPartial", { data, errors: [{ message: "synthetic partial failure" }] });
		const incomplete = structuredClone(data);
		(incomplete.repository.issuesFirst as { totalCount: number }).totalCount = 201;
		(incomplete.repository.issuesLast as { totalCount: number }).totalCount = 201;
		attempt("repositoryIncomplete", { data: incomplete });
		const nested = structuredClone(data);
		for (const key of ["commentsFirst", "commentsLast"]) ((nested.repository.issuesFirst as { nodes: Record<string, { totalCount: number }>[] }).nodes[1]![key]!).totalCount = 201;
		// Both aliases can include the same issue; the issue's own pages must certify coverage.
		attempt("commentsIncomplete", { data: nested });
		const contradictory = structuredClone(data);
		Object.assign((contradictory.repository.issuesFirst as { nodes: unknown[] }).nodes[0]!, paired("labels", [label("ready-for-agent"), label("ready-for-human")]));
		attempt("contradictoryTriage", { data: contradictory });
		const cyclic = structuredClone(data);
		Object.assign((cyclic.repository.issuesFirst as { nodes: unknown[] }).nodes[1]!, paired("blockers", [relation(2)]));
		attempt("dependencyCycle", { data: cyclic });
		const missing = structuredClone(data);
		(missing.repository.issuesFirst as { nodes: { parent: unknown }[] }).nodes[1]!.parent = relation(88);
		attempt("missingParent", { data: missing });
		publish(); writeFileSync(response, "{broken");
		try { factory(cwd).snapshot(); errors.invalidJson = "UNEXPECTED SUCCESS"; } catch (error) { errors.invalidJson = (error as Error).message; }
		publish();
		writeFileSync(join(cwd, "docs/agents/triage-labels.md"), "| ready-for-agent | renamed-ready-for-agent | only one role |\n");
		try { factory(cwd).snapshot(); errors.missingRole = "UNEXPECTED SUCCESS"; } catch (error) { errors.missingRole = (error as Error).message.replaceAll(cwd, "<fixture>"); }
		console.log(JSON.stringify({ fixture: observed, failures: errors }, null, 2));
		if (Object.values(errors).some(value => value === "UNEXPECTED SUCCESS")) process.exitCode = 1;
	} else if (mode === "live") {
		const cwd = resolve(process.argv[3]!);
		cold(cwd);
		const first = inspect(cwd);
		const firstRequests = requests().length;
		const tracker = factory(cwd);
		const rows = tracker.snapshot();
		const slug = [...rows.keys()][0];
		if (slug) { tracker.fields(slug); tracker.text(slug); tracker.snapshot(slug); }
		// Real process boundary, not just a second adapter instance.
		execFileSync("bun", ["-e", "import {getGithubTracker} from " + JSON.stringify(resolve(import.meta.dir, "../../../lib/tracker-github.ts")) + "; getGithubTracker(" + JSON.stringify(cwd) + ").snapshot()"]);
		const warmRequests = requests().length - firstRequests;
		let expiryRequests: number | null = null;
		if (process.argv.includes("--expiry")) {
			await Bun.sleep(61_000);
			const before = requests().length;
			tracker.snapshot();
			expiryRequests = requests().length - before;
		}
		console.log(JSON.stringify({ live: first, firstRequests, warmAdditionalRequests: warmRequests, expiryRequests, operations: requests() }, null, 2));
	} else throw new Error("Usage: bun reader.ts fixture | live <canonical-checkout> [--expiry]");
} finally {
	process.env.PATH = previousPath;
	rmSync(root, { recursive: true, force: true });
}
