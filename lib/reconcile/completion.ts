import { execFileSync } from "node:child_process";
import { isAbsolute } from "node:path";
import { integrate, MergeConflict, type Handle } from "../dispatch.ts";
import { assertNoTrackerChanges } from "../thread/tracker-worktree.ts";
import type { Tracker } from "../tracker.ts";
import { declaredGates, evidencePacket, git, isAncestor, testCommands, testRun } from "./checks.ts";
import { conflictDetails, landingConflict, prepareLandingDependencies } from "./landing.ts";
import type { CollectorRecord, GlobalRunState, LandingOperation, ReviewedResult } from "./tracker-state.ts";

export interface CompletionContext {
	state: GlobalRunState;
	tracker: Tracker;
	save: () => void;
	pathOf: (into: string) => string;
	locked: <T>(work: () => Promise<T>) => Promise<T>;
}
export interface ReviewedLanding {
	slug: string;
	into: string;
	worker: Handle;
	workers: Handle[];
	collector?: CollectorRecord;
	result: ReviewedResult;
	/** Union of the destination's retained files and this reviewer's tests. */
	tests: string[];
}
export type LandingOutcome = { ok: true; head: string; replayed: boolean } | { ok: false; failure: string };

/** Keep the leaf's result even after its chain/worktree is removed. If no explicit
 * handoff summary exists, preserve the reviewed report as summary. */
export function reviewedResult(parent: string | null, handoff: Record<string, unknown>, report: string): ReviewedResult {
	const evidence = handoff.evidence as { path?: unknown } | undefined;
	return {
		parent,
		summary: typeof handoff.summary === "string" && handoff.summary.trim() ? handoff.summary : report,
		...(typeof evidence?.path === "string" ? { evidence: evidence.path } : {}),
		handoff: structuredClone(handoff),
	};
}

/** A refused save must not leave an in-memory success which a later tick treats
 * as durable. Tracker writes and code merges cannot be rolled back this way. */
function persist(context: CompletionContext, next: Partial<Pick<GlobalRunState, "landed" | "results" | "landingOps">>): void {
	const previous = { landed: context.state.landed, results: context.state.results, landingOps: context.state.landingOps };
	Object.assign(context.state, next);
	try { context.save(); }
	catch (error) { Object.assign(context.state, previous); throw error; }
}

function recordLanding(context: CompletionContext, operation: LandingOperation, head: string): void {
	const at = operation.at ?? new Date().toISOString();
	const landed = { ...context.state.landed, [operation.slug]: { into: operation.into, head, at } };
	for (const slug of operation.carried) {
		const entry = landed[slug];
		if (entry?.into === operation.slug && !context.state.results[slug]?.closedAt)
			landed[slug] = { ...entry, into: operation.into, head };
	}
	persist(context, {
		landed,
		results: { ...context.state.results, [operation.slug]: operation.result },
		landingOps: { ...context.state.landingOps, [operation.slug]: { ...operation, landedHead: head, at } },
	});
}

/** Exact prepared code ancestry, not patch equivalence, issue blobs or stage. */
function reached(operation: LandingOperation): string | undefined {
	if (!operation.preparedHead) return;
	const head = git(operation.destination, "rev-parse", "HEAD");
	return isAncestor(operation.destination, operation.preparedHead, head) ? head : undefined;
}

/** Real integrate(keep:true), conflict/refusal probe, dependency prep, declared
 * gates, retained tests and packet validation. Persist intent before merge;
 * persist destination ledger + carried descendants before returning success.
 * Does not close issues or retire threads/collectors. */
export async function landReviewed(context: CompletionContext, input: ReviewedLanding): Promise<LandingOutcome> {
	return context.locked(async () => {
		const existing = context.state.landed[input.slug];
		if (existing) return { ok: true, head: existing.head, replayed: true };
		const pending = context.state.landingOps[input.slug];
		// A post-merge save failure is a persistence retry, never another merge.
		if (pending) {
			const head = reached(pending);
			if (head) {
				recordLanding(context, pending, head);
				return { ok: true, head, replayed: true };
			}
		}
		let before = "", workerHead = "", merged = false;
		try {
			const destination = context.pathOf(input.into);
			before = git(destination, "rev-parse", "HEAD");
			workerHead = git(input.worker.path, "rev-parse", "HEAD");
			assertNoTrackerChanges(input.worker.path, before);
			const conflict = landingConflict(input.worker.path, before, workerHead);
			if (conflict) return { ok: false, failure: conflict };
			const workers = [...(pending?.workers ?? []), ...input.workers, input.worker]
				.filter((worker, index, all) => all.findIndex(other =>
					other.run === worker.run && other.handle === worker.handle && other.path === worker.path) === index);
			const operation: LandingOperation = {
				slug: input.slug, into: input.into, destination, before,
				worker: structuredClone(input.worker),
				carried: Object.keys(context.state.landed).filter(slug => slug !== input.slug &&
					context.state.landed[slug].into === input.slug && !context.state.results[slug]?.closedAt),
				result: structuredClone(input.result), workers: structuredClone(workers),
				...(input.collector ? { collector: structuredClone(input.collector) } : {}),
			};
			persist(context, { landingOps: { ...context.state.landingOps, [input.slug]: operation } });
			await integrate(input.worker, { cwd: destination, keep: true, prepare: async worker => {
				prepareLandingDependencies(worker.path, workerHead);
				const run = (cmd: string[], timeout = 30 * 60_000) => execFileSync(cmd[0], cmd.slice(1), {
					cwd: worker.path, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20, timeout,
				});
				for (const gate of declaredGates(worker.path)) run(["bash", "-lc", gate.cmd], gate.timeout);
				for (const file of new Set([...input.tests, ...testCommands(operation.result.handoff)])) {
					const cmd = testRun(worker.path, file);
					if (cmd) run(cmd);
				}
				// A self/join chain may omit a packet; a supplied join packet is
				// still its own evidence and must pass on the final prepared head.
				if (operation.result.handoff.evidence !== undefined) evidencePacket(worker.path, operation.result.handoff);
				assertNoTrackerChanges(worker.path, before);
				const dirty = git(worker.path, "status", "--porcelain");
				if (dirty) throw new Error("integrate: preparation left uncommitted changes in " + worker.path + "\n" + dirty);
				const prepared = { ...operation, preparedHead: git(worker.path, "rev-parse", "HEAD") };
				persist(context, { landingOps: { ...context.state.landingOps, [input.slug]: prepared } });
			} });
			merged = true;
			const head = git(destination, "rev-parse", "HEAD");
			recordLanding(context, context.state.landingOps[input.slug], head);
			return { ok: true, head, replayed: false };
		} catch (error: any) {
			// The prepared receipt survived the merge; propagate the persistence
			// error so the runtime retries recovery before finishing or cleanup.
			if (merged) throw error;
			return { ok: false, failure: error instanceof MergeConflict
				? conflictDetails(input.worker.path, before, git(input.worker.path, "merge-base", before, workerHead), error.files)
				: String(error?.message ?? error) + "\n" + String(error?.stdout ?? "").slice(-3000) + String(error?.stderr ?? "").slice(-3000) };
		}
	});
}

/** Caller holds context.locked's serialization boundary. Prove a merge reached
 * its recorded destination before replaying the same ledger transfer. */
export function recoverLandings(context: CompletionContext): void {
	for (const operation of Object.values(context.state.landingOps)) {
		if (context.state.landed[operation.slug]) continue;
		const head = reached(operation);
		if (head) recordLanding(context, operation, head);
	}
}

/** Exact replay of pending owner-reaching results, child first. Record each
 * close only after Tracker.close returns; throw on failure and retry next tick. */
export function closeAtTarget(context: CompletionContext): void {
	if (!isAbsolute(context.state.cwd)) throw new Error("Completion target must be an absolute owner checkout");
	const pending = Object.keys(context.state.landed).filter(slug =>
		context.state.landed[slug].into === context.state.cwd && context.state.results[slug] && !context.state.results[slug].closedAt);
	if (!pending.length) return;
	const order: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
	const visit = (slug: string) => {
		if (visiting.has(slug)) throw new Error("Cycle in carried landing results at " + slug);
		if (visited.has(slug)) return;
		visiting.add(slug);
		for (const child of pending)
			if (context.state.results[child].parent === slug || context.state.landingOps[slug]?.carried.includes(child)) visit(child);
		visiting.delete(slug);
		visited.add(slug);
		order.push(slug);
	};
	for (const slug of pending) visit(slug);
	// The target-reaching ledger must be durable before the first tracker write.
	context.save();
	const snapshot = context.tracker.snapshot();
	for (const slug of order) {
		const result = context.state.results[slug];
		// Done is deliberately not a shortcut: a previous close may have written
		// successfully and then thrown, or its receipt save may have failed.
		if (!snapshot.get(slug)?.archived) context.tracker.close(slug, { summary: result.summary, evidence: result.evidence });
		persist(context, { results: { ...context.state.results, [slug]: { ...result, closedAt: new Date().toISOString() } } });
	}
}

/** Confirmation from the runtime, not a retirement attempt. Receipts remain
 * available even after the chain/collector disappears or retirement fails. */
export function finishLandingCleanup(context: CompletionContext, slug: string): void {
	const operation = context.state.landingOps[slug];
	if (!operation?.landedHead || !context.state.landed[slug])
		throw new Error("Cannot finish cleanup before a durable landing: " + slug);
	if (operation.cleanupDone) return;
	persist(context, { landingOps: { ...context.state.landingOps, [slug]: { ...operation, cleanupDone: new Date().toISOString() } } });
}
