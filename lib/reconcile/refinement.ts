import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { integrate, type Handle } from "../dispatch.ts";
import type { Issue, Tracker } from "../tracker.ts";
import { getThread, workerThread } from "../thread/registry.ts";
import { assertNoTrackerChanges } from "../thread/tracker-worktree.ts";
import type { GlobalRunState, RefinementAttempt } from "./tracker-state.ts";

export interface RefinementContext {
	state: GlobalRunState;
	tracker: Tracker;
	save: () => void;
	/** Stop the exact writer, including a registered launch with no saved receipt.
	 * Failure is fatal to cleanup/adoption: never delete beneath a live writer. */
	stopWriter: (attempt: RefinementAttempt) => Promise<void>;
	locked: <T>(work: () => Promise<T>) => Promise<T>;
}
export interface RefinementAcceptance {
	worker: Handle;
	children: string[];
	reportTs: string;
	report: string;
	/** Code/stubs land in this collector; this is not a completion ledger entry. */
	into: string;
	destination: string;
}
export type RefinementOutcome = { kind: "promoted" | "decomposed"; children: string[] };

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], {
	encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
}).trim();
const stableClaim = (context: RefinementContext) => "reconcile:" + context.state.root;
const attemptOf = (context: RefinementContext, handle: string) => {
	const attempt = context.state.refinements[handle];
	if (!attempt) throw new Error("Unknown refinement attempt: " + handle);
	return attempt;
};

/** A failed save must not make this process behave as if intent were durable. */
function persist(context: RefinementContext, change: () => void): void {
	const before = structuredClone(context.state.refinements);
	try { change(); context.save(); }
	catch (error) { context.state.refinements = before; throw error; }
}

function subtree(rows: Map<string, Issue>, node: string): Issue[] {
	const found: Issue[] = [], seen = new Set<string>();
	const visit = (slug: string) => {
		if (seen.has(slug)) throw new Error("Refinement part-of cycle: " + slug);
		seen.add(slug);
		const row = rows.get(slug);
		if (!row) return;
		found.push(row);
		for (const child of rows.values()) if (child.partOf === slug) visit(child.slug);
	};
	visit(node);
	return found;
}

function stillOwned(context: RefinementContext, attempt: RefinementAttempt, rows: Map<string, Issue>): Issue[] {
	const baseline = new Set(attempt.baseline);
	return subtree(rows, attempt.node).filter(row => row.slug !== attempt.node && !baseline.has(row.slug)
		&& context.tracker.fields(row.slug)["claimed-by"] === attempt.claim)
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

function remember(context: RefinementContext, handle: string, slugs: string[]): void {
	const attempt = attemptOf(context, handle);
	const added = slugs.filter(slug => !attempt.owned.includes(slug));
	if (added.length) persist(context, () => attemptOf(context, handle).owned.push(...added));
}

/** Save original subtree identities + parent fields before the writer launches. */
export function beginRefinement(context: RefinementContext, node: string, handle: string): RefinementAttempt {
	const existing = context.state.refinements[handle];
	if (existing) {
		if (existing.node !== node) throw new Error("Refinement handle reused for another node: " + handle);
		return existing;
	}
	const rows = context.tracker.snapshot();
	if (!rows.has(node)) throw new Error("No refinement node: " + node);
	const attempt: RefinementAttempt = {
		node, handle, claim: stableClaim(context) + "/" + handle,
		baseline: subtree(rows, node).map(row => row.slug),
		parentFields: structuredClone(context.tracker.fields(node)), owned: [], phase: "writing",
	};
	persist(context, () => { context.state.refinements[handle] = attempt; });
	return attemptOf(context, handle);
}

/** Discover creates by exact attempt claim and original baseline, including a
 * create published before a crash but not yet observed by the running loop. */
export function observeRefinements(context: RefinementContext): void {
	const rows = context.tracker.snapshot();
	for (const attempt of Object.values(context.state.refinements)) {
		if (attempt.phase === "accepted" || attempt.phase === "removed") continue;
		remember(context, attempt.handle, stillOwned(context, attempt, rows).map(row => row.slug));
	}
}

function assertAbortable(context: RefinementContext, attempt: RefinementAttempt): void {
	if (attempt.phase !== "accepting") return;
	// Once stubs reached the collector, deleting their contracts would strand
	// committed code. A prepared-head receipt also proves a merge-before-save.
	const intent = attempt.acceptance;
	if (intent?.landedHead || (intent?.preparedHead && contains(intent.destination, intent.preparedHead)))
		throw new Error("Recover refinement claim conversion before replacing: " + attempt.handle + " (stubs already landed)");
	const converted = subtree(context.tracker.snapshot(), attempt.node).some(row =>
		!attempt.baseline.includes(row.slug) && attempt.owned.includes(row.slug)
		&& context.tracker.fields(row.slug)["claimed-by"] === stableClaim(context));
	if (converted) throw new Error("Recover refinement claim conversion before replacing: " + attempt.handle);
}

async function discard(context: RefinementContext, handle: string): Promise<void> {
	let attempt = attemptOf(context, handle);
	if (attempt.phase === "removed") return;
	if (["accepted", "adopting"].includes(attempt.phase))
		throw new Error("Cannot discard refinement in phase " + attempt.phase + ": " + handle);
	assertAbortable(context, attempt);
	if (attempt.phase !== "cleaning") {
		persist(context, () => { attemptOf(context, handle).phase = "stopping"; });
		await context.stopWriter(attemptOf(context, handle));
		persist(context, () => { attemptOf(context, handle).phase = "cleaning"; });
	}
	// cleaning is the durable receipt of a successful exact-writer stop.
	while (true) {
		attempt = attemptOf(context, handle);
		const rows = context.tracker.snapshot();
		const owned = stillOwned(context, attempt, rows);
		remember(context, handle, owned.map(row => row.slug));
		if (!owned.length) break;
		// Dependents first as well as descendants. Never orphan protected children
		// or change an unrelated dependent just to make a removal possible.
		const leaf = owned.find(row => ![...rows.values()].some(other =>
			other.partOf === row.slug || other.blockedBy.includes(row.slug)));
		if (!leaf) throw new Error("Refinement cleanup blocked by retained children/dependents: " + owned.map(row => row.slug).join(", "));
		const parent = leaf.partOf ? rows.get(leaf.partOf) : undefined;
		if (parent?.ownStage === null && ![...rows.values()].some(row => row.partOf === parent.slug && row.slug !== leaf.slug)) {
			if (parent.slug === attempt.node) {
				const stage = attempt.parentFields.stage;
				if (typeof stage !== "string") throw new Error("No saved residual stage for " + parent.slug);
				context.tracker.update(parent.slug, { stage });
			} else if (stillOwned(context, attempt, rows).some(row => row.slug === parent.slug)) {
				// A provisional container has no saved residual of its own. Give it
				// a temporary executable residual before pruning its final child.
				context.tracker.update(parent.slug, { stage: "spec" });
			} else throw new Error("Cannot restore an unowned omitted-stage container: " + parent.slug);
			context.save();
		}
		// Re-check exact authority after the preceding write; an old observation
		// is audit, never permission to remove a child whose owner changed.
		if (!stillOwned(context, attemptOf(context, handle), context.tracker.snapshot()).some(row => row.slug === leaf.slug)) continue;
		context.tracker.remove(leaf.slug);
		context.save();
	}
	persist(context, () => { attemptOf(context, handle).phase = "removed"; });
}

/** Stop first, persist cleanup intent, prune only still-owned new descendants,
 * and restore a valid parent residual stage. Idempotent across partial writes. */
export async function discardRefinement(context: RefinementContext, handle: string): Promise<void> {
	await context.locked(() => discard(context, handle));
}

async function adopt(context: RefinementContext, oldHandle: string): Promise<void> {
	const old = attemptOf(context, oldHandle);
	if (!old.successor) throw new Error("Missing adoption successor: " + oldHandle);
	const successor = attemptOf(context, old.successor);
	if (successor.adoptedFrom !== oldHandle || successor.phase !== "adopting")
		throw new Error("Invalid adoption relation: " + oldHandle);
	// Both exact tokens are reserved until the whole operation is saved. Stop
	// is deliberately repeatable: adopting alone does not prove the writer died.
	await context.stopWriter(old);
	const rows = context.tracker.snapshot();
	const children = stillOwned(context, old, rows);
	remember(context, oldHandle, children.map(row => row.slug));
	remember(context, successor.handle, [
		...children.map(row => row.slug), ...stillOwned(context, successor, rows).map(row => row.slug),
	]);
	for (const child of children) {
		if (!stillOwned(context, attemptOf(context, oldHandle), context.tracker.snapshot()).some(row => row.slug === child.slug)) continue;
		context.tracker.update(child.slug, { "claimed-by": successor.claim });
		context.save();
	}
	persist(context, () => {
		attemptOf(context, oldHandle).phase = "removed";
		attemptOf(context, successor.handle).phase = "writing";
	});
}

/** A checkpoint is adoption; an owner retry adopts only with adopt:true. Save
 * successor ownership before changing any old token; an ordinary replacement
 * discards first and gets a new post-cleanup baseline. */
export async function replaceRefinement(context: RefinementContext, oldHandle: string, newHandle: string, adoption: boolean): Promise<RefinementAttempt> {
	return context.locked(async () => {
		const old = attemptOf(context, oldHandle);
		if (oldHandle === newHandle) throw new Error("A successor needs a new launch handle");
		if (old.successor) {
			if (old.successor !== newHandle) throw new Error("Refinement already has a different successor");
			if (old.phase === "adopting") await adopt(context, oldHandle);
			return attemptOf(context, newHandle);
		}
		if (!adoption) {
			await discard(context, oldHandle);
			const next = beginRefinement(context, old.node, newHandle);
			persist(context, () => { attemptOf(context, oldHandle).successor = newHandle; });
			return next;
		}
		if (!["writing", "stopping", "accepting"].includes(old.phase)) throw new Error("Cannot adopt refinement in phase " + old.phase);
		assertAbortable(context, old);
		if (context.state.refinements[newHandle]) throw new Error("Successor handle already exists: " + newHandle);
		persist(context, () => {
			context.state.refinements[newHandle] = {
				node: old.node, handle: newHandle, claim: stableClaim(context) + "/" + newHandle,
				baseline: [...old.baseline], parentFields: structuredClone(old.parentFields),
				owned: [...old.owned], phase: "adopting", adoptedFrom: oldHandle,
			};
			attemptOf(context, oldHandle).phase = "adopting";
			attemptOf(context, oldHandle).successor = newHandle;
		});
		await adopt(context, oldHandle);
		return attemptOf(context, newHandle);
	});
}

function validateAcceptance(context: RefinementContext, handle: string, children: string[], replay: boolean): RefinementOutcome {
	const attempt = attemptOf(context, handle), rows = context.tracker.snapshot();
	const node = rows.get(attempt.node);
	if (!node || node.archived || node.done) throw new Error("Refinement node is not open: " + attempt.node);
	// Read the current global prompt contract too; no worker branch fallback.
	if (!context.tracker.text(node.slug).trim()) throw new Error("Empty refinement contract: " + node.slug);
	const fields = context.tracker.fields(node.slug);
	if ((fields["part-of"] ?? null) !== (attempt.parentFields["part-of"] ?? null))
		throw new Error("Refinement moved its own execution scope: " + node.slug);
	const direct = [...rows.values()].filter(row => row.partOf === node.slug && !row.archived && !row.done).map(row => row.slug);
	if (new Set(children).size !== children.length || children.length !== direct.length || children.some(slug => !direct.includes(slug)))
		throw new Error("Reported refinement children do not match open direct children: " + direct.join(", "));
	const stages = ["idea", "goal", "spec", "ticket", "done"];
	const original = typeof attempt.parentFields.stage === "string" ? attempt.parentFields.stage : "spec";
	if (!node.ready || stages.indexOf(node.effectiveStage!) < stages.indexOf(original))
		throw new Error("Refinement lowered the effective stage: " + node.slug);
	if (!children.length && (node.ownStage !== "ticket" || node.effectiveStage !== "ticket"))
		throw new Error("Empty refinement report is not a ticket promotion: " + node.slug);
	const baseline = new Set(attempt.baseline);
	const scope = subtree(rows, node.slug);
	for (const row of scope) {
		const claim = context.tracker.fields(row.slug)["claimed-by"];
		const owned = row.slug !== node.slug && !baseline.has(row.slug);
		// A stable claim is replay authority only for recorded creation ownership
		// within this saved acceptance intent, never for a new unrelated identity.
		const converted = replay && attempt.owned.includes(row.slug) && claim === stableClaim(context);
		if (owned && (row.archived || row.done)) throw new Error("Non-executable provisional child: " + row.slug);
		if (owned ? claim !== attempt.claim && !converted : claim !== undefined && claim !== stableClaim(context))
			throw new Error("Foreign or missing refinement claim: " + row.slug);
		if (!row.archived && !row.done) {
			// Starting a run delegates an unassigned root, but never its children.
			const delegatedRoot = row.slug === context.state.root && !row.assignee && row.selectors.every(selector =>
				selector.slug === row.slug || selector.assignee === "agent" || selector.assignee?.startsWith("agent:") || selector.assignee?.startsWith("model:"));
			if (!row.ready || (!row.eligible && !delegatedRoot) || (row.ownStage !== null && !["spec", "ticket", "done"].includes(row.ownStage)))
				throw new Error("Non-executable refinement contract: " + row.slug);
			if (!context.tracker.text(row.slug).trim()) throw new Error("Empty refinement child contract: " + row.slug);
		}
	}
	return { kind: children.length ? "decomposed" : "promoted", children: [...children] };
}

function contains(cwd: string, head: string): boolean {
	try { git(cwd, "merge-base", "--is-ancestor", head, "HEAD"); return true; }
	catch (error) {
		if ((error as { status?: number }).status === 1) return false;
		throw error;
	}
}

async function accept(context: RefinementContext, handle: string): Promise<RefinementOutcome> {
	let attempt = attemptOf(context, handle);
	const intent = attempt.acceptance;
	if (!intent || !attempt.worker) throw new Error("Missing refinement acceptance receipt: " + handle);
	if (attempt.phase === "accepted") return { kind: intent.children.length ? "decomposed" : "promoted", children: [...intent.children] };
	const outcome = validateAcceptance(context, handle, intent.children, true);
	const destination = realpathSync(intent.destination);
	if (destination === realpathSync(context.state.cwd) || isAbsolute(intent.into))
		throw new Error("Refinement stubs must land in a collector, not the owner");
	if (intent.landedHead && !contains(destination, intent.preparedHead ?? intent.landedHead))
		throw new Error("Saved refinement stubs no longer reach their collector");
	if (!intent.landedHead) {
		if (intent.preparedHead && contains(destination, intent.preparedHead)) {
			persist(context, () => { attemptOf(context, handle).acceptance!.landedHead = git(destination, "rev-parse", "HEAD"); });
		} else {
			const worker = attempt.worker;
			const thread = worker.threadId ? await getThread(worker.threadId) : await workerThread(worker.handle, context.state.cwd, worker.run);
			if (!thread?.worker || thread.worker.handle !== handle || thread.worker.run !== worker.run
				|| realpathSync(thread.cwd) !== realpathSync(worker.path) || thread.ownership !== "owner" || thread.archived || !thread.branch)
				throw new Error("No exact registered refinement worker: " + handle);
			const branch = git(destination, "branch", "--show-current");
			if (!branch || branch === thread.branch || git(destination, "rev-parse", "--path-format=absolute", "--git-common-dir")
				!== git(thread.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"))
				throw new Error("Invalid refinement collector destination");
			assertNoTrackerChanges(thread.cwd, git(destination, "rev-parse", "HEAD"));
			git(thread.project, "config", "branch." + thread.branch + ".ab-parent", branch);
			await integrate(worker, { cwd: context.state.cwd, keep: true, prepare: async receipt => {
				assertNoTrackerChanges(receipt.path, git(destination, "rev-parse", "HEAD"));
				const head = git(receipt.path, "rev-parse", "HEAD");
				persist(context, () => { attemptOf(context, handle).acceptance!.preparedHead = head; });
			} });
			const prepared = attemptOf(context, handle).acceptance!.preparedHead!;
			if (!contains(destination, prepared)) throw new Error("Refinement integration did not reach its collector");
			persist(context, () => { attemptOf(context, handle).acceptance!.landedHead = git(destination, "rev-parse", "HEAD"); });
		}
	}
	attempt = attemptOf(context, handle);
	// Landing is not acceptance of a changed global contract. Validate again
	// before reservations, recognizing a conversion published before a crash.
	validateAcceptance(context, handle, intent.children, true);
	for (const row of stillOwned(context, attempt, context.tracker.snapshot())) {
		if (!stillOwned(context, attempt, context.tracker.snapshot()).some(current => current.slug === row.slug)) continue;
		context.tracker.update(row.slug, { "claimed-by": stableClaim(context) });
		context.save();
	}
	validateAcceptance(context, handle, intent.children, true);
	persist(context, () => { attemptOf(context, handle).phase = "accepted"; });
	return outcome;
}

/** Persist acceptance report, re-read/validate global promotion/decomposition,
 * land committed stubs with keep:true, then convert owned claims to reconcile:<root>.
 * Replay accepting state by saved prepared-head ancestry, not report cursor. */
export async function acceptRefinement(context: RefinementContext, handle: string, input: RefinementAcceptance): Promise<RefinementOutcome> {
	return context.locked(async () => {
		const attempt = attemptOf(context, handle);
		if (attempt.phase === "accepted" || attempt.phase === "accepting") return accept(context, handle);
		if (attempt.phase !== "writing" || input.worker.handle !== handle)
			throw new Error("Refinement is not the reported writer: " + handle);
		validateAcceptance(context, handle, input.children, false);
		remember(context, handle, stillOwned(context, attempt, context.tracker.snapshot()).map(row => row.slug));
		persist(context, () => {
			const current = attemptOf(context, handle);
			current.phase = "accepting";
			current.worker = { ...input.worker };
			current.acceptance = {
				reportTs: input.reportTs, report: input.report, children: [...input.children],
				into: input.into, destination: input.destination,
			};
		});
		return accept(context, handle);
	});
}

/** Resume interrupted cleanup/adoption/acceptance before scheduling descendants. */
export async function recoverRefinements(context: RefinementContext): Promise<void> {
	await context.locked(async () => {
		observeRefinements(context);
		for (const handle of Object.keys(context.state.refinements)) {
			const attempt = attemptOf(context, handle);
			if (attempt.phase === "stopping" || attempt.phase === "cleaning") await discard(context, handle);
			else if (attempt.phase === "adopting" && attempt.successor) await adopt(context, handle);
			else if (attempt.phase === "accepting") await accept(context, handle);
		}
	});
}

/** Relinquish only this run's reservation/attempt claims on a moved-out subtree. */
export function releaseRefinementClaims(context: RefinementContext, node: string): void {
	const claims = new Set([stableClaim(context), ...Object.values(context.state.refinements).map(attempt => attempt.claim)]);
	for (const row of subtree(context.tracker.snapshot(), node)) {
		if (claims.has(context.tracker.fields(row.slug)["claimed-by"] as string)) {
			context.tracker.update(row.slug, { "claimed-by": null });
			context.save();
		}
	}
}
