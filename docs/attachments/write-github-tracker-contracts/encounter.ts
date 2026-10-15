/**
 * One-off live encounter, NOT a test suite. Mutates ONLY the private disposable
 * repository named below. Existing gh authentication as mlegls is required.
 * bun docs/attachments/write-github-tracker-contracts/encounter.ts
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { getGithubTracker, decodeGithubBody } from "../../../lib/tracker-github.ts";
import { githubProject, invalidateGithubSnapshot, withGithubLock } from "../../../lib/tracker-github-snapshot.ts";
import { beginRefinement, observeRefinements, replaceRefinement, discardRefinement, type RefinementContext } from "../../../lib/reconcile/refinement.ts";
import type { GlobalRunState } from "../../../lib/reconcile/tracker-state.ts";

const repository = "mlegls/reconcile-pr-transport-20261014-35767b2d";
delete process.env.PI_WM_RUN;
const realGh = execFileSync("which", ["gh"], { encoding: "utf8" }).trim();
const gh = (args: string[], input?: unknown) => {
	const result = spawnSync(realGh, args, { input: input === undefined ? undefined : JSON.stringify(input), encoding: "utf8" });
	if (result.status) throw new Error(result.stderr);
	return result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
};
const api = (path: string, method = "GET", body?: unknown) => gh(["api", "--method", method, "repos/" + repository + "/" + path, ...(body === undefined ? [] : ["--input", "-"])], body);
const viewer = gh(["api", "user"]), repo = gh(["api", "repos/" + repository]);
assert.equal(viewer.login, "mlegls"); assert.equal(repo.full_name, repository);
assert.equal(repo.private, true); assert.equal(repo.has_issues, true); assert.equal(repo.permissions.push, true); assert.equal(repo.owner.login, viewer.login);
const schema = gh(["api", "graphql", "--input", "-"], { query: 'query{__type(name:"CreateIssueInput"){inputFields{name}}}' });
for (const key of ["parentIssueId", "assigneeIds", "repositoryId", "labelIds"]) assert(schema.data.__type.inputFields.some((field: any) => field.name === key));
console.log("readiness: mlegls, exact private owner repository, issues enabled, write permission, atomic parent+assignee schema verified");
const target = process.env.ENCOUNTER_TARGET ?? mkdtempSync(join(tmpdir(), "github-tracker-contracts-")), checkout = join(target, "checkout");
if (!existsSync(checkout)) execFileSync("git", ["clone", "--quiet", "https://github.com/" + repository + ".git", checkout], { stdio: "pipe" });
assert.equal(execFileSync("git", ["-C", checkout, "remote", "get-url", "origin"], { encoding: "utf8" }).trim(), "https://github.com/" + repository + ".git");
mkdirSync(join(checkout, "docs/agents"), { recursive: true });
writeFileSync(join(checkout, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: " + repository + "\n");
const roles = { "needs-triage": "encounter/triage", "needs-info": "encounter/info", "ready-for-agent": "encounter/agent", "ready-for-human": "encounter/human", wontfix: "wontfix" };
writeFileSync(join(checkout, "docs/agents/triage-labels.md"), "| Role | Label |\n| --- | --- |\n" + Object.entries(roles).map(([role, label]) => "| " + role + " | " + label + " |").join("\n") + "\n");
const inventory = api("labels?per_page=100");
for (const name of [...Object.values(roles), "no-drive", "p1", "p2", "p3"]) if (!inventory.some((label: any) => label.name === name)) api("labels", "POST", { name, color: "ededed" });
const bin = join(target, "bin"); mkdirSync(bin, { recursive: true });
const wrapper = join(bin, "gh");
writeFileSync(wrapper, readFileSync(join(import.meta.dir, "gh-wrapper.ts"), "utf8")); chmodSync(wrapper, 0o755);
process.env.ENCOUNTER_GH = realGh; process.env.ENCOUNTER_CALLS = join(target, "calls");
process.env.ENCOUNTER_LOSS = join(target, "lose-response"); process.env.PATH = bin + ":" + process.env.PATH;
const manifestFile = join(target, "encounter.json");
const manifest: Record<string, any> = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : { issues: {}, createdAt: new Date().toISOString() };
const save = () => writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
const bare = getGithubTracker(checkout)!, project = githubProject(checkout)!;
const refresh = () => withGithubLock(project, () => invalidateGithubSnapshot(project));
const number = (slug: string) => Number(slug.slice(3));
const ownCreate = (key: string, fields: Record<string, unknown> = {}, body = "Disposable direct-adapter encounter.") => {
	if (!manifest.issues[key]) { manifest.issues[key] = bare.create({ slug: "write-contracts-" + manifest.createdAt + "-" + key, fields: { author: "session:github-contracts-encounter", ...fields }, body }); save(); }
	return manifest.issues[key] as string;
};
console.log("owned target: " + target);
console.log("native preflight snapshot complete before issue seeding", { existingIssues: bare.snapshot().size });
const parent = ownCreate("parent", { assignee: "agent:technical", title: "Disposable tracker mutation encounter" });
assert.match(parent, /^gh-[1-9]\d*$/);
assert.equal(bare.fields(parent).title, "Disposable tracker mutation encounter");
const baseline = ownCreate("baseline", { assignee: "agent", "part-of": parent });
const blocker = ownCreate("blocker", { assignee: "agent" });
const unresolved = ownCreate("unresolved-blocker", { assignee: "agent" });
const dependent = ownCreate("outside-dependent", { assignee: "agent", "blocked-by": [blocker, unresolved, "review: human approval"], drive: "none", custom: { preserved: true } }, "User body\n");
api("issues/" + number(dependent) + "/labels", "POST", { labels: ["documentation"] });
api("issues/" + number(dependent) + "/assignees", "POST", { assignees: ["mlegls"] });
const untouchedComment = api("issues/" + number(dependent) + "/comments", "POST", { body: "User-owned comment: do not replace." }); refresh();
const nativeParent = api("issues/" + number(parent));
assert(Number.isSafeInteger(nativeParent.id));
assert(Array.isArray(api("issues/" + number(parent) + "/sub_issues")));
assert(Array.isArray(api("issues/" + number(dependent) + "/dependencies/blocked_by")));
console.log("native capability: sub-issues and dependency reads/writes observed; database IDs differ from numbers", { parent, baseline, blocker, dependent, databaseId: nativeParent.id });
const calls = () => readFileSync(process.env.ENCOUNTER_CALLS!, "utf8").split("\n").filter(value => value === "TrackerSnapshot").length;
bare.update(dependent, {}, "User body\n");
bare.snapshot(); const warm = calls(); bare.fields(dependent); bare.text(dependent); assert.equal(calls(), warm);
bare.update(dependent, { custom: { preserved: "updated" }, priority: 2 });
const beforeRead = calls(); assert.equal(bare.fields(dependent).priority, 2); assert.equal(calls() - beforeRead, 1);
assert.deepEqual(api("issues/" + number(dependent)).labels.map((label: any) => label.name).filter((name: string) => /^p\d$/.test(name)), ["p2"]);
console.log("cache measurement: warm field/text reads=0 TrackerSnapshot requests; first read after write=1");
assert(bare.text(dependent).endsWith("User body\n"));
bare.update(dependent, {}, "Replacement body"); assert(bare.text(dependent).endsWith("Replacement body"));
bare.update(dependent, {}, ""); assert(bare.text(dependent).endsWith("---\n"));
bare.update(dependent, { priority: null }, "Restored body"); assert.equal(bare.fields(dependent).priority, undefined);
assert(!api("issues/" + number(dependent)).labels.some((label: any) => /^p\d$/.test(label.name)));
assert.throws(() => bare.update(dependent, { author: "session:other" }), /immutable/);
bare.update(parent, { stage: "ticket" }); assert.equal(bare.fields(parent).stage, "ticket");
bare.update(parent, { stage: null }); assert.equal(bare.fields(parent).stage, undefined);
const mutationsBeforeInvalid = readFileSync(process.env.ENCOUNTER_CALLS!, "utf8").split("\n").filter(value => value === "TrackerWrite").length;
assert.throws(() => bare.update(dependent, { priority: 5 }), /priority/);
assert.throws(() => bare.update(dependent, { priority: 4 }), /priority/);
assert.throws(() => bare.update(parent, { "part-of": baseline }), /cycle/);
assert.throws(() => bare.update(dependent, { "part-of": "other/repo#1" }), /same-repository/);
assert.equal(readFileSync(process.env.ENCOUNTER_CALLS!, "utf8").split("\n").filter(value => value === "TrackerWrite").length, mutationsBeforeInvalid);
bare.fields(parent); // Warm again after the deliberately refused writes invalidated the cache.
const beforeRestart = calls();
const acrossProcess = execFileSync(process.execPath, ["-e", "import {getGithubTracker} from " + JSON.stringify(join(import.meta.dir, "../../../lib/tracker-github.ts")) + "; console.log(JSON.stringify(getGithubTracker(process.env.ENCOUNTER_CHECKOUT).fields(process.env.ENCOUNTER_PARENT)))"], { env: { ...process.env, ENCOUNTER_CHECKOUT: checkout, ENCOUNTER_PARENT: parent }, encoding: "utf8" });
assert.equal(JSON.parse(acrossProcess).stage, undefined);
assert.equal(typeof JSON.parse(acrossProcess).title, "string"); assert.equal(calls(), beforeRestart);
bare.update(parent, { stage: "spec" });
const nativePreserved = api("issues/" + number(dependent));
assert(nativePreserved.labels.some((label: any) => label.name === "documentation"));
assert(nativePreserved.assignees.some((user: any) => user.login === "mlegls"));
assert(api("issues/" + number(dependent) + "/comments").some((comment: any) => comment.id === untouchedComment.id));
console.log("text/fields/body-only/empty/null/immutable provenance/stage round-trips and immediate cache refresh held");

const common = execFileSync("git", ["-C", checkout, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim(), stateFile = join(common, "reconcile", parent + ".json");
const state: GlobalRunState & { backend: string } = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { backend: "threads", root: parent, cwd: checkout, landed: {}, results: {}, landingOps: {}, refinements: {} };
const stateSave = () => { mkdirSync(join(common, "reconcile"), { recursive: true }); writeFileSync(stateFile, JSON.stringify(state)); };
stateSave();
const tracker = getGithubTracker(checkout, { run: parent })!;
const context: RefinementContext = { state, tracker, save: stateSave, stopWriter: async () => {}, locked: async work => work() };
const first = beginRefinement(context, parent, "first");
const provisionalRequest = { slug: "lost-response-" + manifest.createdAt, fields: { author: "session:github-contracts-encounter", assignee: "agent:technical", stage: "ticket", "part-of": parent, "claimed-by": first.claim }, body: "Parented and assigned atomically." };
if (!manifest.issues.provisional) {
	writeFileSync(process.env.ENCOUNTER_LOSS!, "lose next response"); assert.throws(() => tracker.create(provisionalRequest), /deliberately lost/);
	const adjacent = [...tracker.snapshot().values()].filter(row => tracker.fields(row.slug)["claimed-by"] === first.claim);
	assert.equal(adjacent.length, 1); assert.equal(adjacent[0]!.frontier, false);
	manifest.issues.provisional = adjacent[0]!.slug; save();
	const count = tracker.snapshot().size;
	const replay = execFileSync(process.execPath, ["-e", "import {getGithubTracker} from " + JSON.stringify(join(import.meta.dir, "../../../lib/tracker-github.ts")) + "; console.log(getGithubTracker(process.env.ENCOUNTER_CHECKOUT,{run:process.env.ENCOUNTER_ROOT}).create(JSON.parse(process.env.ENCOUNTER_REQUEST)))"], { encoding: "utf8", env: { ...process.env, ENCOUNTER_CHECKOUT: checkout, ENCOUNTER_ROOT: parent, ENCOUNTER_REQUEST: JSON.stringify({ ...provisionalRequest, fields: Object.fromEntries(Object.entries(provisionalRequest.fields).reverse()) }) } }).trim();
	assert.equal(replay, adjacent[0]!.slug); assert.equal(tracker.snapshot().size, count);
}
const provisional = manifest.issues.provisional;
observeRefinements(context); assert(first.owned.includes(provisional));
const successor = await replaceRefinement(context, "first", "successor", true);
assert.equal(tracker.fields(provisional)["claimed-by"], successor.claim);
assert.throws(() => tracker.update(baseline, { "claimed-by": successor.claim }), /baseline/);
const foreign = ownCreate("foreign", { assignee: "agent", "part-of": parent });
api("issues/" + number(foreign) + "/assignees", "POST", { assignees: ["mlegls"] }); refresh();
assert.equal(tracker.fields(foreign)["claimed-by"], "github:mlegls");
assert.throws(() => tracker.update(foreign, { "claimed-by": successor.claim }), /foreign/);
assert.throws(() => tracker.remove(baseline), /no exact owned/); assert.throws(() => tracker.remove(foreign), /no exact owned/);
console.log("lost response recovered exact child without duplicate; production adoption transferred exact attempt; baseline and same-login foreign protected", { provisional, foreign });

const collector = join(target, "collector");
execFileSync("git", ["-C", checkout, "worktree", "add", "--quiet", "--detach", collector, "HEAD"], { stdio: "pipe" });
writeFileSync(join(collector, "fixture/write-contracts-stub.txt"), "Committed shared-stub fixture for " + provisional + "\n");
execFileSync("git", ["-C", collector, "add", "--", "fixture/write-contracts-stub.txt"]);
execFileSync("git", ["-C", collector, "commit", "-m", "encounter: prepare shared-stub landing"], { stdio: "pipe" });
const stubHead = execFileSync("git", ["-C", collector, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
state.refinements.successor!.phase = "accepting";
state.refinements.successor!.acceptance = { reportTs: "encounter", report: "committed fixture stubs", children: [provisional], into: "fixture-collector", destination: collector, preparedHead: stubHead, landedHead: stubHead };
stateSave(); tracker.update(provisional, { "claimed-by": "reconcile:" + parent });
assert.equal(tracker.fields(provisional)["claimed-by"], "reconcile:" + parent); assert.throws(() => tracker.remove(provisional), /provisional/);
state.refinements.successor!.phase = "accepted"; stateSave();
const cleanup = beginRefinement(context, parent, "cleanup");
const makeProvisional = (key: string, extra: Record<string, unknown> = {}) => {
	if (!manifest.issues[key]) { manifest.issues[key] = tracker.create({ slug: "cleanup-" + key + "-" + manifest.createdAt, fields: { author: "session:github-contracts-encounter", assignee: "agent", "part-of": parent, "claimed-by": cleanup.claim, ...extra }, body: "Failed-refinement cleanup." }); save(); }
	return manifest.issues[key] as string;
};
const removable = makeProvisional("removable"), nested = makeProvisional("nested", { "part-of": removable });
const sibling = makeProvisional("cleanup-dependent", { "blocked-by": [removable] });
writeFileSync(process.env.ENCOUNTER_LOSS! + ".detach", "lose detach response");
assert.throws(() => tracker.remove(nested), /deliberately lost successful detach/);
assert.equal(tracker.fields(nested)["claimed-by"], cleanup.claim);
assert.equal(tracker.fields(nested)["part-of"], removable);
await discardRefinement(context, "cleanup"); assert.equal(state.refinements.cleanup!.phase, "removed");
for (const slug of [removable, nested, sibling]) {
	const issue = api("issues/" + number(slug)); assert.equal(issue.state_reason, "not_planned"); assert.equal(issue.assignees.length, 0); assert(!tracker.snapshot().has(slug));
}
assert.equal(api("issues/" + number(foreign)).state, "open"); assert.equal(api("issues/" + number(baseline)).state, "open");
console.log("production failed-refinement cleanup terminated after lost native detach; NOT_PLANNED descendants absent; foreign/baseline retained");
const releaseAttempt = beginRefinement(context, parent, "release-loss");
const releaseChild = tracker.create({ slug: "release-loss-" + manifest.createdAt, fields: { author: "session:github-contracts-encounter", assignee: "agent", "part-of": parent, "claimed-by": releaseAttempt.claim }, body: "Remove with uncertain final unassignment." });
manifest.issues["release-loss"] = releaseChild; save();
writeFileSync(process.env.ENCOUNTER_LOSS! + ".release", "lose release response");
assert.throws(() => tracker.remove(releaseChild), /deliberately lost successful release/);
assert(!tracker.snapshot().has(releaseChild));
await discardRefinement(context, "release-loss");
tracker.remove(releaseChild); // replay may finish the private receipt after discard
assert.equal(api("issues/" + number(releaseChild)).state_reason, "not_planned");
console.log("lost final unassignment remained removed and private replay finished");
api("issues/" + number(blocker), "PATCH", { state: "closed", state_reason: "completed" }); refresh();
writeFileSync(process.env.ENCOUNTER_LOSS! + ".comment", "lose next comment response");
assert.throws(() => tracker.close(blocker, { summary: "Reviewed result after target landing." }), /deliberately lost/);
tracker.close(blocker, { summary: "Reviewed result after target landing." }); tracker.close(blocker, { summary: "Reviewed result after target landing." });
assert.equal(api("issues/" + number(blocker) + "/comments").filter((comment: any) => comment.body.includes("mlegls-pi:result:")).length, 1);
assert.deepEqual(tracker.fields(dependent)["blocked-by"], [unresolved, "review: human approval"]);
assert.deepEqual(api("issues/" + number(dependent) + "/dependencies/blocked_by").map((issue: any) => issue.number), [number(unresolved)]);
tracker.moveOut(provisional, "Human follow-up outside this run."); tracker.moveOut(provisional, "Human follow-up outside this run.");
assert.equal(tracker.fields(provisional).assignee, "human"); assert.equal(tracker.fields(provisional)["claimed-by"], undefined);
console.log("auto-closed result replay once, resolved outside dependency removal retained guard, moveOut readiness/reason/unassignment held");
const evidencePath = execFileSync("git", ["-C", checkout, "ls-tree", "-r", "--name-only", "HEAD", "--", "docs/attachments"], { encoding: "utf8" }).trim().split("\n")[0]!;
const evidenceIssue = ownCreate("published-evidence", { assignee: "agent" });
tracker.close(evidenceIssue, { summary: "Published evidence link.", evidence: evidencePath });
tracker.close(evidenceIssue, { evidence: evidencePath, summary: "Published evidence link." });
const evidenceComment = api("issues/" + number(evidenceIssue) + "/comments").find((comment: any) => comment.body.includes("mlegls-pi:result:"));
const publishedHead = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert(evidenceComment.body.includes("/blob/" + publishedHead + "/" + evidencePath));
const declineIssue = ownCreate("declined-attachments", { assignee: "agent" });
writeFileSync(join(checkout, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: " + repository + "\nAttachments: declined\n");
tracker.close(declineIssue, { summary: "Explicit fixture decline.", evidence: evidencePath });
const declineComment = api("issues/" + number(declineIssue) + "/comments").find((comment: any) => comment.body.includes("mlegls-pi:result:"));
assert(declineComment.body.includes(readFileSync(join(checkout, evidencePath), "utf8")));
assert(!declineComment.body.includes("/blob/"));
console.log("published exact-commit evidence and explicit attachment-decline content fixture held", { evidencePath, publishedHead });
// Record markers and final native outcomes before owner-only disposal.
manifest.markers = Object.fromEntries(Object.entries(manifest.issues).map(([key, slug]) => [key, api("issues/" + number(slug as string) + "/comments").map((comment: any) => ({ id: comment.id, marker: comment.body.match(/<!-- mlegls-pi:[^\n]+/)?.[0] })).filter((item: any) => item.marker)]));
manifest.correlations = {};
for (const [key, slug] of Object.entries(manifest.issues)) {
	const issue = api("issues/" + number(slug as string)), comments = api("issues/" + number(slug as string) + "/comments");
	manifest.correlations[key] = decodeGithubBody(issue.body).marker;
	assert(!JSON.stringify([issue.body, issue.labels, comments]).includes("reconcile:" + parent));
}
console.log("public body/labels/comments contain zero run/attempt claim tokens");
manifest.complete = true; save();
for (const slug of Object.values(manifest.issues) as string[]) {
	const issue = api("issues/" + number(slug));
	// The baseline/foreign protection check ran BEFORE this encounter-owner cleanup.
	if (issue.state === "open") api("issues/" + issue.number, "PATCH", { state: "closed", state_reason: "not_planned" });
	if (issue.assignees.some((user: any) => user.login === "mlegls")) api("issues/" + issue.number + "/assignees", "DELETE", { assignees: ["mlegls"] });
}
execFileSync("git", ["-C", checkout, "worktree", "remove", collector], { stdio: "pipe" });
console.log("encounter complete; only disposable owned issues closed/unassigned", manifest.issues);

