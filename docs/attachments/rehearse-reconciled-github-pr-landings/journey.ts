// One-off owned first-use machinery, not a retained test or alternate reconciler.
// All scheduling, integration, gates, publication, recovery and closure are production.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Handle } from "../../../lib/dispatch.ts";
import type { State } from "../../../lib/reconcile/reconcile.ts";
import type { LandingMode } from "../../../lib/reconcile/pr-types.ts";
import type { Tracker } from "../../../lib/tracker.ts";

const repository = "mlegls/reconcile-pr-transport-20261014-35767b2d";
const pkg = realpathSync(join(import.meta.dir, "../../.."));
const action = process.argv[2];
const fresh = action === "pr-merge" || action === "pr-review";
assert(fresh || ["resume", "status", "restart", "ack", "cleanup"].includes(action), "Use pr-merge|pr-review|resume|status|restart|ack|cleanup [owned directory]");
const area = fresh ? realpathSync(mkdtempSync("/tmp/rehearse-github-pr-")) : realpathSync(process.argv[3]);
const manifestPath = join(area, "manifest.json");
type Manifest = { repository: string; mode: LandingMode; root: string; repo: string; owner: string; contributor: string; ownerBefore?: string; observations: Record<string, unknown>; progress: string };
let m: Manifest = fresh ? { repository, mode: action as LandingMode, root: "rehearsal-" + action.slice(3) + "-" + area.split("-").at(-1)!.toLowerCase(),
	repo: join(area, "repo"), owner: join(area, "owner"), contributor: join(area, "contributor"), observations: {}, progress: "seed" }
	: JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(m.repository, repository, "Only the explicitly supplied disposable repository is authorized");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe", timeout: 120_000 }).trim();
const gh = (args: string[], input?: unknown) => execFileSync("gh", args, { encoding: "utf8", stdio: "pipe", timeout: 120_000,
	...(input === undefined ? {} : { input: JSON.stringify(input) }) }).trim();
const api = (path: string, input?: unknown) => JSON.parse(gh(["api", path, ...(input === undefined ? [] : ["--method", "POST", "--input", "-"])], input));
const put = (dir: string, path: string, content: string) => { mkdirSync(join(dir, path, ".."), { recursive: true }); writeFileSync(join(dir, path), content); };
const head = (cwd: string) => git(cwd, "rev-parse", "HEAD");
const commit = (cwd: string, path: string, content: string) => { put(cwd, path, content); git(cwd, "add", "--", path); git(cwd, "commit", "-qm", "Rehearsal: " + path); return head(cwd); };
const persist = () => writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
const record = (key: string, value: unknown) => { m.observations[key] = value; persist(); console.log(key + " " + JSON.stringify(value)); };
const bin = join(area, "bin"), agents = join(area, "agents");
for (const key of Object.keys(process.env)) if (/^(?:PI_.*|BB_.*|AB_.*|ZMX_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
Object.assign(process.env, { XDG_STATE_HOME: join(area, "state"), XDG_CACHE_HOME: join(area, "cache"),
	PI_BOARD_DIR: join(area, "board"), PI_CODING_AGENT_DIR: join(area, "agent"), PI_AGENTS_DIR: agents,
	ZMX_DIR: join(area, "zmx"), PI_THREAD_RUNTIME: "zmx", MISE_TRUSTED_CONFIG_PATHS: area,
	TRACKER_CLI: join(pkg, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
	PARALLEL_HOME: join(area, "parallel"), WORKER_SLOTS: "2",
	WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'", PATH: bin + ":" + process.env.PATH });
mkdirSync(bin, { recursive: true });
writeFileSync(join(bin, "pi"), "#!/bin/sh\ngit rev-parse HEAD > shell-base\ntouch shell-started\nexec sleep 3600\n", { mode: 0o755 });
for (const [name, role] of [["shell", "implement"], ["shell-drive", "drive"], ["tidy", "review"], ["technical", "implement"]]) {
	put(agents, name + ".md", "---\nrole: " + role + "\n---\nDeterministic shell rehearsal.\n");
	put(agents, "roles/" + role + ".md", "Deterministic shell rehearsal.\n");
}
const { load } = await import("../../../lib/reconcile/reconcile.ts");
const { start, stop, resolveException } = await import("../../../lib/reconcile/main.ts");
const { getTracker } = await import("../../../lib/tracker.ts");
const { send } = await import("../../../lib/board/store.ts");
const { allThreads, getThread } = await import("../../../lib/thread/registry.ts");
const { createPullRequestHost } = await import("../../../lib/reconcile/pr-host.ts");
const host = createPullRequestHost();
const state = () => load(m.repo, m.root)!;
const packet = (slug: string) => "docs/attachments/rehearsal/" + slug + ".md";
const childA = m.root + "-a", childB = m.root + "-b", outside = m.root + "-outside";
const nodes = [childA, childB, m.root];
const report = (h: Handle, slug: string, replies?: Record<string, string>, evidencePath = packet(slug)) => send({ from: {}, topic: h.run + "/" + h.handle, tags: ["done"],
	body: "done\n\n" + "\x60\x60\x60json\n" + JSON.stringify({ summary: slug + " reviewed result",
		setup: { kind: "owned-github-scratch", entry: "mise run pre-integrate" },
		stories: [{ story: slug + " code and joins", outcome: "held" }],
		evidence: { path: evidencePath, visual: false, shots: [] }, tests: [], ...(replies ? { threadReplies: replies } : {}) }) + "\n\x60\x60\x60" });
const until = async <T>(fn: () => T | false | undefined, label: string, allowException = false): Promise<T> => {
	for (let n = 0; n < 900; n++) {
		const s = state();
		if (!allowException && s && Object.keys(s.exceptions).length) throw new Error("Owner exception: " + JSON.stringify(s.exceptions));
		const value = fn(); if (value) return value;
		await Bun.sleep(1000);
	}
	throw new Error("Timeout: " + label);
};
const ready = (slug: string, phase: string) => until(() => {
	const c = state()?.chains[slug], h = c?.handle;
	return c?.phase === phase && h && existsSync(join(h.path, "shell-started")) && h;
}, slug + " " + phase);
const observe = () => host.observe(m.owner, repository, state().pr!.number!);
const pausedIdentity = (s: State) => ({ number: s.pr!.number, branch: s.pr!.branch, land: s.land,
	reviews: s.pr!.reviews, results: s.results, counter: s.counter, workers: Object.keys(s.chains) });
const cut = async (label: string) => {
	const before = state(), identity = pausedIdentity(before);
	assert(before.pid); process.kill(before.pid, "SIGKILL");
	await Bun.sleep(1500);
	const restarted = start({ cwd: m.owner, root: m.root, owner: "mail/rehearsal", budget: 1 });
	await until(() => state().pid === restarted.pid, "restarted PID");
	assert.deepEqual(pausedIdentity(state()), identity);
	record(label, { exactKilledPid: before.pid, resumedPid: restarted.pid, ...identity });
};
const halt = async () => {
	const s = state(); if (!s?.pid || s.finished) return;
	// A crash cut preserves resumable state; explicit cleanup uses production stop.
	try { process.kill(s.pid, "SIGKILL"); } catch {}
	await Bun.sleep(500);
};
const green = async (cwd: string, oid: string) => until(() => {
	const checks = host.checks(cwd, repository, oid);
	return checks.length > 0 && checks.every(c => c.state === "pass") && checks;
}, "real Actions green at " + oid);
let tracker: Tracker;
try {
	if (fresh) {
		const login = api("user").login;
		assert.equal(login, "mlegls");
		const access = JSON.parse(gh(["repo", "view", repository, "--json", "nameWithOwner,isPrivate,defaultBranchRef,viewerPermission"]));
		assert.equal(access.viewerPermission, "ADMIN"); assert.equal(access.defaultBranchRef.name, "main"); assert(access.isPrivate);
		assert(api("repos/" + repository + "/actions/permissions").enabled);
		git(area, "clone", "-q", "git@github.com:" + repository + ".git", m.repo);
		git(m.repo, "config", "user.name", "Owned rehearsal"); git(m.repo, "config", "user.email", "rehearsal@example.invalid");
		git(m.repo, "config", "commit.gpgSign", "false");
		git(m.repo, "fetch", "-q", "origin", "main");
		record("preflight", { login, repository, permission: access.viewerPermission, actions: true, defaultBase: "main", fetchedHead: head(m.repo), area,
			predictions: ["a unlocks b locally, not outside", "one PR; no owner code before remote merge", "failed Actions leads to bounded repair",
				"restart preserves identity/results/cursor without tree replay", m.mode === "pr-merge" ? "green merges with merge commit, closes child-first, clean base owner ff" : "submitted COMMENTED threads repair; own marker-only replies ignored; no automatic merge"] });
		// Existing hooks are retained. These scratch-owned hooks add receipts; none is bypassed.
		for (const name of ["pre-commit", "pre-merge-commit", "pre-push"]) {
			const file = join(m.repo, ".git/hooks", name);
			assert(!existsSync(file), "Do not replace inherited active hooks");
			writeFileSync(file, "#!/bin/sh\nprintf '" + name + " ' >> '" + join(area, "hooks") + "'\ngit rev-parse HEAD >> '" + join(area, "hooks") + "'\n", { mode: 0o755 });
		}
		put(m.repo, ".gitignore", "shell-started\nshell-base\n");
		put(m.repo, ".pi/reconcile.json", JSON.stringify({ land: m.mode }) + "\n");
		put(m.repo, "fixture/ci.txt", "green\n");
		put(m.repo, "fixture/conflict.txt", "base\n");
		put(m.repo, "gate.sh", "#!/bin/sh\nset -eu\ntest -s fixture/ci.txt\ntest -s fixture/conflict.txt\nif grep -q '<<<<<<<' fixture/conflict.txt; then exit 1; fi\nprintf '%s ' \"$PWD\" >> '" + join(area, "gates") + "'\ngit rev-parse HEAD >> '" + join(area, "gates") + "'\n");
		put(m.repo, "mise.toml", '[tasks.setup]\nrun = "true"\n[tasks.pre-integrate]\nrun = "bash gate.sh"\n');
		put(m.repo, ".github/workflows/rehearsal.yml", "name: Rehearsal\non: [push, pull_request]\npermissions:\n  contents: read\njobs:\n  located-fixture:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: |\n          sleep 15\n          test \"$(cat fixture/ci.txt)\" = green\n");
		git(m.repo, "add", ".gitignore", ".pi", "fixture", "gate.sh", "mise.toml", ".github");
		git(m.repo, "commit", "-qm", "Prepare owned PR lifecycle rehearsal " + m.root);
		git(m.repo, "push", "-q", "origin", "main");
		record("baseReadiness", { head: head(m.repo), checks: await green(m.repo, head(m.repo)) });
		git(m.repo, "checkout", "-qb", "tracker-" + m.root);
		mkdirSync(join(m.repo, "docs/issues"), { recursive: true });
		git(m.repo, "worktree", "add", "-q", m.owner, "main");
		// Keep the global vault on its own local branch; owner remains clean on base.
	} 
	tracker = getTracker(m.repo, { inflight: false });
	if (fresh) {
		tracker = getTracker(m.repo, { inflight: false });
		for (const [slug, fields] of [[m.root, { stage: "spec" }], [childA, { stage: "ticket", "part-of": m.root }],
			[childB, { stage: "ticket", "part-of": m.root, "blocked-by": [childA] }],
			[outside, { stage: "ticket", "blocked-by": [childA] }]] as const)
			tracker.create({ slug, fields: { ...fields, assignee: "agent:shell", author: "user:rehearsal" }, body: slug + " owned fixture contract." });
		m.ownerBefore = head(m.owner);
		git(area, "clone", "-q", "git@github.com:" + repository + ".git", m.contributor);
		git(m.contributor, "config", "user.name", "Separate-clone pusher"); git(m.contributor, "config", "user.email", "contributor@example.invalid");
		git(m.contributor, "config", "commit.gpgSign", "false");
		persist();
		record("start", start({ cwd: m.owner, root: m.root, owner: "mail/rehearsal", budget: 1 }));
		const finish = async (slug: string) => {
			for (const phase of ["implement", "drive", "review"]) {
				const h = await ready(slug, phase);
				if (phase === "implement") {
					if (slug === childA) commit(h.path, "fixture/conflict.txt", "branch edit\n");
					if (slug === childB && m.mode === "pr-merge") commit(h.path, "fixture/ci.txt", "red\n");
					commit(h.path, "fixture/" + slug + ".txt", slug + " code\n");
					commit(h.path, packet(slug), "# " + slug + "\n\nOriginal reviewed code; mise run pre-integrate.\n");
				}
				report(h, slug);
				record("worker-" + slug + "-" + phase, { handle: h.handle, thread: h.threadId, head: head(h.path) });
			}
		};
		await finish(childA);
		const b = await ready(childB, "implement");
		assert.equal(state().landed[childA].into, m.root);
		assert.equal(tracker.fields(childA).stage, "ticket"); assert(!tracker.snapshot().get(outside)?.frontier);
		assert(existsSync(join(b.path, "fixture/" + childA + ".txt")));
		record("collector", { a: state().landed[childA], bBase: head(b.path), outsideBlocked: true, aGlobalStage: tracker.fields(childA).stage });
		await finish(childB); await finish(m.root);
		await until(() => state().pr?.number && state().pr!.number, "PR publication");
		assert.equal(head(m.owner), m.ownerBefore); assert(!git(m.owner, "status", "--porcelain"));
		assert(!state().results[childA].closedAt); assert(!tracker.snapshot().get(outside)?.frontier);
		record("published", { pr: observe(), pendingResults: state().results, ownerUnchanged: true, ledger: state().landed });
		const { publication } = await import("../../../lib/reconcile/pr-body.ts");
		const seeded = structuredClone(state()); seeded.results[m.root].parent = "unfinished-parent";
		const ids = Object.fromEntries([...nodes, "unfinished-parent"].map((slug, i) => [slug, 41 + i]));
		const body = publication(seeded, { ...tracker, githubIssue: slug => ({ repository, number: ids[slug], url: "https://github.com/" + repository + "/issues/" + ids[slug] }) }).body;
		assert.equal(body.match(/^Closes #/gm)?.length, 3); assert(body.includes("Part of #44"));
		assert(!state().pr!.publication!.body.includes("Closes #"));
		record("seededBackendCapability", { logicalSlugs: ids, closingLines: body.split("\n").filter(line => /^(Closes|Part of) #/.test(line)), vaultOmitted: true, realAdapterAvailable: false });
		m.progress = "published"; persist();
	}
	if (action === "status") { console.log(JSON.stringify(state(), null, 2)); }
	else if (action === "restart") { await cut("restartAfterHostRepair"); }
	else if (action === "cleanup") {
		await stop(m.owner, m.root);
		const pr = observe(); if (pr.state === "OPEN") gh(["pr", "close", String(pr.number), "--repo", repository]);
		// Only the run's unique PR branch. Supplied repo and inherited branches stay.
		git(m.repo, "push", "origin", "--delete", state().pr!.branch);
		record("cleanup", { explicitStop: true, pr: pr.number, branchDeleted: state().pr!.branch, localAreaRetained: area });
	} else if (action === "ack") {
		start({ cwd: m.owner, root: m.root, owner: "mail/rehearsal", budget: 1 });
		const resolutionsBefore = state().resolved[m.root]?.length ?? 0;
		resolveException(m.owner, m.root, m.root, { action: "answer", note: "Owner acknowledges later changes-requested; awaiting authorized human merge." });
		await until(() => (state().resolved[m.root]?.length ?? 0) > resolutionsBefore, "public acknowledgement applied", true);
		record("acknowledgement", { applied: true, resolved: state().resolved });
		await halt();
	} else {
		if (!fresh) start({ cwd: m.owner, root: m.root, owner: "mail/rehearsal", budget: 1 });
		if (m.mode === "pr-merge" && m.progress === "published") {
			const repair = await until(() => state().pr?.repair?.worker, "failing Actions repair");
			assert.equal(state().pr!.repair!.request.kind, "checks");
			record("failedCheck", { snapshot: observe(), request: state().pr!.repair!.request, worker: repair });
			// A real base advancement conflicts with a's edit; one bounded repair merges both.
			git(m.contributor, "fetch", "-q", "origin"); git(m.contributor, "checkout", "-q", "main");
			git(m.contributor, "merge", "--ff-only", "origin/main");
			const base = commit(m.contributor, "fixture/conflict.txt", "base edit\n"); git(m.contributor, "push", "-q", "origin", "main");
			await green(m.contributor, base);
			git(m.contributor, "checkout", "-qb", "contributor-" + m.root, "origin/" + state().pr!.branch);
			const foreign = commit(m.contributor, "fixture/contributor.txt", "separate clone, same authorized mlegls login\n");
			git(m.contributor, "push", "-q", "origin", "HEAD:refs/heads/" + state().pr!.branch);
			await until(() => existsSync(join(repair.path, "shell-started")), "repair shell ready");
			await cut("restartDuringRepair");
			git(repair.path, "fetch", "-q", "origin");
			let conflict = false;
			try { git(repair.path, "merge", "--no-edit", "origin/main"); } catch { conflict = true; }
			assert(conflict); put(repair.path, "fixture/conflict.txt", "branch edit + base edit\n");
			git(repair.path, "add", "fixture/conflict.txt"); git(repair.path, "commit", "-qm", "Merge base conflict preserving both histories");
			commit(repair.path, "fixture/ci.txt", "green\n");
			commit(repair.path, packet(m.root + "-repair"), "# Repair evidence\n\nObserved Actions failure: fixture/ci.txt was red; now green. Base and contributor histories retained.\n");
			report(repair, m.root, undefined, packet(m.root + "-repair"));
			record("repairSubmitted", { base, foreign, worker: repair.handle, head: head(repair.path), conflictObserved: conflict, pusherIdentity: "mlegls (separate clone, supervisor-approved)" });
			m.progress = "merge-submitted"; persist();
		}
		if (!fresh && m.mode === "pr-review" && observe().state === "OPEN") {
			await Bun.sleep(70_000);
			record("humanObservation", { snapshot: observe(), exceptions: state().exceptions, repairs: state().pr!.repairs, results: state().results });
		}
		if (m.mode === "pr-merge" || observe().state === "MERGED") {
			await until(() => state().finished === "done", "merge and child-first target closure");
			const s = state(), pr = observe(), repair = s.pr!.repairHistory![0];
			assert.equal(pr.state, "MERGED"); assert.equal(s.pr!.ownerSync, "updated"); assert.equal(head(m.owner), pr.mergeCommit);
			assert.equal(git(m.owner, "show", "-s", "--format=%P", pr.mergeCommit!).split(" ").length, 2);
			assert(tracker.snapshot().get(outside)?.frontier);
			for (const slug of nodes) { assert.equal(tracker.fields(slug).stage, "done"); assert.equal(s.results[slug].evidence, packet(slug)); }
			if (m.mode === "pr-merge") {
				const ancestors = m.observations.repairSubmitted as { base: string; foreign: string };
				for (const oid of [ancestors.base, ancestors.foreign]) git(m.owner, "merge-base", "--is-ancestor", oid, pr.head);
			}
			const gates = readFileSync(join(area, "gates"), "utf8").trim().split("\n");
			assert(gates.some(line => line.endsWith(repair.pushedHead!)));
			assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === m.root));
			record("merged", { pr, results: s.results, closeSubjects: git(m.repo, "log", "--reverse", "--format=%s", m.ownerBefore! + "..HEAD").split("\n").filter(x => x.includes("close ")),
				owner: head(m.owner), ownerSync: s.pr!.ownerSync, outsideReady: true, repair, gates, hooks: readFileSync(join(area, "hooks"), "utf8").trim().split("\n"), liveWorkers: 0 });
			m.progress = "done"; persist();
		} else if (m.progress === "published") {
			await green(m.owner, state().pr!.pushedHead!);
			await until(() => !Object.keys(state().chains).length, "workers retired");
			await cut("restartWhileWaiting");
			gh(["pr", "close", String(state().pr!.number), "--repo", repository]);
			await until(() => state().exceptions[m.root], "closed-unmerged owner exception", true);
			record("closedUnmerged", { snapshot: observe(), exception: state().exceptions[m.root], globalStages: nodes.map(slug => [slug, tracker.fields(slug).stage]) });
			gh(["pr", "reopen", String(state().pr!.number), "--repo", repository]);
			resolveException(m.owner, m.root, m.root, { action: "answer", note: "Scratch PR deliberately reopened; resume waiting on same identity." });
			await until(() => !state().exceptions[m.root], "closed PR resolution applied", true);
			const before = state().pr!.repairs;
			const comment = api("repos/" + repository + "/issues/" + state().pr!.number + "/comments", { body: "Ordinary PR comment; no submitted review and no repair requested." });
			await Bun.sleep(70_000); assert.equal(state().pr!.repairs, before);
			record("ordinaryComment", { id: comment.id, url: comment.html_url, repairsBefore: before, repairsAfter: state().pr!.repairs });
			const review = api("repos/" + repository + "/pulls/" + state().pr!.number + "/reviews", { event: "COMMENT", commit_id: state().pr!.pushedHead,
				body: "Submitted COMMENTED review: please repair both inline fixture observations.", comments: [
					{ path: "fixture/conflict.txt", line: 1, side: "RIGHT", body: "Retain both the branch and base meanings in this fixture." },
					{ path: "fixture/" + childB + ".txt", line: 1, side: "RIGHT", body: "Clarify the child's evidence in this fixture." }] });
			record("submittedCommented", { id: review.id, node: review.node_id, state: review.state, url: review.html_url });
			const repair = await until(() => state().pr?.repair?.worker, "submitted COMMENTED repair");
			await until(() => existsSync(join(repair.path, "shell-started")), "review worker shell");
			assert.equal(state().pr!.repair!.request.kind, "review"); assert.equal(state().pr!.repair!.request.threadIds!.length, 2);
			commit(repair.path, "fixture/conflict.txt", "branch edit; base meaning preserved\n");
			commit(repair.path, "fixture/" + childB + ".txt", childB + " code; evidence clarified\n");
			commit(repair.path, packet(m.root + "-repair"), "# Live COMMENTED repair\n\nBoth inline fixture observations repaired, integration gates rerun.\n");
			report(repair, m.root, Object.fromEntries(state().pr!.repair!.request.threadIds!.map(id => [id, "Committed fixture clarification; integration gate passed on pushed head."])), packet(m.root + "-repair"));
			await until(() => !state().pr!.repair && state().pr!.reviews.repaired.includes(review.node_id), "pushed repair and each live reply");
			const snapshot = observe();
			const ownComments = snapshot.threads.flatMap(t => t.comments).filter(c => c.body.includes("reconcile:" + m.root + ":review:"));
			assert.equal(ownComments.length, 2); assert(ownComments.every(c => c.reviewId));
			await cut("restartAfterReplies");
			await Bun.sleep(70_000);
			assert.equal(state().pr!.repairs, before + 1); assert.equal(observe().state, "OPEN");
			const ownReviewIds = ownComments.map(c => c.reviewId!);
			assert(ownReviewIds.every(id => state().pr!.reviews.processed.includes(id)));
			assert(!(await allThreads()).some(t => !t.archived && t.worker?.run === m.root));
			record("ownRepliesIgnored", { snapshot: observe(), ownComments, ownReviewIds, processed: state().pr!.reviews.processed, repairs: state().pr!.repairs,
				originalResults: state().results, liveWorkers: 0, ownerUnchanged: head(m.owner) === m.ownerBefore });
			m.progress = "needs-human"; persist();
		}
		if (m.mode === "pr-review" && m.progress !== "done") {
			record("humanBoundary", { url: state().pr!.url, number: state().pr!.number, root: m.root, area, progress: m.progress,
				required: ["Distinct authorized account: approval while PR is open; observe no reconciler merge",
					"Distinct account: CHANGES_REQUESTED with at least two unresolved inline threads; observe owner exception after earlier COMMENTED repair",
					"Public ack through journey.ts ack; authorized human merge commit; journey.ts resume observes child-first closure"] });
			await halt();
		}
	}
} catch (error) {
	await halt(); record("failure", { message: String(error), log: state()?.log?.slice(-10), exceptions: state()?.exceptions });
	throw error;
}
console.log("OWNED_DIRECTORY " + area);
