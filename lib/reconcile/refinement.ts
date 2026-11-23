import { existsSync, realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { findWorker, integrate, type Handle } from "../dispatch.ts";
import type { Tracker } from "../tracker.ts";
import { readProposal, stripProposalCommits, directChildrenOf, resolveProposedChild } from "./proposal.ts";
import { bbThreads } from "../thread/bb.ts";
import { checkout } from "../thread/git.ts";
import { assertNoTrackerChanges } from "../thread/tracker-worktree.ts";
import { git, isAncestor } from "./checks.ts";
import type { GlobalRunState, RefinementAttempt } from "./tracker-state.ts";

export interface RefinementContext {
	state: GlobalRunState;
	tracker: Tracker;
	save: () => void;
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

export function beginRefinement(context: RefinementContext, node: string, handle: string): RefinementAttempt {
	const existing = context.state.refinements[handle];
	if (existing) {
		if (existing.node !== node) throw new Error("Refinement handle reused: " + handle);
		return existing;
	}
	const attempt: RefinementAttempt = { node, handle, phase: "writing" };
	persist(context, () => { context.state.refinements[handle] = attempt; });
	return attempt;
}

async function accept(context: RefinementContext, handle: string): Promise<RefinementOutcome> {
	const attempt = attemptOf(context, handle);
	const intent = attempt.acceptance;
	if (!intent || !attempt.worker) throw new Error("Missing refinement acceptance receipt: " + handle);
	if (attempt.phase === "accepted") return { kind: intent.children.length ? "decomposed" : "promoted", children: [...intent.children] };
	const { proposal, created } = intent;
	if (!proposal || !created) throw new Error("Missing saved proposal: " + handle);
	const destination = realpathSync(intent.destination);
	if (destination === realpathSync(context.state.cwd) || isAbsolute(intent.into))
		throw new Error("Refinement stubs must land in a collector, not the owner");
	if (intent.landedHead && !isAncestor(destination, intent.preparedHead ?? intent.landedHead))
		throw new Error("Saved refinement stubs no longer reach their collector");
	if (!intent.landedHead) {
		if (intent.preparedHead && isAncestor(destination, intent.preparedHead)) {
			persist(context, () => { attemptOf(context, handle).acceptance!.landedHead = git(destination, "rev-parse", "HEAD"); });
		} else {
			const worker = attempt.worker;
			// The run spawned this worker and its worktree, so it is ours to merge: its receipt, bb thread and checkout name it.
			const found = await findWorker(worker, context.state.cwd);
			const live = found && (await bbThreads()).get(found.bb);
			const writer = found && existsSync(found.path) ? checkout(found.path) : undefined;
			if (!found || handle !== worker.handle || !live || live.archivedAt || !writer?.branch || realpathSync(found.path) !== realpathSync(worker.path))
				throw new Error("No exact registered refinement worker: " + handle);
			const branch = git(destination, "branch", "--show-current");
			if (!branch || branch === writer.branch || git(destination, "rev-parse", "--path-format=absolute", "--git-common-dir")
				!== git(writer.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"))
				throw new Error("Invalid refinement collector destination");
			assertNoTrackerChanges(writer.cwd, git(destination, "rev-parse", "HEAD"));
			git(writer.project, "config", "branch." + writer.branch + ".ab-parent", branch);
			const base = git(destination, "rev-parse", "HEAD");
			if (!git(writer.cwd, "diff", "--name-only", base + "...HEAD", "--", ".", ":(exclude).reconcile/proposal/**")) {
				persist(context, () => { intent.preparedHead = intent.landedHead = base; });
			} else await integrate(worker, { cwd: context.state.cwd, keep: true, prepare: async receipt => {
				assertNoTrackerChanges(receipt.path, git(destination, "rev-parse", "HEAD"));
				const head = stripProposalCommits(receipt.path, git(destination, "rev-parse", "HEAD"));
				persist(context, () => { attemptOf(context, handle).acceptance!.preparedHead = head; });
			} });
			const prepared = attemptOf(context, handle).acceptance!.preparedHead!;
			if (!isAncestor(destination, prepared)) throw new Error("Refinement integration did not reach its collector");
			persist(context, () => { attemptOf(context, handle).acceptance!.landedHead = git(destination, "rev-parse", "HEAD"); });
		}
	}
	for (const child of proposal.children) {
		if (Object.hasOwn(created, child.alias)) continue;
		const claim = stableClaim(context), request = resolveProposedChild(child, created, claim);
		const row = !context.tracker.githubIssue && context.tracker.snapshot().get(child.alias);
		let slug: string;
		if (row) {
			if (row.partOf !== request.fields["part-of"] || context.tracker.fields(row.slug)["claimed-by"] !== claim)
				throw new Error("Refinement alias was taken: " + child.alias);
			slug = row.slug;
		} else slug = context.tracker.create(request);
		persist(context, () => { created[child.alias] = slug; });
	}
	for (const child of proposal.children) if (child.fields.stage == null)
		context.tracker.update(created[child.alias], { stage: null });
	const children = directChildrenOf(proposal, attempt.node, created);
	persist(context, () => { intent.children = children; });
	if (proposal.parent) {
		const fields = { ...proposal.parent.fields };
		if (Array.isArray(fields["blocked-by"])) fields["blocked-by"] = fields["blocked-by"].map(b => Object.hasOwn(created, b) ? created[b] : b);
		context.tracker.update(attempt.node, fields, proposal.parent.body);
	}
	persist(context, () => { attempt.phase = "accepted"; });
	return { kind: children.length ? "decomposed" : "promoted", children };
}

export async function acceptRefinement(context: RefinementContext, handle: string, input: RefinementAcceptance): Promise<RefinementOutcome> {
	return context.locked(async () => {
		const attempt = attemptOf(context, handle);
		if (attempt.phase === "accepted" || attempt.phase === "accepting") return accept(context, handle);
		if (attempt.phase !== "writing" || input.worker.handle !== handle)
			throw new Error("Refinement is not the reported writer: " + handle);
		const proposal = readProposal(input.worker.path, context.tracker, attempt.node, context.state.root, input.children);
		persist(context, () => {
			attempt.phase = "accepting";
			attempt.worker = { ...input.worker };
			attempt.acceptance = {
				reportTs: input.reportTs, report: input.report, children: [...input.children],
				into: input.into, destination: input.destination, proposal, created: {},
			};
		});
		return accept(context, handle);
	});
}

export async function recoverRefinements(context: RefinementContext): Promise<void> {
	for (const a of Object.values(context.state.refinements)) if (a.phase === "accepting")
		await context.locked(() => accept(context, a.handle));
}
