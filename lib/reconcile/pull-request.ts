import { execFileSync } from "node:child_process";
import type { Handle } from "../dispatch.ts";
import { integrate } from "../dispatch.ts";
import type { Message } from "../board/store.ts";
import { parse } from "../report.ts";
import { assertNoTrackerChanges } from "../thread/tracker-worktree.ts";
import type { Tracker } from "../tracker.ts";
import type { GlobalRunState } from "./tracker-state.ts";
import { createPullRequestHost } from "./pr-host.ts";
import { publication } from "./pr-body.ts";
import { failedCheckDiagnostics } from "./pr-diagnostics.ts";
import * as reviewSelector from "./pr-reviews.ts";
import { declaredGates, evidencePacket, evidenceShapeError, git, heldByRed, isAncestor,
	storyShapeError, testCommands, testRun, unheld } from "./checks.ts";
import { landingConflict, prepareLandingDependencies } from "./landing.ts";
import type { PrRepairRequest, PullRequestHost, PullRequestLanding, PullRequestSnapshot, ReportedCheck } from "./pr-types.ts";

/** Run-owned hooks; remote waiting holds no idle worker. */
export interface PullRequestContext {
	state: GlobalRunState;
	tracker: Tracker;
	host?: PullRequestHost;
	save: () => void;
	locked: <T>(work: () => Promise<T>) => Promise<T>;
	tests: string[];
	/** Owner exceptions pause actuation, not terminal PR observation. */
	ownerHeld?: boolean;
	launchRepair: (request: PrRepairRequest) => Promise<Handle>;
	report: (worker: Handle, after?: string, launchedAt?: number) => Message | undefined;
	retireRepair: (worker: Handle) => Promise<void>;
	sendRepair: (worker: Handle, message: string) => Promise<void>;
	repairAlive?: (worker: Handle) => boolean | undefined;
	raiseOwner: (reason: string, message: string) => void;
}

export const pullRequestLifecycleReady = true;
const POLL_MS = 60_000, REPAIRS = 2, INTEGRATIONS = 3;
class SaveFailure extends Error {}
function persist(c: PullRequestContext, change: (pr: PullRequestLanding) => void): void {
	const before = c.state.pr!;
	const next = structuredClone(before);
	change(next);
	c.state.pr = next;
	try { c.save(); }
	catch (error) { c.state.pr = before; throw new SaveFailure(String(error)); }
}
function diagnostics(error: unknown): string {
	const e = error as { message?: string; stdout?: unknown; stderr?: unknown };
	return (e.message ?? String(error)) + "\n" + String(e.stdout ?? "").slice(-5000) + String(e.stderr ?? "").slice(-5000);
}
function checksMessage(checks: ReportedCheck[]): string {
	return checks.map(check => check.name + " [" + check.id + "]: " + check.state + "\n" +
		(check.url ?? "") + "\n" + (check.details ?? "").slice(-8000)).join("\n\n");
}
function hold(c: PullRequestContext, reason: string, message: string): "held" {
	const pr = c.state.pr!;
	c.raiseOwner(reason, (pr.url ?? pr.repository + ":" + pr.branch) + "\nHead: " +
		(pr.pushedHead ?? pr.preparedHead ?? "not published") + "\n\n" + message);
	return "held";
}
function ref(pr: PullRequestLanding, branch: string): string {
	return "refs/remotes/" + pr.remote + "/" + branch;
}
function fetchBase(pr: PullRequestLanding): string {
	git(pr.path, "fetch", pr.remote, "+refs/heads/" + pr.baseBranch + ":" + ref(pr, pr.baseBranch));
	return git(pr.path, "rev-parse", ref(pr, pr.baseBranch));
}
function fetchHeads(pr: PullRequestLanding, required: boolean): { base: string; head?: string } {
	const base = fetchBase(pr);
	const remote = git(pr.path, "ls-remote", "--heads", pr.remote, "refs/heads/" + pr.branch);
	if (!remote) {
		if (required) throw new Error("Open PR head branch is missing: " + pr.branch);
		return { base };
	}
	git(pr.path, "fetch", pr.remote, "+refs/heads/" + pr.branch + ":" + ref(pr, pr.branch));
	return { base, head: git(pr.path, "rev-parse", ref(pr, pr.branch)) };
}
function clean(pr: PullRequestLanding): void {
	if (git(pr.path, "branch", "--show-current") !== pr.branch) throw new Error("PR staging branch changed");
	const dirty = git(pr.path, "status", "--porcelain");
	if (dirty) throw new Error("PR staging has uncommitted changes:\n" + dirty);
}
function gates(c: PullRequestContext, cwd: string, before: string, handoff?: Record<string, unknown>): void {
	prepareLandingDependencies(cwd, before);
	const run = (cmd: string[], timeout = 30 * 60_000) => execFileSync(cmd[0], cmd.slice(1), {
		cwd, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20, timeout,
	});
	for (const gate of declaredGates(cwd)) run(["bash", "-lc", gate.cmd], gate.timeout);
	const handoffs = [...Object.values(c.state.results).map(result => result.handoff), ...(handoff ? [handoff] : [])];
	for (const file of new Set([...c.tests, ...handoffs.flatMap(testCommands)])) {
		const command = testRun(cwd, file);
		if (command) run(command);
	}
	for (const packet of handoffs) if (packet.evidence !== undefined) evidencePacket(cwd, packet);
	assertNoTrackerChanges(cwd, before);
	if (git(cwd, "status", "--porcelain")) throw new Error("PR gates left uncommitted changes in " + cwd);
}
/** Probe conflicts before mutating staging. Workers receive both exact histories and named paths. */
function mergeHistory(cwd: string, target: string): void {
	if (isAncestor(cwd, target)) return;
	const before = git(cwd, "rev-parse", "HEAD");
	const conflict = landingConflict(cwd, before, target);
	if (conflict) throw new Error(conflict + "\nMerge both histories: local " + before + " and incoming " + target);
	git(cwd, "-c", "merge.conflictStyle=diff3", "merge", "--no-edit", "--no-stat", target);
}
async function beginRepair(c: PullRequestContext, request: PrRepairRequest): Promise<"waiting" | "held"> {
	if (c.state.pr!.repairs >= REPAIRS) return hold(c, "PR repair budget exhausted", request.message);
	persist(c, pr => {
		pr.phase = "repairing"; pr.repairs++; pr.integrationFailures = 0; // integration budget is per repair
		pr.repair = { request, launchedAt: Date.now() };
	});
	return await launchRepair(c);
}
async function launchRepair(c: PullRequestContext): Promise<"waiting"> {
	const receipt = c.state.pr!.repair!;
	const worker = await c.launchRepair(receipt.request);
	persist(c, pr => { pr.repair!.worker = worker; });
	return "waiting";
}
async function terminal(c: PullRequestContext, snapshot: PullRequestSnapshot): Promise<"merged" | "held" | undefined> {
	if (snapshot.state === "OPEN") return;
	if (snapshot.state === "CLOSED") {
		persist(c, pr => { pr.phase = "closed"; });
		await retireRepair(c);
		return hold(c, "PR closed without merge", "The saved PR was closed without a merge. Reopen this same PR before retrying.");
	}
	const pr = c.state.pr!, base = fetchBase(pr);
	if (!snapshot.mergeCommit || !snapshot.mergedAt) throw new Error("MERGED observation lacks merge commit/time");
	for (const oid of [snapshot.head, pr.preparedHead, pr.pushedHead, c.state.landed[c.state.root]?.head].filter(Boolean) as string[])
		if (!isAncestor(pr.path, oid, snapshot.mergeCommit)) throw new Error("Observed merge does not carry exact prepared/pushed history: " + oid);
	if (!isAncestor(pr.path, snapshot.mergeCommit, base)) throw new Error("Observed merge is not in fetched base: " + snapshot.mergeCommit);
	persist(c, next => {
		next.phase = "merged"; next.mergeCommit = snapshot.mergeCommit; next.mergedAt = snapshot.mergedAt;
		next.baseHead = base;
	});
	await retireRepair(c);
	return "merged";
}
async function retireRepair(c: PullRequestContext): Promise<void> {
	const r = c.state.pr!.repair;
	if (!r?.worker || r.retiredAt) return;
	// Identity and integration/push/terminal intent were saved before destructive cleanup.
	await c.retireRepair(r.worker);
	persist(c, pr => { pr.repair!.retiredAt = new Date().toISOString(); });
}
/** Transport errors throw; they never establish absent checks/PRs. */
function observe(c: PullRequestContext, host: PullRequestHost): PullRequestSnapshot | undefined {
	const pr = c.state.pr!;
	persist(c, next => { next.lastPolledAt = new Date().toISOString(); });
	const snapshot = pr.number ? host.observe(pr.path, pr.repository, pr.number) : host.find(pr.path, pr.repository, pr.branch);
	if (!snapshot) return;
	if (snapshot.headBranch !== pr.branch || snapshot.baseBranch !== pr.baseBranch)
		throw new Error("Saved PR identity/head/base mismatch");
	persist(c, next => { next.number = snapshot.number; next.url = snapshot.url; });
	return snapshot;
}
function baseHeld(c: PullRequestContext, host: PullRequestHost, base: string): boolean {
	const pr = c.state.pr!, checks = host.checks(pr.path, pr.repository, base);
	if (checks.some(check => check.state === "pending")) return true;
	const failures = failedCheckDiagnostics(pr.path, pr.repository, checks, !!c.host);
	if (!failures.length) return false; // genuine empty set, never a transport fallback
	const changed = git(pr.path, "diff", "--name-only", base + "...HEAD").split("\n").filter(Boolean);
	return heldByRed(checksMessage(failures), changed);
}
function repairRequest(kind: PrRepairRequest["kind"], head: string, key: string, message: string): PrRepairRequest {
	return { kind, head, key, message };
}
async function integrationFailure(c: PullRequestContext, error: unknown, base: string, head?: string): Promise<"waiting" | "held"> {
	if (error instanceof SaveFailure) throw error;
	persist(c, pr => {
		pr.integrationFailures++;
		pr.repair!.handoff = undefined;
	});
	const message = diagnostics(error) + "\n\nMerge (never rebase) staging " + git(c.state.pr!.path, "rev-parse", "HEAD") +
		", fetched base " + base + (head ? ", fetched PR head " + head : "") +
		". Keep both histories, resolve named files, rerun gates and re-drive affected evidence. Report the full reviewed handoff again.";
	if (c.state.pr!.integrationFailures >= INTEGRATIONS) return hold(c, "PR integration budget exhausted", message);
	await c.sendRepair(c.state.pr!.repair!.worker!, message);
	return "waiting";
}
/** Gate, integrate, push, replies, retirement each have a durable replay boundary. */
async function completeRepair(c: PullRequestContext, host: PullRequestHost, snapshot?: PullRequestSnapshot): Promise<"waiting" | "held"> {
	let pr = c.state.pr!, receipt = pr.repair!;
	// A saved push owns reply replay even if contributors have since advanced the branch.
	if (receipt.pushedHead) return finishRepair(c, host);
	const fetched = fetchHeads(pr, !!snapshot);
	if (snapshot && (fetched.head !== snapshot.head || fetched.base !== snapshot.base)) {
		persist(c, next => { next.lastPolledAt = undefined; }); return "waiting";
	}
	try {
		clean(pr);
		const before = git(pr.path, "rev-parse", "HEAD");
		// An integrate-before-save cut recovers exact prepared worker ancestry.
		if (!receipt.preparedHead || !isAncestor(pr.path, receipt.preparedHead)) {
			await integrate(receipt.worker!, { cwd: pr.path, mode: "merge", keep: true, prepare: async worker => {
				const original = git(worker.path, "rev-parse", "HEAD");
				for (const incoming of [before, fetched.head, fetched.base].filter(Boolean) as string[]) mergeHistory(worker.path, incoming);
				gates(c, worker.path, original, receipt.handoff);
				persist(c, next => { next.repair!.preparedHead = git(worker.path, "rev-parse", "HEAD"); });
			} });
		}
		// New contributors/base changes after the prepared receipt also survive.
		for (const incoming of [fetched.head, fetched.base].filter(Boolean) as string[]) mergeHistory(pr.path, incoming);
		gates(c, pr.path, before, receipt.handoff);
		persist(c, next => {
			next.repair!.integratedHead = git(pr.path, "rev-parse", "HEAD");
			next.preparedHead = next.repair!.integratedHead; next.baseHead = fetched.base;
		});
	} catch (error) { return integrationFailure(c, error, fetched.base, fetched.head); }
	pr = c.state.pr!; receipt = pr.repair!;
	const pushed = await pushPrepared(c, host);
	if (pushed !== "pushed") return pushed;
	persist(c, next => { next.repair!.pushedHead = next.pushedHead; });
	if (!c.state.pr!.number) {
		const opened = await open(c, host);
		if (opened !== "waiting" || c.state.pr!.phase === "merged") return opened === "merged" ? "waiting" : opened;
	}
	return finishRepair(c, host);
}
async function finishRepair(c: PullRequestContext, host: PullRequestHost): Promise<"waiting"> {
	const pr = c.state.pr!, receipt = pr.repair!;
	for (const thread of receipt.request.threadIds ?? []) {
		const ids = receipt.request.reviewIds ?? [];
		const marker = reviewSelector.replyMarkerPrefix(c.state.root) + [...ids].sort().join(",") +
			":thread:" + thread + ":head:" + receipt.pushedHead;
		if (!c.state.pr!.reviews.replies[marker]) {
			host.reply(pr.path, pr.repository, thread, receipt.threadReplies![thread], marker);
			persist(c, next => { next.reviews.replies[marker] = new Date().toISOString(); });
		}
	}
	persist(c, next => {
		const ids = receipt.request.reviewIds ?? [];
		next.reviews.processed = [...new Set([...next.reviews.processed, ...ids])];
		next.reviews.repaired = [...new Set([...next.reviews.repaired, ...ids])];
		if (ids.length) {
			const at = new Date().toISOString();
			next.reviews.firstRepairAt ??= next.reviews.lastRepair?.at ?? at;
			next.reviews.lastRepair = { at, head: receipt.pushedHead!, reviewIds: ids };
		}
	});
	await retireRepair(c);
	persist(c, next => {
		(next.repairHistory ??= []).push(next.repair!);
		next.repair = undefined; next.phase = "waiting";
	});
	return "waiting";
}
/** Fresh observation after possibly long gates, plus normal push. A race is a refresh, never force. */
async function pushPrepared(c: PullRequestContext, host: PullRequestHost): Promise<"pushed" | "waiting" | "held"> {
	const pr = c.state.pr!, snapshot = observe(c, host);
	if (snapshot) {
		const ended = await terminal(c, snapshot);
		if (ended) return ended === "held" ? "held" : "waiting";
	}
	const fetched = fetchHeads(c.state.pr!, !!snapshot);
	if ((snapshot && (snapshot.head !== fetched.head || snapshot.base !== fetched.base)) ||
		fetched.base !== pr.baseHead || (fetched.head && !isAncestor(pr.path, fetched.head))) {
		persist(c, next => { next.lastPolledAt = undefined; }); return "waiting";
	}
	if (git(pr.path, "rev-parse", "HEAD") !== c.state.pr!.preparedHead) throw new Error("Staging changed after gates");
	try { git(pr.path, "push", pr.remote, "HEAD:refs/heads/" + pr.branch); }
	catch (error) {
		const newer = fetchHeads(c.state.pr!, !!snapshot);
		if (newer.head && !isAncestor(pr.path, newer.head) || newer.base !== fetched.base) {
			persist(c, next => { next.lastPolledAt = undefined; }); return "waiting";
		}
		if (c.state.pr!.repair) return integrationFailure(c, error, newer.base, newer.head);
		return beginRepair(c, repairRequest("checks", pr.preparedHead!, "push:" + pr.preparedHead,
			"Normal push/hook failed:\n" + diagnostics(error)));
	}
	persist(c, next => { next.pushedHead = next.preparedHead; });
	return "pushed";
}

async function open(c: PullRequestContext, host: PullRequestHost): Promise<"waiting" | "merged" | "held"> {
	let pr = c.state.pr!;
	if (!pr.publication) persist(c, next => { next.publication = publication(c.state, c.tracker); });
	pr = c.state.pr!;
	const existing = host.find(pr.path, pr.repository, pr.branch);
	const opened = existing ?? host.create(pr.path, pr.repository, { ...pr.publication!, headBranch: pr.branch, baseBranch: pr.baseBranch });
	persist(c, next => { next.number = opened.number; next.url = opened.url; next.phase = next.repair ? "repairing" : "waiting"; });
	const ended = await terminal(c, opened);
	// Zero reported checks needs no artificial minute-long grace period.
	return ended ?? await mergeIfReady(c, host, opened);
}
async function mergeIfReady(c: PullRequestContext, host: PullRequestHost, snapshot: PullRequestSnapshot): Promise<"waiting" | "merged" | "held"> {
	const pr = c.state.pr!;
	if (c.state.land !== "pr-merge" || pr.repair || snapshot.checks.some(check => check.state !== "pass")) return "waiting";
	// Re-observe after gates/pushes; neither stale checks nor a moved base grants permission.
	const fresh = observe(c, host)!;
	const ended = await terminal(c, fresh);
	if (ended) return ended;
	const current = fetchHeads(c.state.pr!, true);
	if (fresh.head !== pr.pushedHead || fresh.head !== current.head || fresh.base !== current.base ||
		fresh.base !== pr.baseHead || fresh.checks.some(check => check.state !== "pass") || baseHeld(c, host, current.base)) {
		persist(c, next => { next.lastPolledAt = undefined; }); return "waiting";
	}
	if (fresh.mergeable === "CONFLICTING") return "waiting";
	try { host.merge(pr.path, pr.repository, pr.number!, fresh.head); }
	catch (error) {
		const newer = observe(c, host);
		if (newer) {
			const ended = await terminal(c, newer);
			if (ended) return ended;
			if (newer.head !== fresh.head || newer.base !== fresh.base || newer.mergeable === "UNKNOWN") return "waiting";
		}
		return hold(c, "PR merge refused", diagnostics(error));
	}
	// Successful request is not observed merged metadata. Observe on the next tick.
	persist(c, next => { next.lastPolledAt = undefined; });
	return "waiting";
}

export async function advancePullRequest(c: PullRequestContext): Promise<"waiting" | "merged" | "held"> {
	return c.locked(async () => {
		const host = c.host ?? createPullRequestHost();
		try {
			if (!c.state.pr || (c.state.land ?? "local") === "local") throw new Error("PR lifecycle requires a captured PR run");
			let pr = c.state.pr!;
			if (pr.phase === "merged") { await retireRepair(c); return "merged"; }
			const receipt = pr.repair;
			const report = receipt?.worker && !receipt.handoff && c.report(receipt.worker, receipt.handledTs, receipt.launchedAt);
			let ready = !!receipt?.handoff;
			const due = !pr.lastPolledAt || Date.now() - Date.parse(pr.lastPolledAt) >= POLL_MS;
			if (!due && !c.ownerHeld && report && parse(report.body).status === "waiting") {
				persist(c, next => { next.repair!.handledTs = report.ts; }); return "waiting";
			}
			// On the 5s worker tick, wait/report observation may proceed without a remote poll.
			// Any actionable handoff forces terminal observation BEFORE work or an exception.
			if (!due && (c.ownerHeld || (!ready && !report))) return "waiting";
			const snapshot = observe(c, host);
			if (snapshot) {
				const ended = await terminal(c, snapshot);
				if (ended) return ended;
			}
			if (c.ownerHeld) return "waiting";
			if (report) {
				const parsed = parse(report.body);
				if (parsed.status === "waiting") {
					persist(c, next => { next.repair!.handledTs = report.ts; });
				} else if (parsed.status !== "done" || parsed.handoffError ||
					storyShapeError(parsed.handoff) || evidenceShapeError(parsed.handoff) || unheld(parsed.handoff)) {
					persist(c, next => { next.repair!.handledTs = report.ts; });
					return hold(c, "PR repair needs owner", parsed.handoffError ?? report.body);
				} else {
					const replies = parsed.handoff!.threadReplies as Record<string, string> | undefined;
					if ((receipt!.request.threadIds ?? []).some(thread => !replies || typeof replies[thread] !== "string" || !replies[thread].trim()))
						return hold(c, "PR review repair lacks replies", "threadReplies must name every requested thread.\n" + report.body);
					persist(c, next => {
						next.repair!.handledTs = report.ts; next.repair!.handoff = parsed.handoff!;
						next.repair!.threadReplies = replies; next.repair!.preparedHead = undefined;
						next.repair!.integratedHead = undefined; next.repair!.pushedHead = undefined;
					});
					ready = true;
				}
			}
			pr = c.state.pr!;
			if (pr.repair) {
				if (!snapshot && pr.number) throw new Error("Published repair PR cannot disappear");
				if (!pr.repair.worker) return await launchRepair(c);
				if (pr.repair.retiredAt && pr.repair.pushedHead) return await finishRepair(c, host);
				if (c.repairAlive?.(pr.repair.worker) === false && !ready)
					return hold(c, "PR repair worker exited", "No completed reviewed handoff from exact worker " + pr.repair.worker.handle);
				return ready ? await completeRepair(c, host, snapshot) : "waiting";
			}
			const fetched = fetchHeads(pr, !!snapshot);
			if (snapshot && (snapshot.head !== fetched.head || snapshot.base !== fetched.base)) {
				persist(c, next => { next.lastPolledAt = undefined; }); return "waiting";
			}
			if (baseHeld(c, host, fetched.base)) return "waiting";
			clean(pr);
			const before = git(pr.path, "rev-parse", "HEAD");
			try {
				for (const incoming of [fetched.head, fetched.base].filter(Boolean) as string[]) mergeHistory(pr.path, incoming);
				const head = git(pr.path, "rev-parse", "HEAD");
				if (head !== pr.preparedHead || pr.baseHead !== fetched.base || !pr.pushedHead) {
					gates(c, pr.path, pr.preparedHead ?? before);
					persist(c, next => { next.preparedHead = git(pr.path, "rev-parse", "HEAD"); next.baseHead = fetched.base; next.phase = next.number ? "waiting" : "opening"; });
				}
			} catch (error) {
				if (error instanceof SaveFailure) throw error;
				return await beginRepair(c, repairRequest("base", before, "update:" + before + ":" + fetched.head + ":" + fetched.base,
					diagnostics(error) + "\nLocal history " + before + "; fetched PR head " + fetched.head +
					"; fetched base " + fetched.base + ". Merge both histories; preserve every commit."));
			}
			pr = c.state.pr!;
			if (git(pr.path, "rev-parse", "HEAD") !== pr.pushedHead || !fetched.head) {
				const pushed = await pushPrepared(c, host);
				if (pushed !== "pushed") return pushed;
			}
			pr = c.state.pr!;
			if (!pr.number) return await open(c, host);
			// If this tick changed/pushed history, the original checks belong to an old head.
			if (!snapshot || snapshot.head !== pr.pushedHead) return "waiting";
			const failed = failedCheckDiagnostics(pr.path, pr.repository, snapshot.checks, !!c.host);
			if (failed.length) return await beginRepair(c, repairRequest("checks", snapshot.head,
				"checks:" + snapshot.head + ":" + failed.map(check => check.id).sort().join(","),
				"Failing checks on exact PR head " + snapshot.head + ":\n\n" + checksMessage(failed)));
			if (c.state.land === "pr-review" && snapshot.reviews.length) {
				const action = reviewSelector.nextReviewAction(pr, snapshot, c.state.root);
				persist(c, next => { next.reviews.processed = [...new Set([...next.reviews.processed, ...action.processed])]; });
				if (action.kind === "exception") return hold(c, action.reason, action.message);
				if (action.kind === "repair") return await beginRepair(c, action.request);
			}
			return await mergeIfReady(c, host, snapshot);
		} catch (error) {
			if (error instanceof SaveFailure) throw error;
			return hold(c, "PR observation/publication failed", diagnostics(error));
		}
	});
}
